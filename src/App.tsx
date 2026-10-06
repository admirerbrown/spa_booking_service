import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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

function treatmentSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function appBasePath(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).pathname;
}

function treatmentPath(name: string): string {
  return `${appBasePath()}treatments/${treatmentSlug(name)}`;
}

function selectedTreatmentSlug(): string | null {
  const basePath = appBasePath();
  const path = window.location.pathname.startsWith(basePath)
    ? window.location.pathname.slice(basePath.length)
    : "";
  const match = path.match(/^treatments\/([^/]+)\/?$/);

  return match ? match[1] : null;
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return formatDate(result);
}

function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`;
}

export default function App() {
  const bookingApi = useMemo(() => createBookingApi(supabase), []);

  const todayDate = useMemo(() => formatDate(new Date()), []);
  const bookingDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(todayDate, index)),
    [todayDate],
  );
  const [bookingDate, setBookingDate] = useState(todayDate);

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [bookingPage, setBookingPage] = useState<"treatments" | "availability">(
    "treatments",
  );
  const previousBookingPage = useRef(bookingPage);
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
    if (previousBookingPage.current === bookingPage) {
      return;
    }

    previousBookingPage.current = bookingPage;
    const targetId =
      bookingPage === "availability" ? "booking" : "services-heading";
    document.getElementById(targetId)?.focus();
    document.body.scrollIntoView?.({ block: "start" });
  }, [bookingPage]);

  useEffect(() => {
    if (services.length === 0) return;

    function restoreRoute() {
      const slug = selectedTreatmentSlug();
      const service = services.find(
        (candidate) => treatmentSlug(candidate.name) === slug,
      );

      if (service) {
        setSelectedServiceId(service.id);
        setBookingPage("availability");
        return;
      }

      if (bookingFlow.status !== "selecting-slot") return;

      setSelectedServiceId(null);
      setSelectedSlot(null);
      setBookingPage("treatments");
    }

    if (selectedTreatmentSlug()) {
      restoreRoute();
    }
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, [bookingFlow.status, services]);

  useEffect(() => {
    let isActive = true;

    async function loadServices() {
      try {
        const { data, error: queryError } = await supabase
          .from("services")
          .select("id, name, description, duration_minutes, price")
          .order("name");

        if (!isActive) return;

        if (queryError) {
          setError("Services could not be loaded. Please try again later.");
        } else {
          setServices(data ?? []);
        }
      } catch {
        if (isActive) {
          setError("Services could not be loaded. Please try again later.");
        }
      } finally {
        if (isActive) setServicesLoading(false);
      }
    }

    void loadServices();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedServiceId) {
      setAvailableSlots([]);
      setAvailabilityLoading(false);
      return;
    }

    let isActive = true;
    setAvailabilityLoading(true);

    getAvailability(selectedServiceId, bookingDate)
      .then((slots) => {
        if (isActive) setAvailableSlots(slots);
      })
      .catch(() => {
        if (isActive) {
          setAvailableSlots([]);
          setError("Appointment times could not be loaded. Please try again.");
        }
      })
      .finally(() => {
        if (isActive) setAvailabilityLoading(false);
      });

    return () => {
      isActive = false;
    };
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
      setBookingDate(parsed.slot.startTime.slice(0, 10));
      setBookingPage("availability");

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
  const selectedService = services.find(
    (service) => service.id === selectedServiceId,
  );
  const activeStep: 1 | 2 | 3 =
    isConfirmed || isBookingDetailsVisible || isReconciling
      ? 3
      : bookingPage === "availability"
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

  function returnToTreatments() {
    window.history.pushState(null, "", appBasePath());
    setBookingPage("treatments");
  }

  return (
    <div className="min-h-screen bg-ivory-100 text-forest-950">
      <BookingHeader
        activeStep={activeStep}
        isConfirmed={isConfirmed}
        showHero={bookingPage === "treatments"}
        onBackToTreatments={returnToTreatments}
      />

      {bookingPage === "treatments" && (
        <section
          id="about"
          aria-labelledby="about-heading"
          className="mx-auto grid max-w-7xl gap-8 border-y border-forest-900/10 bg-white/35 px-5 py-8 sm:px-8 sm:py-10 md:grid-cols-[0.85fr_1.15fr] md:items-center md:gap-14"
        >
          <div className="relative overflow-hidden rounded-3xl bg-forest-900 px-6 py-5 text-ivory-50 sm:px-8 sm:py-6">
            <span
              aria-hidden="true"
              className="absolute -right-10 -top-12 size-48 rounded-full border border-white/10"
            />
            <span
              aria-hidden="true"
              className="absolute -right-2 -top-4 size-32 rounded-full border border-white/10"
            />
            <p className="relative section-kicker text-brass-200">
              A sanctuary in Accra
            </p>
            <p className="relative mt-4 font-serif text-[28px] leading-[1.08] tracking-[-0.03em] sm:text-[34px]">
              Come as you are.
              <br />
              Leave a little lighter.
            </p>
            <p className="relative mt-3 max-w-sm text-xs leading-5 text-ivory-100/70">
              SOL &amp; STILL is a space to pause, reset, and receive thoughtful
              care at your own pace.
            </p>

            <div className="relative mt-4 overflow-hidden rounded-[1.2rem] border border-white/10 shadow-[0_16px_34px_rgba(0,0,0,0.15)]">
              <img
                src="https://static.wixstatic.com/media/52b3f5_165fee3db0aa468bbcf6af64cfc754ce~mv2_d_2000_1335_s_2.jpg/v1/fill/w_980,h_307,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/52b3f5_165fee3db0aa468bbcf6af64cfc754ce~mv2_d_2000_1335_s_2.jpg"
                alt="Customer receiving a massage in a calm spa setting"
                className="h-40 w-full object-cover sm:h-44"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-950/45 via-transparent to-transparent" />
            </div>
          </div>
          <div className="max-w-xl">
            <p className="section-kicker">About SOL &amp; STILL</p>
            <h2
              id="about-heading"
              className="mt-3 font-serif text-[30px] font-normal leading-tight tracking-[-0.035em] text-forest-950 sm:text-[38px]"
            >
              Wellbeing, with room to breathe.
            </h2>
            <p className="mt-4 text-sm leading-7 text-forest-800/70">
              We believe care should feel personal, never hurried. Our
              considered treatments pair skilled hands with a calm, welcoming
              setting, giving you space to reconnect with yourself.
            </p>
            <div className="mt-6 grid gap-4 border-t border-forest-900/10 pt-5 sm:grid-cols-2">
              <div>
                <p className="font-serif text-[17px] text-forest-950">
                  Thoughtfully tailored
                </p>
                <p className="mt-1 text-xs leading-5 text-forest-800/60">
                  Care shaped around what you need today.
                </p>
              </div>
              <div>
                <p className="font-serif text-[17px] text-forest-950">
                  Always unhurried
                </p>
                <p className="mt-1 text-xs leading-5 text-forest-800/60">
                  A welcoming pause, from arrival to goodbye.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <main
        id="booking"
        tabIndex={-1}
        aria-label={
          bookingPage === "availability" ? "Choose an appointment time" : undefined
        }
        className={`mx-auto grid max-w-7xl gap-8 px-5 pb-16 sm:px-8 sm:pb-24 ${
          isConfirmed
            ? "lg:grid-cols-1"
            : "lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-14"
        } ${
          bookingPage === "treatments"
            ? "bg-[#f8f5ee] pt-12 sm:pt-16"
            : "pt-8 sm:pt-10"
        }`}
      >
        <div
          className={`min-w-0 space-y-9 sm:space-y-11 ${
            isConfirmed ? "mx-auto w-full max-w-3xl" : ""
          }`}
        >
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

          {!isConfirmed && bookingPage === "treatments" && (
            <ServicePicker
              services={services}
              selectedServiceId={selectedServiceId}
              isLoading={servicesLoading}
              onSelect={(serviceId) => {
                setError(null);
                const service = services.find(
                  (candidate) => candidate.id === serviceId,
                );
                if (!service) {
                  setError("That treatment could not be found. Please try again.");
                  return;
                }

                window.history.pushState(
                  null,
                  "",
                  treatmentPath(service.name),
                );
                setSelectedServiceId(serviceId);
                setSelectedSlot(null);
                setBookingPage("availability");
              }}
            />
          )}

          {!isConfirmed && bookingPage === "availability" && (
            <section
              aria-labelledby="selected-ritual-heading"
              className="booking-section overflow-hidden rounded-[1.35rem] border border-forest-900/10 bg-[#fffdf8] shadow-[0_12px_34px_rgba(42,56,43,0.07)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-5 bg-forest-950 px-5 py-6 text-ivory-50 sm:px-7">
                <div className="max-w-2xl">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass-300">
                    Your selected treatment
                  </p>
                  <h2
                    id="selected-ritual-heading"
                    className="mt-2 font-serif text-[28px] leading-tight sm:text-[32px]"
                  >
                    {selectedService?.name ?? "Your selected treatment"}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-ivory-100/70">
                    {selectedService?.description}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Change treatment"
                  onClick={returnToTreatments}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-ivory-50 transition-colors hover:border-brass-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 focus-visible:ring-offset-2 focus-visible:ring-offset-forest-950"
                >
                  <span>Change treatment</span>
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
              {selectedService && (
                <div className="grid gap-px bg-forest-900/10 sm:grid-cols-2">
                  <div className="bg-[#fffdf8] p-5 sm:p-6">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brass-700">
                      Booking
                    </p>
                    <p className="mt-2 text-xs leading-5 text-forest-800/75">
                      Choose an available time. It will be held for up to five
                      minutes while you enter your details; this temporary hold
                      is not a confirmed reservation.
                    </p>
                  </div>
                  <div className="bg-[#fffdf8] p-5 sm:p-6">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brass-700">
                      Payment &amp; reservation
                    </p>
                    <p className="mt-2 text-xs leading-5 text-forest-800/75">
                      Your appointment is reserved only after payment is
                      completed. Payment is not collected in this booking flow
                      yet.
                    </p>
                  </div>
                </div>
              )}
              {selectedService && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-forest-900/10 bg-ivory-100/65 px-5 py-4 sm:px-7">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-forest-800/50">
                    Treatment details
                  </span>
                  <span className="text-xs font-medium text-forest-800/75">
                    {selectedService.duration_minutes} minutes
                  </span>
                  <span className="font-serif text-base text-forest-950">
                    GHS {Number(selectedService.price).toFixed(2)}
                  </span>
                </div>
              )}
            </section>
          )}

          {!isConfirmed && bookingPage === "availability" && (
            <AvailabilityPicker
              slots={availableSlots}
              dates={bookingDates}
              selectedDate={bookingDate}
              selectedSlot={selectedSlot}
              hasSelectedService={Boolean(selectedServiceId)}
              isLoading={availabilityLoading}
              isCreatingHold={
                bookingFlow.status === "creating-hold" ||
                isBookingDetailsVisible ||
                isReconciling
              }
              onDateChange={(date) => {
                setError(null);
                setSelectedSlot(null);
                setBookingDate(date);
              }}
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
              durationMinutes={selectedService?.duration_minutes}
              onReturnHome={() => {
                dispatch({ type: "START_NEW_BOOKING" });
                setSelectedServiceId(null);
                setSelectedSlot(null);
                setCustomerName("");
                setCustomerContact("");
                setError(null);
                window.history.pushState(null, "", appBasePath());
                setBookingPage("treatments");
              }}
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

      {bookingPage === "treatments" && <section
        aria-labelledby="testimonials-heading"
        className="border-y border-forest-900/10 bg-white/35 px-5 py-14 sm:px-8 sm:py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-8 max-w-xl text-center sm:mb-10">
            <p className="section-kicker">A moment to exhale</p>
            <h2
              id="testimonials-heading"
              className="mt-2 font-serif text-[30px] font-normal tracking-[-0.035em] text-forest-950 sm:text-[38px]"
            >
              A softer kind of care.
            </h2>
            <p className="mt-3 text-sm leading-6 text-forest-800/65">
              Thoughtful touches make all the difference.
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-forest-800/45">
              Sample guest notes
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                quote:
                  "From the first hello, everything felt calm and considered. I left feeling lighter.",
                treatment: "A moment of calm",
              },
              {
                quote:
                  "The massage was exactly what I needed — unhurried, thoughtful, and deeply restorative.",
                treatment: "Time to unwind",
              },
              {
                quote:
                  "A beautiful little pause in a busy week. I’m already looking forward to coming back.",
                treatment: "A welcome reset",
              },
            ].map((testimonial) => (
              <figure
                key={testimonial.treatment}
                className="flex min-h-52 flex-col rounded-2xl border border-forest-900/10 bg-ivory-50/80 p-6 shadow-[0_6px_20px_rgba(42,56,43,0.035)] sm:p-7"
              >
                <span
                  aria-hidden="true"
                  className="font-serif text-3xl leading-none text-brass-500"
                >
                  “
                </span>
                <blockquote className="mt-3 flex-1 font-serif text-[17px] leading-7 text-forest-950">
                  {testimonial.quote}
                </blockquote>
                <figcaption className="mt-5 border-t border-forest-900/10 pt-4 text-[9px] font-semibold uppercase tracking-[0.15em] text-forest-800/55">
                  {testimonial.treatment}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>}

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
