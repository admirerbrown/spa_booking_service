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

async function createHold(startTime: string) {
  return pool.query("select * from public.create_booking_hold($1, $2, $3)", [
    serviceId,
    therapistId,
    startTime,
  ]);
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
});

afterAll(async () => {
  await pool.query(
    "delete from public.bookings where service_id = $1 or therapist_id = $2",
    [serviceId, therapistId],
  );
  await pool.query("delete from public.services where id = $1", [serviceId]);
  await pool.query("delete from public.therapists where id = $1", [
    therapistId,
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
