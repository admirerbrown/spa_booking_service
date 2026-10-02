import { describe, expect, it } from 'vitest';
import { getAvailableSlots, combineTherapistSlots } from "./availability";


describe('getAvailableSlots', () => {
  const day = '2026-10-01';
  const workingHours = [{ start: '09:00', end: '12:00' }];

  it('creates duration-sized slots that fit completely within working hours', () => {
    expect(getAvailableSlots({ day, workingHours, durationMinutes: 60, bookings: [] }))
      .toEqual(['09:00', '10:00', '11:00']);
  });

  it('removes every slot that overlaps an active confirmed booking', () => {
    expect(getAvailableSlots({
      day,
      workingHours,
      durationMinutes: 60,
      bookings: [{ startTime: '2026-10-01T09:30:00.000Z', endTime: '2026-10-01T10:30:00.000Z', status: 'confirmed' }],
      now: new Date('2026-10-01T08:00:00.000Z'),
    })).toEqual(['11:00']);
  });

  it('blocks a future hold but ignores an expired one', () => {
    expect(getAvailableSlots({
      day,
      workingHours,
      durationMinutes: 60,
      bookings: [
        { startTime: '2026-10-01T09:00:00.000Z', endTime: '2026-10-01T10:00:00.000Z', status: 'held', heldUntil: '2026-10-01T09:10:00.000Z' },
        { startTime: '2026-10-01T10:00:00.000Z', endTime: '2026-10-01T11:00:00.000Z', status: 'held', heldUntil: '2026-10-01T07:59:00.000Z' },
      ],
      now: new Date('2026-10-01T08:00:00.000Z'),
    })).toEqual(['10:00', '11:00']);
  });
});


describe("combineTherapistSlots", () => {
  it("shows each start time once and selects a therapist deterministically", () => {
    const slots = [
      {
        therapistId: "therapist-b",
        startTime: "2026-10-02T09:00:00.000Z",
        endTime: "2026-10-02T10:00:00.000Z",
      },
      {
        therapistId: "therapist-a",
        startTime: "2026-10-02T09:00:00.000Z",
        endTime: "2026-10-02T10:00:00.000Z",
      },
      {
        therapistId: "therapist-c",
        startTime: "2026-10-02T10:00:00.000Z",
        endTime: "2026-10-02T11:00:00.000Z",
      },
    ];

    expect(combineTherapistSlots(slots)).toEqual([
      {
        therapistId: "therapist-a",
        startTime: "2026-10-02T09:00:00.000Z",
        endTime: "2026-10-02T10:00:00.000Z",
      },
      {
        therapistId: "therapist-c",
        startTime: "2026-10-02T10:00:00.000Z",
        endTime: "2026-10-02T11:00:00.000Z",
      },
    ]);
  });

  it("returns an empty array when no therapists have available slots", () => {
    expect(combineTherapistSlots([])).toEqual([]);
  });
});
