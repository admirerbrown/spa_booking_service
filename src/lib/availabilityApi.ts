import {
  combineTherapistSlots,
  getAvailableSlots,
  type AvailableSlot,
  type BookingInterval,
  type WorkingPeriod,
} from "../domain/availability";

import { supabase } from "./supabase";

type ServiceRow = {
  duration_minutes: number;
};

type TherapistRow = {
  id: string;
};

type WorkingHoursRow = {
  therapist_id: string;
  starts_at: string;
  ends_at: string;
};

type BookingRow = {
  start_time: string;
  end_time: string;
  status: "held" | "confirmed";
  held_until?: string | null;
};

export async function getAvailability(
  serviceId: string,
  date: string,
): Promise<AvailableSlot[]> {
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .single();

  if (serviceError) throw serviceError;

  const { data: therapists, error: therapistsError } = await supabase
    .from("therapists")
    .select("id");

  if (therapistsError) throw therapistsError;

  const weekday = new Date(`${date}T00:00:00`).getUTCDay();

  const { data: workingHours, error: workingHoursError } = await supabase
    .from("therapist_working_hours")
    .select("therapist_id, starts_at, ends_at")
    .eq("weekday", weekday);

  if (workingHoursError) throw workingHoursError;

  const allSlots: AvailableSlot[] = [];

  for (const therapist of therapists as TherapistRow[]) {
    const therapistHours = (workingHours as WorkingHoursRow[])
      .filter((row) => row.therapist_id === therapist.id)
      .map(
        (row): WorkingPeriod => ({
          start: row.starts_at,
          end: row.ends_at,
        }),
      );

    const { data: bookings, error: bookingsError } = await supabase.rpc(
      "get_active_booking_intervals",
      {
        p_therapist_id: therapist.id,
        p_date: date,
      },
    );

    if (bookingsError) throw bookingsError;

    const bookingIntervals: BookingInterval[] = (
      (bookings ?? []) as BookingRow[]
    ).map((booking) => ({
      startTime: booking.start_time,
      endTime: booking.end_time,
      status: booking.status,
      heldUntil: booking.held_until,
    }));

    const starts = getAvailableSlots({
      day: date,
      workingHours: therapistHours,
      durationMinutes: (service as ServiceRow).duration_minutes,
      bookings: bookingIntervals,
    });

    for (const startTime of starts) {
      const [hours, minutes] = startTime.split(":").map(Number);
      const endMinutes =
        hours * 60 + minutes + (service as ServiceRow).duration_minutes;

      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(
        2,
        "0",
      )}:${String(endMinutes % 60).padStart(2, "0")}`;

      allSlots.push({
        therapistId: therapist.id,
        startTime,
        endTime,
      });
    }
  }

  return combineTherapistSlots(allSlots);
}
