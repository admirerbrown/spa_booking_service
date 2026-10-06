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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`;
}
function formatAppointmentDate(startTime: string): string {
  return new Date(startTime).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatAppointmentTime(startTime: string): string {
  return new Date(startTime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default function App() {
  const bookingApi = useMemo(() => createBookingApi(supabase), []);

  const bookingDate = useMemo(() => formatDate(new Date()), []);

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
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

        setServicesLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedServiceId) {
      setAvailableSlots([]);
      return;
    }

    setAvailabilityLoading(true);

    getAvailability(selectedServiceId, bookingDate).then((slots) => {
      setAvailableSlots(slots);
      setAvailabilityLoading(false);
    });
  }, [selectedServiceId, bookingDate, availabilityRefresh]);

  useEffect(() => {
    const storedHold = sessionStorage.getItem("spa_booking_active_hold");

    if (!storedHold) {
      return;
    }

    try {
      const parsed = JSON.parse(storedHold) as {
        serviceId: string;
        bookingId: string;
        confirmationToken: string;
        heldUntil: string;
        slot: AvailableSlot;
      };

      if (
        !parsed.serviceId ||
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

      setSelectedServiceId(parsed.serviceId);

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
            serviceId: selectedServiceId,
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

        {servicesLoading && (
          <p role="status" aria-label="Loading services">
            Loading services...
          </p>
        )}

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

      {availabilityLoading && (
        <p role="status" aria-label="Loading availability">
          Loading availability...
        </p>
      )}

      {!availabilityLoading &&
        selectedServiceId &&
        availableSlots.length === 0 && (
          <p role="status" aria-label="No appointments available">
            No appointments available.
          </p>
        )}

      {bookingFlow.status === "creating-hold" && (
        <p role="status" aria-label="Holding appointment">
          Holding appointment...
        </p>
      )}

      {availableSlots.length > 0 && (
        <section aria-labelledby="availability-heading">
          <h2 id="availability-heading">Choose a time</h2>

          <div>
            {availableSlots.map((slot) => (
              <button
                key={slot.startTime}
                type="button"
                aria-pressed={selectedSlot === slot.startTime}
                disabled={bookingFlow.status === "creating-hold"}
                onClick={() => {
                  setError(null);
                  setSelectedSlot(slot.startTime);

                  dispatch({
                    type: "SELECT_SLOT",
                    slot: {
                      therapistId: slot.therapistId,
                      startTime: `${bookingDate}T${slot.startTime}:00Z`,
                      endTime: `${bookingDate}T${slot.endTime}:00Z`,
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

      {(bookingFlow.status === "held" ||
        bookingFlow.status === "confirming") && (
        <section aria-labelledby="hold-heading">
          <h2 id="hold-heading">Appointment held</h2>

          {bookingFlow.status === "held" && remainingLabel && (
            <p role="timer">{remainingLabel}</p>
          )}

          {bookingFlow.status === "confirming" && (
            <p role="status" aria-label="Confirming booking">
              Confirming booking...
            </p>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();

              if (bookingFlow.status !== "held") {
                return;
              }

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
                disabled={bookingFlow.status === "confirming"}
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
                disabled={bookingFlow.status === "confirming"}
              />
            </div>

            <button
              type="submit"
              disabled={bookingFlow.status === "confirming"}
            >
              Confirm booking
            </button>
          </form>
        </section>
      )}

      {bookingFlow.status === "confirmed" && (
        <section aria-labelledby="confirmation-heading">
          <h2 id="confirmation-heading">Booking confirmed</h2>

          <p>Your appointment is confirmed.</p>

          <p>
            Service:{" "}
            {services.find((service) => service.id === selectedServiceId)?.name}
          </p>

          <p>Date: {formatAppointmentDate(bookingFlow.startTime)}</p>

          <p>Time: {formatAppointmentTime(bookingFlow.startTime)}</p>

          <p>Booking reference: {bookingFlow.bookingId}</p>
        </section>
      )}
    </main>
  );
}
