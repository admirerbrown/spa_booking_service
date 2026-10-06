export type WorkingPeriod = { start: string; end: string };

export type BookingInterval = {
  startTime: string;
  endTime: string;
  status: "held" | "confirmed";
  heldUntil?: string | null;
};

type AvailabilityInput = {
  day: string;
  workingHours: WorkingPeriod[];
  durationMinutes: number;
  bookings: BookingInterval[];
  now?: Date;
};
export type AvailableSlot = {
  therapistId: string;
  startTime: string;
  endTime: string;
};

const minutes = (value: string) => {
  const [hours, minutesPart] = value.split(":").map(Number);
  return hours * 60 + minutesPart;
};

const clock = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

const isActive = (booking: BookingInterval, now: Date) =>
  booking.status === "confirmed" ||
  (booking.heldUntil !== undefined &&
    booking.heldUntil !== null &&
    new Date(booking.heldUntil) > now);

export function getAvailableSlots({
  day,
  workingHours,
  durationMinutes,
  bookings,
  now = new Date(),
}: AvailabilityInput): string[] {
  if (durationMinutes <= 0) return [];

  return workingHours.flatMap(({ start, end }) => {
    const periodStart = minutes(start);
    const periodEnd = minutes(end);
    const slots: string[] = [];

    for (
      let slotStart = periodStart;
      slotStart + durationMinutes <= periodEnd;
      slotStart += durationMinutes
    ) {
      const slotEnd = slotStart + durationMinutes;
      const slotStartAt = new Date(`${day}T${clock(slotStart)}:00.000Z`);
      if (slotStartAt <= now) continue;

      const overlaps = bookings.some((booking) => {
        if (!isActive(booking, now)) return false;
        const bookingStart = new Date(booking.startTime);
        const bookingEnd = new Date(booking.endTime);
        const slotEndAt = new Date(`${day}T${clock(slotEnd)}:00.000Z`);
        return bookingStart < slotEndAt && bookingEnd > slotStartAt;
      });
      if (!overlaps) slots.push(clock(slotStart));
    }
    return slots;
  });
}
export function combineTherapistSlots(slots: AvailableSlot[]): AvailableSlot[] {
  const slotsByStartTime = new Map<string, AvailableSlot>();

  for (const slot of slots) {
    const existing = slotsByStartTime.get(slot.startTime);

    if (!existing || slot.therapistId < existing.therapistId) {
      slotsByStartTime.set(slot.startTime, slot);
    }
  }

  return Array.from(slotsByStartTime.values()).sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
}