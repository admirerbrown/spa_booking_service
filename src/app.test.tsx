import { render, screen, waitFor } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

import { BookingError } from "./lib/bookingApi";

const { getAvailability, createHold, confirmHold, getBookingStatus } =
  vi.hoisted(() => ({
    getAvailability: vi.fn(),

    createHold: vi.fn(),

    confirmHold: vi.fn(),

    getBookingStatus: vi.fn(),
  }));

vi.mock("./lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "service-1",

              name: "Deep Tissue Massage",

              description: "A therapeutic full-body massage.",

              duration_minutes: 60,

              price: 250,
            },

            {
              id: "service-2",

              name: "Swedish Massage",

              description: "A relaxing full-body massage.",

              duration_minutes: 60,

              price: 200,
            },
          ],

          error: null,
        }),
      })),
    })),
  },
}));

vi.mock("./lib/availabilityApi", () => ({
  getAvailability,
}));

vi.mock("./lib/bookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/bookingApi")>();

  return {
    ...actual,

    createBookingApi: () => ({
      createHold,

      confirmHold,

      getBookingStatus,
    }),
  };
});

describe("App", () => {
  beforeEach(() => {
    sessionStorage.clear();

    getAvailability.mockReset();

    getAvailability.mockResolvedValue([
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

    createHold.mockReset();

    createHold.mockResolvedValue({
      bookingId: "booking-default",

      confirmationToken: "token-default",

      heldUntil: "2026-10-05T09:05:00Z",
    });

    confirmHold.mockReset();

    confirmHold.mockResolvedValue({
      bookingId: "booking-default",

      startTime: "2026-10-05T09:00:00Z",

      endTime: "2026-10-05T10:00:00Z",

      status: "confirmed",
    });

    getBookingStatus.mockReset();
  });

  it("selects a service when the customer clicks it", async () => {
    const user = userEvent.setup();

    render(<App />);

    const service = await screen.findByRole("button", {
      name: /deep tissue massage/i,
    });

    await user.click(service);

    expect(service).toHaveAttribute("aria-pressed", "true");
  });

  it("shows available appointment slots after selecting a service", async () => {
    const user = userEvent.setup();

    render(<App />);

    const service = await screen.findByRole("button", {
      name: /deep tissue massage/i,
    });

    await user.click(service);

    expect(
      await screen.findByRole("button", { name: "09:00" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "10:00" })).toBeInTheDocument();
  });

  it("selects an available time", async () => {
    const user = userEvent.setup();

    render(<App />);

    const service = await screen.findByRole("button", {
      name: /deep tissue massage/i,
    });

    await user.click(service);

    const slot = await screen.findByRole("button", {
      name: "09:00",
    });

    await user.click(slot);

    expect(slot).toHaveAttribute("aria-pressed", "true");
  });

  it("creates a hold when the user selects an available slot", async () => {
    const user = userEvent.setup();

    createHold.mockResolvedValue({
      bookingId: "booking-1",

      confirmationToken: "token-1",

      heldUntil: "2026-10-05T09:05:00Z",
    });

    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: /deep tissue massage/i,
      }),
    );

    const slot = await screen.findByRole("button", {
      name: "09:00",
    });

    await user.click(slot);

    expect(createHold).toHaveBeenCalledWith({
      serviceId: "service-1",

      therapistId: "therapist-1",

      startTime: "2026-10-05T09:00:00Z",
    });
  });

  it("shows the held state after a hold is successfully created", async () => {
    const user = userEvent.setup();

    createHold.mockResolvedValue({
      bookingId: "booking-1",

      confirmationToken: "token-1",

      heldUntil: "2026-10-05T09:05:00Z",
    });

    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: /deep tissue massage/i,
      }),
    );

    const slot = await screen.findByRole("button", {
      name: "09:00",
    });

    await user.click(slot);

    expect(await screen.findByText(/appointment held/i)).toBeInTheDocument();
  });

  it("shows an unavailable message when the selected slot can no longer be held", async () => {
    const user = userEvent.setup();

    createHold.mockRejectedValueOnce(
      new BookingError(
        "SLOT_UNAVAILABLE",
        "That appointment is no longer available. Please choose another time.",
      ),
    );

    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: /deep tissue massage/i,
      }),
    );

    const slot = await screen.findByRole("button", {
      name: "09:00",
    });

    await user.click(slot);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /that appointment is no longer available\. please choose another time/i,
    );
  });

  it("refreshes availability after a slot becomes unavailable", async () => {
    const user = userEvent.setup();

    getAvailability
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          therapistId: "therapist-1",

          startTime: "10:00",

          endTime: "11:00",
        },
      ]);

    createHold.mockRejectedValueOnce(
      new BookingError(
        "SLOT_UNAVAILABLE",
        "That appointment is no longer available. Please choose another time.",
      ),
    );

    render(<App />);

    const service = await screen.findByRole("button", {
      name: /deep tissue massage/i,
    });

    await user.click(service);

    const unavailableSlot = await screen.findByRole("button", {
      name: "09:00",
    });

    await user.click(unavailableSlot);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /that appointment is no longer available/i,
    );

    expect(getAvailability).toHaveBeenCalledTimes(2);

    expect(getAvailability).toHaveBeenLastCalledWith("service-1", "2026-10-05");

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "09:00" }),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "10:00" })).toBeInTheDocument();

    expect(service).toHaveAttribute("aria-pressed", "true");
  });

  it("refreshes availability after a generic hold failure", async () => {
    const user = userEvent.setup();

    getAvailability
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          therapistId: "therapist-1",

          startTime: "10:00",

          endTime: "11:00",
        },
      ]);

    createHold.mockRejectedValueOnce(
      new BookingError(
        "UNKNOWN",
        "We could not complete the booking. Please try again.",
      ),
    );

    render(<App />);

    const service = await screen.findByRole("button", {
      name: /deep tissue massage/i,
    });

    await user.click(service);

    const failedSlot = await screen.findByRole("button", {
      name: "09:00",
    });

    await user.click(failedSlot);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /we could not hold that appointment\. please try again/i,
    );

    expect(getAvailability).toHaveBeenCalledTimes(2);

    expect(getAvailability).toHaveBeenLastCalledWith("service-1", "2026-10-05");

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "09:00" }),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "10:00" })).toBeInTheDocument();

    expect(service).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the remaining hold time after a hold is created", async () => {
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-10-05T09:00:00Z").getTime(),
    );

    try {
      createHold.mockResolvedValue({
        bookingId: "booking-1",

        confirmationToken: "token-1",

        heldUntil: "2026-10-05T09:05:00Z",
      });

      const user = userEvent.setup();

      render(<App />);

      const service = await screen.findByRole("button", {
        name: /deep tissue massage/i,
      });

      await user.click(service);

      const slot = await screen.findByRole("button", {
        name: "09:00",
      });

      await user.click(slot);

      expect(await screen.findByText(/appointment held/i)).toBeInTheDocument();

      expect(screen.getByText(/5:00 remaining/i)).toBeInTheDocument();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("returns to slot selection when the hold expires", async () => {
    const now = new Date("2026-10-05T09:00:00Z").getTime();

    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      createHold.mockResolvedValue({
        bookingId: "booking-1",

        confirmationToken: "token-1",

        heldUntil: new Date(now + 1000).toISOString(),
      });

      const user = userEvent.setup();

      render(<App />);

      const service = await screen.findByRole("button", {
        name: /deep tissue massage/i,
      });

      await user.click(service);

      const slot = await screen.findByRole("button", {
        name: "09:00",
      });

      await user.click(slot);

      expect(await screen.findByText(/appointment held/i)).toBeInTheDocument();

      dateNow.mockReturnValue(now + 1000);

      await waitFor(
        () => {
          expect(screen.getByRole("alert")).toHaveTextContent(
            /your hold has expired/i,
          );
        },
        { timeout: 2000 },
      );

      expect(screen.getByRole("button", { name: "09:00" })).toBeInTheDocument();

      expect(screen.queryByText(/appointment held/i)).not.toBeInTheDocument();
    } finally {
      dateNow.mockRestore();
    }
  });

  it("persists the active hold in session storage", async () => {
    const now = new Date("2026-10-05T09:00:00Z").getTime();

    vi.spyOn(Date, "now").mockReturnValue(now);

    createHold.mockResolvedValue({
      bookingId: "booking-1",

      confirmationToken: "token-1",

      heldUntil: new Date(now + 5 * 60 * 1000).toISOString(),
    });

    const user = userEvent.setup();

    render(<App />);

    const service = await screen.findByRole("button", {
      name: /deep tissue massage/i,
    });

    await user.click(service);

    const slot = await screen.findByRole("button", {
      name: "09:00",
    });

    await user.click(slot);

    await waitFor(() => {
      expect(screen.getByText(/appointment held/i)).toBeInTheDocument();
    });

    expect(createHold).toHaveBeenCalledWith({
      serviceId: "service-1",

      therapistId: "therapist-1",

      startTime: "2026-10-05T09:00:00Z",
    });

    expect(sessionStorage.getItem("spa_booking_active_hold")).toBe(
      JSON.stringify({
        bookingId: "booking-1",

        confirmationToken: "token-1",

        heldUntil: new Date(now + 5 * 60 * 1000).toISOString(),

        slot: {
          therapistId: "therapist-1",

          startTime: "2026-10-05T09:00:00Z",

          endTime: "2026-10-05T10:00:00Z",
        },
      }),
    );
  });

  it("reconciles a persisted active hold after the app is reopened", async () => {
    sessionStorage.setItem(
      "spa_booking_active_hold",
      JSON.stringify({
        bookingId: "booking-1",

        confirmationToken: "token-1",

        heldUntil: "2026-10-05T09:05:00Z",

        slot: {
          therapistId: "therapist-1",

          startTime: "2026-10-05T09:00:00Z",

          endTime: "2026-10-05T10:00:00Z",
        },
      }),
    );

    getBookingStatus.mockResolvedValue({
      bookingId: "booking-1",

      status: "held",

      heldUntil: "2026-10-05T09:05:00Z",

      startTime: "2026-10-05T09:00:00Z",

      endTime: "2026-10-05T10:00:00Z",
    });

    render(<App />);

    await waitFor(() => {
      expect(getBookingStatus).toHaveBeenCalledWith({
        bookingId: "booking-1",

        confirmationToken: "token-1",
      });
    });

    expect(await screen.findByText(/appointment held/i)).toBeInTheDocument();

    expect(screen.getByText(/5:00 remaining/i)).toBeInTheDocument();
  });

  it("returns to slot selection when a persisted hold cannot be reconciled", async () => {
    sessionStorage.setItem(
      "spa_booking_active_hold",
      JSON.stringify({
        bookingId: "booking-1",

        confirmationToken: "token-1",

        heldUntil: "2026-10-05T09:05:00.000Z",

        slot: {
          therapistId: "therapist-1",

          startTime: "2026-10-05T09:00:00Z",

          endTime: "2026-10-05T10:00:00Z",
        },
      }),
    );

    getBookingStatus.mockRejectedValue(
      new BookingError("BOOKING_NOT_FOUND", "The booking could not be found."),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your previous booking could not be restored.",
      );
    });

    expect(sessionStorage.getItem("spa_booking_active_hold")).toBeNull();

    expect(
      screen.queryByRole("heading", { name: "Appointment held" }),
    ).not.toBeInTheDocument();
  });

  it("shows the confirmation after a persisted booking is confirmed", async () => {
    sessionStorage.setItem(
      "spa_booking_active_hold",
      JSON.stringify({
        bookingId: "booking-1",

        confirmationToken: "token-1",

        heldUntil: "2026-10-05T09:05:00.000Z",

        slot: {
          therapistId: "therapist-1",

          startTime: "2026-10-05T09:00:00Z",

          endTime: "2026-10-05T10:00:00Z",
        },
      }),
    );

    getBookingStatus.mockResolvedValue({
      bookingId: "booking-1",

      status: "confirmed",

      heldUntil: null,

      startTime: "2026-10-05T09:00:00Z",

      endTime: "2026-10-05T10:00:00Z",
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Booking confirmed" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        (_, element) => element?.textContent === "Booking reference: booking-1",
      ),
    ).toBeInTheDocument();
  });

  it("shows customer details fields while an appointment is held", async () => {
    const user = userEvent.setup();

    createHold.mockResolvedValue({
      bookingId: "booking-1",

      confirmationToken: "token-1",

      heldUntil: "2026-10-05T09:05:00.000Z",
    });

    render(<App />);

    const service = await screen.findByRole("button", {
      name: /deep tissue massage/i,
    });

    await user.click(service);

    const slot = await screen.findByRole("button", {
      name: "09:00",
    });

    await user.click(slot);

    expect(
      await screen.findByRole("heading", { name: "Appointment held" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Name")).toBeInTheDocument();

    expect(screen.getByLabelText("Contact")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Confirm booking" }),
    ).toBeInTheDocument();
  });

  it("confirms the held appointment with the customer's details", async () => {
    const user = userEvent.setup();

    createHold.mockResolvedValue({
      bookingId: "booking-1",

      confirmationToken: "token-1",

      heldUntil: "2026-10-05T09:05:00.000Z",
    });

    render(<App />);

    const service = await screen.findByRole("button", {
      name: /deep tissue massage/i,
    });

    await user.click(service);

    const slot = await screen.findByRole("button", {
      name: "09:00",
    });

    await user.click(slot);

    expect(
      await screen.findByRole("heading", { name: "Appointment held" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Samuel Brown");

    await user.type(screen.getByLabelText("Contact"), "0240000000");

    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => {
      expect(confirmHold).toHaveBeenCalledWith({
        bookingId: "booking-1",

        confirmationToken: "token-1",

        name: "Samuel Brown",

        contact: "0240000000",
      });
    });
  });

  it("returns to slot selection when confirmation reports an expired hold", async () => {
    const user = userEvent.setup();

    createHold.mockResolvedValue({
      bookingId: "booking-1",
      confirmationToken: "token-1",
      heldUntil: "2026-10-05T09:05:00.000Z",
    });

    confirmHold.mockRejectedValue(
      new BookingError(
        "HOLD_EXPIRED",
        "Your hold has expired. Please choose another time.",
      ),
    );

    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: /deep tissue massage/i,
      }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: "09:00",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Appointment held",
      }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Samuel Brown");
    await user.type(screen.getByLabelText("Contact"), "0240000000");

    await user.click(
      screen.getByRole("button", {
        name: "Confirm booking",
      }),
    );

    expect(
      await screen.findByText(
        "Your hold has expired. Please choose another time.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Appointment held",
      }),
    ).not.toBeInTheDocument();
  });

  it("reconciles a failed confirmation when the server reports the booking as confirmed", async () => {
    const user = userEvent.setup();

    createHold.mockResolvedValue({
      bookingId: "booking-1",
      confirmationToken: "token-1",
      heldUntil: "2026-10-05T09:05:00.000Z",
    });

    confirmHold.mockRejectedValue(
      new BookingError(
        "UNKNOWN",
        "We could not complete the booking. Please try again.",
      ),
    );

    getBookingStatus.mockResolvedValue({
      bookingId: "booking-1",
      status: "confirmed",
      heldUntil: null,
      startTime: "2026-10-05T09:00:00Z",
      endTime: "2026-10-05T10:00:00Z",
    });

    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: /deep tissue massage/i,
      }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: "09:00",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Appointment held",
      }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Samuel Brown");
    await user.type(screen.getByLabelText("Contact"), "0240000000");

    await user.click(
      screen.getByRole("button", {
        name: "Confirm booking",
      }),
    );

    await waitFor(() => {
      expect(getBookingStatus).toHaveBeenCalledWith({
        bookingId: "booking-1",
        confirmationToken: "token-1",
      });
    });

    expect(
      await screen.findByRole("heading", {
        name: "Booking confirmed",
      }),
    ).toBeInTheDocument();
  });
  it("restores the held appointment when reconciliation reports the hold is still active", async () => {
    const user = userEvent.setup();

    createHold.mockResolvedValue({
      bookingId: "booking-1",
      confirmationToken: "token-1",
      heldUntil: "2026-10-05T09:05:00.000Z",
    });

    confirmHold.mockRejectedValue(
      new BookingError(
        "UNKNOWN",
        "We could not complete the booking. Please try again.",
      ),
    );

    getBookingStatus.mockResolvedValue({
      bookingId: "booking-1",
      status: "held",
      heldUntil: "2026-10-05T09:05:00.000Z",
      startTime: "2026-10-05T09:00:00Z",
      endTime: "2026-10-05T10:00:00Z",
    });

    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: /deep tissue massage/i,
      }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: "09:00",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Appointment held",
      }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Samuel Brown");
    await user.type(screen.getByLabelText("Contact"), "0240000000");

    await user.click(
      screen.getByRole("button", {
        name: "Confirm booking",
      }),
    );

    await waitFor(() => {
      expect(getBookingStatus).toHaveBeenCalledWith({
        bookingId: "booking-1",
        confirmationToken: "token-1",
      });
    });

    expect(
      await screen.findByRole("heading", {
        name: "Appointment held",
      }),
    ).toBeInTheDocument();
  });

  it("clears the persisted hold after successful confirmation", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: /deep tissue massage/i,
      }),
    );

    const slotButton = await screen.findByRole("button", { name: "09:00" });

    await user.click(slotButton);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /appointment held/i }),
      ).toBeInTheDocument();
    });

    expect(sessionStorage.getItem("spa_booking_active_hold")).not.toBeNull();

    await user.type(screen.getByLabelText(/name/i), "John Doe");
    await user.type(screen.getByLabelText(/contact/i), "0240000000");

    await user.click(screen.getByRole("button", { name: /confirm booking/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /booking confirmed/i }),
      ).toBeInTheDocument();
    });

    expect(sessionStorage.getItem("spa_booking_active_hold")).toBeNull();
  });
});
