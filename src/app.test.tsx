import { render, screen } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const { getAvailability, createHold, confirmHold, getBookingStatus, from } =
  vi.hoisted(() => ({
    getAvailability: vi.fn(),
    createHold: vi.fn(),
    confirmHold: vi.fn(),
    getBookingStatus: vi.fn(),
    from: vi.fn(),
  }));

vi.mock("./lib/supabase", () => ({
  supabase: {
    from,
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

const services = [
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
];

function mockServicesRequest() {
  from.mockReturnValue({
    select: vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: services,
        error: null,
      }),
    })),
  });
}

describe("App", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, "", import.meta.env.BASE_URL);

    from.mockReset();
    mockServicesRequest();

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
      {
        therapistId: "therapist-1",
        startTime: "20:00",
        endTime: "21:00",
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

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("service and availability flow", () => {
    it("shows a loading state while services are being loaded", async () => {
      let resolveServices!: (value: {
        data: typeof services;
        error: null;
      }) => void;

      from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(
            () =>
              new Promise((resolve) => {
                resolveServices = resolve;
              }),
          ),
        })),
      });

      render(<App />);

      expect(
        screen.getByRole("status", { name: /loading services/i }),
      ).toBeInTheDocument();

      resolveServices({
        data: services,
        error: null,
      });

      expect(
        await screen.findByRole("button", {
          name: /deep tissue massage/i,
        }),
      ).toBeInTheDocument();
    });

    it("selects a service when the customer clicks it", async () => {
      const user = userEvent.setup();

      render(<App />);

      const service = await screen.findByRole("button", {
        name: /deep tissue massage/i,
      });

      await user.click(service);

      expect(window.location.pathname).toBe(
        `${import.meta.env.BASE_URL}treatments/deep-tissue-massage`,
      );
      expect(
        await screen.findByRole("heading", { name: "Choose a time" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Deep Tissue Massage")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /swedish massage/i }),
      ).not.toBeInTheDocument();
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
      expect(screen.getByText("9:00 AM")).toBeInTheDocument();
      expect(screen.getByText("8:00 PM")).toBeInTheDocument();
    });

    it("loads and holds a slot for a selected date within the next week", async () => {
      const user = userEvent.setup();
      const nextDay = new Date();
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDayISO = nextDay.toISOString().slice(0, 10);
      const nextDayLabel = nextDay.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });

      render(<App />);

      await user.click(
        await screen.findByRole("button", {
          name: /deep tissue massage/i,
        }),
      );

      await user.click(
        screen.getByRole("button", {
          name: nextDayLabel,
        }),
      );

      expect(getAvailability).toHaveBeenLastCalledWith("service-1", nextDayISO);

      await user.click(await screen.findByRole("button", { name: "09:00" }));

      expect(
        await screen.findByRole("heading", { name: "Appointment held" }),
      ).toBeInTheDocument();
      expect(createHold).toHaveBeenCalledWith({
        serviceId: "service-1",
        therapistId: "therapist-1",
        startTime: `${nextDayISO}T09:00:00Z`,
      });
    });

    it("shows an error instead of leaving availability loading when times fail to load", async () => {
      getAvailability.mockRejectedValueOnce(new Error("Availability unavailable"));

      const user = userEvent.setup();
      render(<App />);

      await user.click(
        await screen.findByRole("button", {
          name: /deep tissue massage/i,
        }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /appointment times could not be loaded/i,
      );
      expect(
        screen.queryByRole("status", { name: /loading availability/i }),
      ).not.toBeInTheDocument();
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
        startTime: "2026-10-06T09:00:00Z",
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

    it("uses the current date for availability and booking holds", async () => {
      vi.setSystemTime(new Date("2026-10-06T09:00:00Z"));

      const user = userEvent.setup();

      createHold.mockResolvedValue({
        bookingId: "booking-current-date",
        confirmationToken: "token-current-date",
        heldUntil: "2026-10-06T09:05:00Z",
      });

      render(<App />);

      await user.click(
        await screen.findByRole("button", {
          name: /deep tissue massage/i,
        }),
      );

      expect(getAvailability).toHaveBeenCalledWith("service-1", "2026-10-06");

      const slot = await screen.findByRole("button", {
        name: "09:00",
      });

      await user.click(slot);

      expect(createHold).toHaveBeenCalledWith({
        serviceId: "service-1",
        therapistId: "therapist-1",
        startTime: "2026-10-06T09:00:00Z",
      });
    });
  });

  it("shows a loading state while availability is being loaded", async () => {
    let resolveAvailability!: (
      value: {
        therapistId: string;
        startTime: string;
        endTime: string;
      }[],
    ) => void;

    vi.mocked(getAvailability).mockReturnValue(
      new Promise((resolve) => {
        resolveAvailability = resolve;
      }),
    );

    render(<App />);

  await userEvent.click(
    await screen.findByRole("button", {
      name: /deep tissue massage/i,
    }),
  );

    expect(
      screen.getByRole("status", { name: /loading availability/i }),
    ).toBeInTheDocument();

    resolveAvailability([
      {
        therapistId: "therapist-1",
        startTime: "09:00",
        endTime: "10:00",
      },
    ]);

    expect(
      await screen.findByRole("button", { name: "09:00" }),
    ).toBeInTheDocument();
  });
  it("shows a message when no appointment times are available", async () => {
    vi.mocked(getAvailability).mockResolvedValue([]);

    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", {
        name: /deep tissue massage/i,
      }),
    );

    expect(
      await screen.findByRole("status", {
        name: /no appointments available/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows three rated guest testimonials and the spa contact details", async () => {
    render(<App />);

    expect(
      await screen.findByText(
        /from the first hello, everything felt calm and considered/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the massage was exactly what i needed/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a beautiful little pause in a busy week/i),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/out of 5 stars/)).toHaveLength(3);
    expect(
      screen.queryByRole("button", {
        name: /previous guest testimonial|next guest testimonial|pause guest testimonial autoplay/i,
      }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "+233 002 882 4444" })).toHaveAttribute(
      "href",
      "tel:+2330028824444",
    );
    expect(screen.getByRole("link", { name: "solstill@gh.com" })).toHaveAttribute(
      "href",
      "mailto:solstill@gh.com",
    );
    expect(screen.getByText("Accra-Tessano, Accra")).toBeInTheDocument();
    expect(
      screen.getByText("Monday–Saturday, 9:00 am–9:00 pm"),
    ).toBeInTheDocument();
  });
});
