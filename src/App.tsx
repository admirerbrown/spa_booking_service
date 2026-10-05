import { useEffect, useMemo, useReducer, useState } from "react";

import {
  bookingFlowReducer,
  initialBookingFlowState,
} from "./domain/bookingFlow";
import { getAvailability } from "./lib/availabilityApi";
import { BookingError, createBookingApi } from "./lib/bookingApi";
import { supabase } from "./lib/supabase";

import "./app.css";

type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
};

type AvailableSlot = {
  therapistId: string;
  startTime: string;
  endTime: string;
};

function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`;
}

export default function App() {
  const bookingApi = useMemo(() => createBookingApi(supabase), []);

  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);

  const [bookingFlow, dispatch] = useReducer(
    bookingFlowReducer,
    initialBookingFlowState,
  );

  // Ticks once a second while a hold is active, purely to force the
  // remaining-time label below to recompute. The actual deadline lives in
  // bookingFlow.heldUntil.
  const [holdTick, setHoldTick] = useState(0);

  useEffect(() => {
    supabase
      .from("services")
      .select("id, name, description, duration_minutes, price")
      .order("name")
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError("Services could not be loaded. Please try again later.");
        } else {
          setServices(data ?? []);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedServiceId) {
      setAvailableSlots([]);
      return;
    }

    getAvailability(selectedServiceId, "2026-10-05").then((slots) => {
      setAvailableSlots(slots);
    });
  }, [selectedServiceId, availabilityRefresh]);

  useEffect(() => {
    if (bookingFlow.status !== "creating-hold") {
      return;
    }

    void bookingApi
      .createHold({
        serviceId: selectedServiceId!,
        therapistId: bookingFlow.slot.therapistId,
        startTime: bookingFlow.slot.startTime,
      })
      .then((hold) => {
        dispatch({
          type: "HOLD_CREATED",
          bookingId: hold.bookingId,
          confirmationToken: hold.confirmationToken,
          heldUntil: hold.heldUntil,
        });
      })
      .catch((cause: unknown) => {
        const bookingError =
          cause instanceof BookingError
            ? cause
            : new BookingError(
                "UNKNOWN",
                "We could not complete the booking. Please try again.",
              );

        dispatch({
          type: "HOLD_FAILED",
          code: bookingError.code,
        });
      });
  }, [bookingApi, bookingFlow, selectedServiceId]);

  useEffect(() => {
    if (bookingFlow.status !== "hold-failed") {
      return;
    }

    if (bookingFlow.reason === "slot-unavailable") {
      setError(
        "That appointment is no longer available. Please choose another time.",
      );
    } else {
      setError("We could not hold that appointment. Please try again.");
    }

    setSelectedSlot(null);
    setAvailabilityRefresh((current) => current + 1);
    dispatch({ type: "ACKNOWLEDGE_FAILURE" });
  }, [bookingFlow]);

  useEffect(() => {
    if (bookingFlow.status !== "hold-expired") {
      return;
    }

    setError("Your hold has expired. Please choose another time.");
    setSelectedSlot(null);
    dispatch({ type: "ACKNOWLEDGE_EXPIRY" });
  }, [bookingFlow]);

  // Drive the countdown and proactively expire the hold when its deadline
  // is reached. The server remains authoritative when confirmation happens.
  useEffect(() => {
    if (bookingFlow.status !== "held") {
      return;
    }

    const interval = setInterval(() => {
      const remainingMs =
        new Date(bookingFlow.heldUntil).getTime() - Date.now();

      if (remainingMs <= 0) {
        dispatch({ type: "HOLD_EXPIRED" });
        return;
      }

      setHoldTick((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [bookingFlow.status, bookingFlow.heldUntil]);

  const remainingLabel = useMemo(() => {
    if (bookingFlow.status !== "held") {
      return null;
    }

    const remainingMs = new Date(bookingFlow.heldUntil).getTime() - Date.now();

    return formatRemaining(remainingMs);

    // holdTick forces recomputation each second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingFlow, holdTick]);

  return (
    <main className="page-shell">
      <header>
        <p className="eyebrow">THERAPIST BOOKING</p>

        <h1>Make time for yourself.</h1>

        <p className="lede">
          Choose a treatment, therapist, and time that works for you.
        </p>
      </header>

      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}

      <section aria-labelledby="services-heading">
        <h2 id="services-heading">Choose a service</h2>

        <div className="service-grid">
          {services.map((service) => (
            <button
              type="button"
              className="service-card"
              key={service.id}
              aria-pressed={selectedServiceId === service.id}
              onClick={() => {
                setError(null);
                setSelectedServiceId(service.id);
                setSelectedSlot(null);
              }}
            >
              <h3>{service.name}</h3>

              <p>{service.description}</p>

              <footer>
                <span>{service.duration_minutes} min</span>
                <strong>GHS {Number(service.price).toFixed(2)}</strong>
              </footer>
            </button>
          ))}
        </div>
      </section>

      {availableSlots.length > 0 && (
        <section aria-labelledby="availability-heading">
          <h2 id="availability-heading">Choose a time</h2>

          <div>
            {availableSlots.map((slot) => (
              <button
                key={slot.startTime}
                type="button"
                aria-pressed={selectedSlot === slot.startTime}
                onClick={() => {
                  setError(null);
                  setSelectedSlot(slot.startTime);

                  dispatch({
                    type: "SELECT_SLOT",
                    slot: {
                      therapistId: slot.therapistId,
                      startTime: `2026-10-05T${slot.startTime}:00Z`,
                      endTime: `2026-10-05T${slot.endTime}:00Z`,
                    },
                  });
                }}
              >
                {slot.startTime}
              </button>
            ))}
          </div>
        </section>
      )}

      {bookingFlow.status === "held" && (
        <section aria-labelledby="hold-heading">
          <h2 id="hold-heading">Appointment held</h2>

          {remainingLabel && <p role="timer">{remainingLabel}</p>}
        </section>
      )}
    </main>
  );
}
