import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import App from "./App";
import { BookingError } from "./lib/bookingApi";

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
  getAvailability: vi.fn().mockResolvedValue([
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
  ]),
}));

const createHold = vi.fn().mockResolvedValue({
  bookingId: "booking-default",
  confirmationToken: "token-default",
  heldUntil: "2026-10-05T09:05:00Z",
});

vi.mock("./lib/bookingApi", () => {
  class BookingError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
      super(message);
      this.name = "BookingError";
      this.code = code;
    }
  }

  return {
    BookingError,
    createBookingApi: () => ({
      createHold,
      confirmHold: vi.fn(),
      getBookingStatus: vi.fn(),
    }),
  };
});

describe("App", () => {
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

    createHold.mockClear();

    render(<App />);

    const service = await screen.findByRole("button", {
      name: /deep tissue massage/i,
    });

    await user.click(service);

    const slot = await screen.findByRole("button", { name: "09:00" });

    await user.click(slot);

    expect(slot).toHaveAttribute("aria-pressed", "true");
  });

  it("creates a hold when the user selects an available slot", async () => {
    const user = userEvent.setup();

    createHold.mockClear();
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

    createHold.mockClear();
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

    createHold.mockClear();
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
});
