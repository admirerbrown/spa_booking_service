import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import App from "./App";

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
});
