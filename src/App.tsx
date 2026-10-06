import { useEffect, useMemo, useReducer, useState } from "react";
import type { FormEvent } from "react";

import {
  bookingFlowReducer,
  initialBookingFlowState,
} from "./domain/bookingFlow";

import { getAvailability } from "./lib/availabilityApi";
import { BookingError, createBookingApi } from "./lib/bookingApi";
import { supabase } from "./lib/supabase";
import { AvailabilityPicker } from "./components/booking/AvailabilityPicker";
import { BookingAside } from "./components/booking/BookingAside";
import { BookingConfirmation } from "./components/booking/BookingConfirmation";
import { BookingDetailsForm } from "./components/booking/BookingDetailsForm";
import { BookingHeader } from "./components/booking/BookingHeader";
import { ServicePicker } from "./components/booking/ServicePicker";
import type { AvailableSlot, Service } from "./types/booking";

import "./app.css";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`;
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

  const isConfirmed = bookingFlow.status === "confirmed";
  const isHeld = bookingFlow.status === "held";
  const isConfirming = bookingFlow.status === "confirming";
  const isReconciling = bookingFlow.status === "reconciling";
  const isBookingDetailsVisible = isHeld || isConfirming;
  const activeStep: 1 | 2 | 3 =
    isConfirmed || isBookingDetailsVisible || isReconciling
      ? 3
      : selectedServiceId
        ? 2
        : 1;

  function handleSubmitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (bookingFlow.status !== "held") {
      return;
    }

    dispatch({
      type: "SUBMIT_DETAILS",
      name: customerName,
      contact: customerContact,
    });
  }

  return (
    <div className="min-h-screen bg-ivory-100 text-forest-950">
      <BookingHeader activeStep={activeStep} />

      <main
        id="booking"
        className="mx-auto grid max-w-7xl gap-8 px-5 pb-16 pt-2 sm:px-8 sm:pb-24 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-14"
      >
        <div className="min-w-0 space-y-9 sm:space-y-11">
          {error && (
            <p
              role="alert"
              className="animate-[rise-in_350ms_ease-out] rounded-xl border border-[#b66a50]/20 bg-[#fbefea] px-5 py-4 text-sm leading-6 text-[#7d3c2b]"
            >
              {error}
            </p>
          )}

          {bookingFlow.status === "creating-hold" && (
            <p
              role="status"
              aria-label="Holding appointment"
              className="flex items-center gap-3 rounded-xl bg-white/75 px-5 py-4 text-sm text-forest-800/75 shadow-sm"
            >
              <span className="loading-orb" aria-hidden="true" />
              Holding appointment…
            </p>
          )}

          {isReconciling && (
            <p
              role="status"
              aria-label="Restoring booking"
              className="flex items-center gap-3 rounded-xl bg-white/75 px-5 py-4 text-sm text-forest-800/75 shadow-sm"
            >
              <span className="loading-orb" aria-hidden="true" />
              Gently restoring your reservation…
            </p>
          )}

          {!isConfirmed && (
            <ServicePicker
              services={services}
              selectedServiceId={selectedServiceId}
              isLoading={servicesLoading}
              onSelect={(serviceId) => {
                setError(null);
                setSelectedServiceId(serviceId);
                setSelectedSlot(null);
              }}
            />
          )}

          {!isConfirmed && (
            <AvailabilityPicker
              slots={availableSlots}
              selectedSlot={selectedSlot}
              hasSelectedService={Boolean(selectedServiceId)}
              isLoading={availabilityLoading}
              isCreatingHold={bookingFlow.status === "creating-hold"}
              onSelect={(slot) => {
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
            />
          )}

          {isBookingDetailsVisible && (
            <BookingDetailsForm
              isConfirming={isConfirming}
              customerName={customerName}
              customerContact={customerContact}
              remainingLabel={remainingLabel}
              onNameChange={setCustomerName}
              onContactChange={setCustomerContact}
              onSubmit={handleSubmitDetails}
            />
          )}

          {isConfirmed && (
            <BookingConfirmation
              bookingId={bookingFlow.bookingId}
              startTime={bookingFlow.startTime}
              serviceName={
                services.find((service) => service.id === selectedServiceId)
                  ?.name
              }
            />
          )}
        </div>

        {!isConfirmed && (
          <BookingAside
            hasSelectedService={Boolean(selectedServiceId)}
            hasSelectedTime={Boolean(selectedSlot)}
            isHeld={isHeld || isConfirming}
          />
        )}
      </main>

      <footer className="border-t border-forest-900/10 px-5 py-6 text-center sm:px-8">
        <a
          href="#home"
          className="font-serif text-[15px] tracking-[0.12em] text-forest-900"
        >
          SOL <span className="text-brass-600">&</span> STILL
        </a>
        <p className="mt-1 text-[9px] uppercase tracking-[0.17em] text-forest-800/45">
          Thoughtful care, naturally · Accra, Ghana
        </p>
      </footer>
    </div>
  );
}
