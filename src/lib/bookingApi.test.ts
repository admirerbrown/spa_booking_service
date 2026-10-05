import { describe, expect, it, vi } from "vitest";

import { createBookingApi } from "./bookingApi";

const rpc = vi.fn();

const api = createBookingApi({ rpc } as never);

describe("booking API", () => {
  it("creates a hold through the database RPC, not a direct table insert", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          booking_id: "hold-1",
          confirmation_token: "token-1",
          held_until: "2026-10-01T09:05:00Z",
        },
      ],
      error: null,
    });

    await expect(
      api.createHold({
        serviceId: "service-1",
        therapistId: "therapist-1",
        startTime: "2026-10-01T09:00:00Z",
      }),
    ).resolves.toEqual({
      bookingId: "hold-1",
      confirmationToken: "token-1",
      heldUntil: "2026-10-01T09:05:00Z",
    });

    expect(rpc).toHaveBeenCalledWith("create_booking_hold", {
      p_service_id: "service-1",
      p_therapist_id: "therapist-1",
      p_start_time: "2026-10-01T09:00:00Z",
    });
  });

  it("surfaces SLOT_UNAVAILABLE as a typed booking error", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "SLOT_UNAVAILABLE" },
    });

    await expect(
      api.createHold({
        serviceId: "service-1",
        therapistId: "therapist-1",
        startTime: "2026-10-01T09:00:00Z",
      }),
    ).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
    });
  });

  it("surfaces HOLD_EXPIRED as a typed booking error", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "HOLD_EXPIRED" },
    });

    await expect(
      api.confirmHold({
        bookingId: "hold-1",
        confirmationToken: "token-1",
        name: "Ama",
        contact: "0240000000",
      }),
    ).rejects.toMatchObject({
      code: "HOLD_EXPIRED",
    });
  });

  it("surfaces HOLD_NOT_FOUND as a typed booking error", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "HOLD_NOT_FOUND" },
    });

    await expect(
      api.confirmHold({
        bookingId: "hold-1",
        confirmationToken: "token-1",
        name: "Ama",
        contact: "0240000000",
      }),
    ).rejects.toMatchObject({
      code: "HOLD_NOT_FOUND",
    });
  });

  it("surfaces CUSTOMER_DETAILS_REQUIRED as a typed booking error", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "CUSTOMER_DETAILS_REQUIRED" },
    });

    await expect(
      api.confirmHold({
        bookingId: "hold-1",
        confirmationToken: "token-1",
        name: "",
        contact: "",
      }),
    ).rejects.toMatchObject({
      code: "CUSTOMER_DETAILS_REQUIRED",
    });
  });

  it("surfaces SERVICE_NOT_FOUND as a typed booking error", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "SERVICE_NOT_FOUND" },
    });

    await expect(
      api.createHold({
        serviceId: "missing-service",
        therapistId: "therapist-1",
        startTime: "2026-10-01T09:00:00Z",
      }),
    ).rejects.toMatchObject({
      code: "SERVICE_NOT_FOUND",
    });
  });

  it("uses a generic typed error for unexpected database failures", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "connection unexpectedly closed" },
    });

    await expect(
      api.createHold({
        serviceId: "service-1",
        therapistId: "therapist-1",
        startTime: "2026-10-01T09:00:00Z",
      }),
    ).rejects.toMatchObject({
      code: "UNKNOWN",
    });
  });

  it("confirms only with the opaque hold token", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          booking_id: "hold-1",
          start_time: "2026-10-01T09:00:00Z",
          end_time: "2026-10-01T10:00:00Z",
          status: "confirmed",
        },
      ],
      error: null,
    });

    await expect(
      api.confirmHold({
        bookingId: "hold-1",
        confirmationToken: "token-1",
        name: "Ama",
        contact: "0240000000",
      }),
    ).resolves.toMatchObject({
      bookingId: "hold-1",
      status: "confirmed",
    });

    expect(rpc).toHaveBeenCalledWith("confirm_booking_hold", {
      p_booking_id: "hold-1",
      p_confirmation_token: "token-1",
      p_customer_name: "Ama",
      p_customer_contact: "0240000000",
    });
  });

  it("gets booking status through the protected status RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          booking_id: "hold-1",
          status: "held",
          held_until: "2026-10-01T09:05:00Z",
          start_time: "2026-10-01T09:00:00Z",
          end_time: "2026-10-01T10:00:00Z",
        },
      ],
      error: null,
    });

    await expect(
      api.getBookingStatus({
        bookingId: "hold-1",
        confirmationToken: "token-1",
      }),
    ).resolves.toEqual({
      bookingId: "hold-1",
      status: "held",
      heldUntil: "2026-10-01T09:05:00Z",
      startTime: "2026-10-01T09:00:00Z",
      endTime: "2026-10-01T10:00:00Z",
    });

    expect(rpc).toHaveBeenCalledWith("get_booking_status", {
      p_booking_id: "hold-1",
      p_confirmation_token: "token-1",
    });
  });

  it("surfaces BOOKING_NOT_FOUND when status lookup cannot find the booking", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "BOOKING_NOT_FOUND" },
    });

    await expect(
      api.getBookingStatus({
        bookingId: "missing-booking",
        confirmationToken: "token-1",
      }),
    ).rejects.toMatchObject({
      code: "BOOKING_NOT_FOUND",
    });
  });
});
