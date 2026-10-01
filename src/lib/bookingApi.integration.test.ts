import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for database integration tests. Start local Supabase and provide its Postgres connection URL.",
  );
}

const pool = new Pool({ connectionString: databaseUrl, max: 4 });
let serviceId: string;
let therapistId: string;
let allDayTherapistId: string;

async function createHold(startTime: string) {
  return pool.query("select * from public.create_booking_hold($1, $2, $3)", [
    serviceId,
    therapistId,
    startTime,
  ]);
}

async function createConfirmedBooking(startOffset: string) {
  const result = await pool.query(
    `insert into public.bookings (service_id, therapist_id, start_time, end_time, status, customer_name, customer_contact)
     select $1, $2,
       clock_timestamp() + $3::interval,
       clock_timestamp() + $3::interval + make_interval(mins => (select duration_minutes from public.services where id = $1)),
       'confirmed', 'Test Customer', '+233000000000'
     returning id as booking_id, confirmation_token, start_time`,
    [serviceId, allDayTherapistId, startOffset],
  );
  return result.rows[0];
}

beforeAll(async () => {
  const service = await pool.query(
    "insert into public.services (name, duration_minutes, price) values ($1, 60, 100) returning id",
    [`Test massage ${randomUUID()}`],
  );
  serviceId = service.rows[0].id;
  const therapist = await pool.query(
    "insert into public.therapists (name, timezone) values ($1, 'Africa/Accra') returning id",
    [`Test therapist ${randomUUID()}`],
  );
  therapistId = therapist.rows[0].id;
  await pool.query(
    "insert into public.therapist_working_hours (therapist_id, weekday, starts_at, ends_at) select $1, weekday, $2::time, $3::time from generate_series(0, 6) weekday",
    [therapistId, "09:00", "17:00"],
  );
  // All-day working hours therapist so cancellation/reschedule cutoff tests aren't
  // sensitive to what time of day the test suite happens to run.
  const allDayTherapist = await pool.query(
    "insert into public.therapists (name, timezone) values ($1, 'UTC') returning id",
    [`Test therapist allday ${randomUUID()}`],
  );
  allDayTherapistId = allDayTherapist.rows[0].id;
  await pool.query(
    "insert into public.therapist_working_hours (therapist_id, weekday, starts_at, ends_at) select $1, weekday, $2::time, $3::time from generate_series(0, 6) weekday",
    [allDayTherapistId, "00:00", "23:59"],
  );
});

afterAll(async () => {
  await pool.query(
    "delete from public.bookings where service_id = $1 or therapist_id = $2 or therapist_id = $3",
    [serviceId, therapistId, allDayTherapistId],
  );
  await pool.query("delete from public.services where id = $1", [serviceId]);
  await pool.query("delete from public.therapists where id in ($1, $2)", [
    therapistId,
    allDayTherapistId,
  ]);
  await pool.end();
});

describe("booking integrity in PostgreSQL", () => {
  it("allows exactly one of two genuinely parallel, overlapping requests", async () => {
    const results = await Promise.allSettled([
      createHold("2030-01-07T09:00:00Z"),
      createHold("2030-01-07T09:30:00Z"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it("treats a future hold as active", async () => {
    await createHold("2030-01-08T09:00:00Z");
    await expect(createHold("2030-01-08T09:30:00Z")).rejects.toThrow(
      "SLOT_UNAVAILABLE",
    );
  });

  it("does not let an expired hold block a new request", async () => {
    const held = await createHold("2030-01-09T09:00:00Z");
    await pool.query(
      "update public.bookings set held_until = clock_timestamp() - interval '1 second' where id = $1",
      [held.rows[0].booking_id],
    );
    await expect(createHold("2030-01-09T09:00:00Z")).resolves.toBeDefined();
  });

  it("rejects confirming an expired hold", async () => {
    const held = await createHold("2030-01-10T09:00:00Z");
    await pool.query(
      "update public.bookings set held_until = clock_timestamp() - interval '1 second' where id = $1",
      [held.rows[0].booking_id],
    );
    await expect(
      pool.query("select * from public.confirm_booking_hold($1, $2, $3, $4)", [
        held.rows[0].booking_id,
        held.rows[0].confirmation_token,
        "Ama Mensah",
        "+233240000000",
      ]),
    ).rejects.toThrow("HOLD_EXPIRED");
  });

  it("rejects a booking outside the therapist working hours", async () => {
    await expect(createHold("2030-01-11T17:00:00Z")).rejects.toThrow(
      "OUTSIDE_WORKING_HOURS",
    );
  });
});

describe("cancellation and rescheduling", () => {
  // Each test uses its own, well-separated hour offset on the shared
  // allDayTherapistId so leftover rows from one test can never overlap
  // another test's target window, regardless of exact run timing.
  it("cancels a booking more than 1 hour before its start time", async () => {
    const booking = await createConfirmedBooking("10 hours");
    const result = await pool.query(
      "select * from public.cancel_booking($1, $2)",
      [booking.booking_id, booking.confirmation_token],
    );
    expect(result.rows[0].status).toBe("cancelled");
  });

  it("rejects cancelling within 1 hour of the start time", async () => {
    const booking = await createConfirmedBooking("30 minutes");
    await expect(
      pool.query("select * from public.cancel_booking($1, $2)", [
        booking.booking_id,
        booking.confirmation_token,
      ]),
    ).rejects.toThrow("CANCELLATION_WINDOW_CLOSED");
  });

  it("rejects cancelling with the wrong confirmation token", async () => {
    const booking = await createConfirmedBooking("11 hours");
    await expect(
      pool.query("select * from public.cancel_booking($1, $2)", [
        booking.booking_id,
        randomUUID(),
      ]),
    ).rejects.toThrow("BOOKING_NOT_FOUND");
  });

  it("rejects cancelling an already-cancelled booking", async () => {
    const booking = await createConfirmedBooking("12 hours");
    await pool.query("select * from public.cancel_booking($1, $2)", [
      booking.booking_id,
      booking.confirmation_token,
    ]);
    await expect(
      pool.query("select * from public.cancel_booking($1, $2)", [
        booking.booking_id,
        booking.confirmation_token,
      ]),
    ).rejects.toThrow("BOOKING_NOT_CANCELLABLE");
  });

  it("reschedules a booking more than 1 hour before its original start time", async () => {
    const booking = await createConfirmedBooking("13 hours");
    const newStart = new Date(
      Date.parse(booking.start_time) + 60 * 60 * 1000,
    ).toISOString();
    const result = await pool.query(
      "select * from public.reschedule_booking($1, $2, $3)",
      [booking.booking_id, booking.confirmation_token, newStart],
    );
    expect(new Date(result.rows[0].start_time).toISOString()).toBe(newStart);
  });

  it("rejects rescheduling within 1 hour of the original start time", async () => {
    const booking = await createConfirmedBooking("45 minutes");
    const newStart = new Date(
      Date.parse(booking.start_time) + 60 * 60 * 1000,
    ).toISOString();
    await expect(
      pool.query("select * from public.reschedule_booking($1, $2, $3)", [
        booking.booking_id,
        booking.confirmation_token,
        newStart,
      ]),
    ).rejects.toThrow("CANCELLATION_WINDOW_CLOSED");
  });

  it("rejects rescheduling onto a slot that is already taken, leaving the original booking intact", async () => {
    const bookingA = await createConfirmedBooking("15 hours");
    const bookingB = await createConfirmedBooking("18 hours");
    await expect(
      pool.query("select * from public.reschedule_booking($1, $2, $3)", [
        bookingA.booking_id,
        bookingA.confirmation_token,
        bookingB.start_time,
      ]),
    ).rejects.toThrow("SLOT_UNAVAILABLE");

    const stillOriginal = await pool.query(
      "select start_time, status from public.bookings where id = $1",
      [bookingA.booking_id],
    );
    expect(stillOriginal.rows[0].status).toBe("confirmed");
    expect(new Date(stillOriginal.rows[0].start_time).toISOString()).toBe(
      new Date(bookingA.start_time).toISOString(),
    );
  });
});

describe("get_booking_status (session resume)", () => {
  it("returns held status and held_until for an active hold", async () => {
    const held = await createHold("2030-01-20T09:00:00Z");
    const result = await pool.query(
      "select * from public.get_booking_status($1, $2)",
      [held.rows[0].booking_id, held.rows[0].confirmation_token],
    );
    expect(result.rows[0].status).toBe("held");
    expect(result.rows[0].held_until).not.toBeNull();
  });

  it("returns confirmed status for a confirmed booking", async () => {
    const booking = await createConfirmedBooking("20 hours");
    const result = await pool.query(
      "select * from public.get_booking_status($1, $2)",
      [booking.booking_id, booking.confirmation_token],
    );
    expect(result.rows[0].status).toBe("confirmed");
    expect(result.rows[0].held_until).toBeNull();
  });

  it("rejects a lookup with the wrong confirmation token without revealing whether the booking exists", async () => {
    const booking = await createConfirmedBooking("21 hours");
    await expect(
      pool.query("select * from public.get_booking_status($1, $2)", [
        booking.booking_id,
        randomUUID(),
      ]),
    ).rejects.toThrow("BOOKING_NOT_FOUND");
  });

  it("rejects a lookup for a nonexistent booking id", async () => {
    await expect(
      pool.query("select * from public.get_booking_status($1, $2)", [
        randomUUID(),
        randomUUID(),
      ]),
    ).rejects.toThrow("BOOKING_NOT_FOUND");
  });
});
