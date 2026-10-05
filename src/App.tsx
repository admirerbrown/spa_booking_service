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

  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");

  const [bookingFlow, dispatch] = useReducer(
    bookingFlowReducer,
    initialBookingFlowState,
  );

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
    const storedHold = sessionStorage.getItem("spa_booking_active_hold");

    if (!storedHold) {
      return;
    }

    try {
      const parsed = JSON.parse(storedHold) as {
        bookingId: string;
        confirmationToken: string;
        heldUntil: string;
        slot: AvailableSlot;
      };

      if (
        !parsed.bookingId ||
        !parsed.confirmationToken ||
        !parsed.heldUntil ||
        !parsed.slot?.therapistId ||
        !parsed.slot?.startTime ||
        !parsed.slot?.endTime
      ) {
        sessionStorage.removeItem("spa_booking_active_hold");
        return;
      }

      dispatch({
        type: "RESTORE_HOLD",
        bookingId: parsed.bookingId,
        confirmationToken: parsed.confirmationToken,
        slot: {
          therapistId: parsed.slot.therapistId,
          startTime: parsed.slot.startTime,
          endTime: parsed.slot.endTime,
        },
      });
    } catch {
      sessionStorage.removeItem("spa_booking_active_hold");
    }
  }, []);

  useEffect(() => {
    if (bookingFlow.status !== "reconciling") {
      return;
    }

    void bookingApi
      .getBookingStatus({
        bookingId: bookingFlow.bookingId,
        confirmationToken: bookingFlow.confirmationToken,
      })
      .then((status) => {
        if (status.status === "held" && status.heldUntil) {
          dispatch({
            type: "STATUS_HELD",
            heldUntil: status.heldUntil,
          });
          return;
        }

        if (status.status === "confirmed") {
          sessionStorage.removeItem("spa_booking_active_hold");

          dispatch({
            type: "STATUS_CONFIRMED",
            startTime: status.startTime,
            endTime: status.endTime,
          });
        }
      })
      .catch(() => {
        sessionStorage.removeItem("spa_booking_active_hold");
        setError("Your previous booking could not be restored.");
        dispatch({ type: "ACKNOWLEDGE_EXPIRY" });
      });
  }, [bookingApi, bookingFlow]);

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
        sessionStorage.setItem(
          "spa_booking_active_hold",
          JSON.stringify({
            bookingId: hold.bookingId,
            confirmationToken: hold.confirmationToken,
            heldUntil: hold.heldUntil,
            slot: bookingFlow.slot,
          }),
        );

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
    if (bookingFlow.status !== "confirming") {
      return;
    }

    void bookingApi
      .confirmHold({
        bookingId: bookingFlow.bookingId,
        confirmationToken: bookingFlow.confirmationToken,
        name: bookingFlow.name,
        contact: bookingFlow.contact,
      })
      .then((booking) => {
        sessionStorage.removeItem("spa_booking_active_hold");

        dispatch({
          type: "CONFIRM_SUCCESS",
          bookingId: booking.bookingId,
          startTime: booking.startTime,
          endTime: booking.endTime,
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
          type: "CONFIRM_FAILED",
          code: bookingError.code,
        });
      });
  }, [bookingApi, bookingFlow]);

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

    sessionStorage.removeItem("spa_booking_active_hold");

    setError("Your hold has expired. Please choose another time.");
    setSelectedSlot(null);
    dispatch({ type: "ACKNOWLEDGE_EXPIRY" });
  }, [bookingFlow]);

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
  }, [bookingFlow.status]);

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

          <form
            onSubmit={(event) => {
              event.preventDefault();

              dispatch({
                type: "SUBMIT_DETAILS",
                name: customerName,
                contact: customerContact,
              });
            }}
          >
            <div>
              <label htmlFor="customer-name">Name</label>

              <input
                id="customer-name"
                name="name"
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="customer-contact">Contact</label>

              <input
                id="customer-contact"
                name="contact"
                type="text"
                value={customerContact}
                onChange={(event) => setCustomerContact(event.target.value)}
              />
            </div>

            <button type="submit">Confirm booking</button>
          </form>
        </section>
      )}

      {bookingFlow.status === "confirmed" && (
        <section aria-labelledby="confirmation-heading">
          <h2 id="confirmation-heading">Booking confirmed</h2>

          <p>Your appointment is confirmed.</p>

          <p>Booking reference: {bookingFlow.bookingId}</p>
        </section>
      )}
    </main>
  );
}
