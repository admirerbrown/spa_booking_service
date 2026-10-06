import { describe, expect, it, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("./supabase", () => ({
  supabase: mockSupabase,
}));

import { getAvailability } from "./availabilityApi";

describe("getAvailability", () => {
  it("returns combined available slots for a service and date", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "services") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  duration_minutes: 60,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "therapists") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: "therapist-1",
                name: "Ama",
              },
            ],
            error: null,
          }),
        };
      }

      if (table === "therapist_working_hours") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  therapist_id: "therapist-1",
                  starts_at: "09:00:00",
                  ends_at: "11:00:00",
                },
              ],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await getAvailability("service-1", "2026-10-05");

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "get_active_booking_intervals",
      {
        p_therapist_id: "therapist-1",
        p_from: "2026-10-05T00:00:00.000Z",
        p_until: "2026-10-06T00:00:00.000Z",
      },
    );
    expect(result).toEqual([
      {
        therapistId: "therapist-1",
        startTime: "09:00",
        endTime: "10:00",
      },
      {
        therapistId: "therapist-1",
        startTime: "10:00",
        endTime: "11:00",
      },
    ]);
  });

  it("excludes slots occupied by a confirmed booking", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "services") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  duration_minutes: 60,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "therapists") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: "therapist-1",
              },
            ],
            error: null,
          }),
        };
      }

      if (table === "therapist_working_hours") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  therapist_id: "therapist-1",
                  starts_at: "09:00:00",
                  ends_at: "12:00:00",
                },
              ],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          start_time: "2026-10-05T10:00:00.000Z",
          end_time: "2026-10-05T11:00:00.000Z",
          status: "confirmed",
          held_until: null,
        },
      ],
      error: null,
    });

    const result = await getAvailability("service-1", "2026-10-05");

    expect(result).toEqual([
      {
        therapistId: "therapist-1",
        startTime: "09:00",
        endTime: "10:00",
      },
      {
        therapistId: "therapist-1",
        startTime: "11:00",
        endTime: "12:00",
      },
    ]);
  });

  it("combines duplicate start times and selects a therapist deterministically", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "services") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  duration_minutes: 60,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "therapists") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: "therapist-2",
              },
              {
                id: "therapist-1",
              },
            ],
            error: null,
          }),
        };
      }

      if (table === "therapist_working_hours") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  therapist_id: "therapist-1",
                  starts_at: "09:00:00",
                  ends_at: "11:00:00",
                },
                {
                  therapist_id: "therapist-2",
                  starts_at: "09:00:00",
                  ends_at: "11:00:00",
                },
              ],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await getAvailability("service-1", "2026-10-05");

    expect(result).toEqual([
      {
        therapistId: "therapist-1",
        startTime: "09:00",
        endTime: "10:00",
      },
      {
        therapistId: "therapist-1",
        startTime: "10:00",
        endTime: "11:00",
      },
    ]);
  });


});
