import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { FormEvent } from "react";

import aboutImage from "./assets/about-image.jpeg";
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
import { validateCustomerDetails } from "./domain/booking";
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

const testimonials = [
  {
    quote:
      "From the first hello, everything felt calm and considered. I left feeling lighter.",
    treatment: "A moment of calm",
    rating: 5,
  },
  {
    quote:
      "The massage was exactly what I needed — unhurried, thoughtful, and deeply restorative.",
    treatment: "Time to unwind",
    rating: 5,
  },
  {
    quote:
      "A beautiful little pause in a busy week. I’m already looking forward to coming back.",
    treatment: "A welcome reset",
    rating: 4,
  },
  {
    quote:
      "Every detail felt welcoming, and I left with a sense of calm that lasted all day.",
    treatment: "Room to recharge",
    rating: 5,
  },
  {
    quote:
      "Such a thoughtful experience from start to finish. I can’t wait for my next visit.",
    treatment: "A little self-care",
    rating: 4,
  },
];

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
  const [customerDetailsErrors, setCustomerDetailsErrors] = useState<{
    name?: string;
    contact?: string;
  }>({});

  const [bookingFlow, dispatch] = useReducer(
    bookingFlowReducer,
    initialBookingFlowState,
  );

  const [holdTick, setHoldTick] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [isReleasingHold, setIsReleasingHold] = useState(false);

  useEffect(() => {
    if (
      bookingPage !== "treatments" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveTestimonial((current) => (current + 1) % testimonials.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [activeTestimonial, bookingPage]);

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

    const validation = validateCustomerDetails({
      name: customerName,
      contact: customerContact,
    });

    if (!validation.valid) {
      setCustomerDetailsErrors(validation.errors);
      return;
    }

    setCustomerDetailsErrors({});

    dispatch({
      type: "SUBMIT_DETAILS",
      name: customerName,
      contact: customerContact,
    });
  }

  async function handleReleaseHold() {
    if (bookingFlow.status !== "held" || isReleasingHold) {
      return;
    }

    setIsReleasingHold(true);
    setError(null);

    try {
      await bookingApi.releaseHold({
        bookingId: bookingFlow.bookingId,
        confirmationToken: bookingFlow.confirmationToken,
      });

      sessionStorage.removeItem("spa_booking_active_hold");
      setSelectedSlot(null);
      setCustomerName("");
      setCustomerContact("");
      setCustomerDetailsErrors({});
      setAvailabilityRefresh((current) => current + 1);
      dispatch({ type: "START_NEW_BOOKING" });
    } catch (cause: unknown) {
      const bookingError =
        cause instanceof BookingError
          ? cause
          : new BookingError(
              "UNKNOWN",
              "We could not release your reservation. Please try again.",
            );
      setError(bookingError.message);
    } finally {
      setIsReleasingHold(false);
    }
  }

  function returnToTreatments() {
    window.history.pushState(null, "", appBasePath());
    setBookingPage("treatments");
  }

  return (
    <div id="page-top" className="min-h-screen bg-ivory-100 text-forest-950">
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
                src={aboutImage}
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
                      Online payment is not available in this booking flow yet.
                      Your appointment is confirmed when you submit your
                      details.
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
              isReleasingHold={isReleasingHold}
              customerName={customerName}
              customerContact={customerContact}
              remainingLabel={remainingLabel}
              nameError={customerDetailsErrors.name}
              contactError={customerDetailsErrors.contact}
              onNameChange={(value) => {
                setCustomerName(value);
                setCustomerDetailsErrors((current) => ({
                  ...current,
                  name: undefined,
                }));
              }}
              onContactChange={(value) => {
                setCustomerContact(value);
                setCustomerDetailsErrors((current) => ({
                  ...current,
                  contact: undefined,
                }));
              }}
              onSubmit={handleSubmitDetails}
              onCancel={() => void handleReleaseHold()}
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
                setCustomerDetailsErrors({});
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
            isHeld={isHeld}
            alignWithTreatmentCards={bookingPage === "treatments"}
          />
        )}
      </main>

      {bookingPage === "treatments" && <section
        aria-labelledby="testimonials-heading"
        className="relative overflow-hidden border-y border-forest-900/10 bg-[#f8f5ee] px-5 py-16 sm:px-8 sm:py-22"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 size-96 rounded-full border border-forest-900/[0.06]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-18 size-64 rounded-full border border-forest-900/[0.06]"
        />
        <div className="mx-auto max-w-7xl">
          <div className="relative mx-auto mb-10 max-w-xl text-center sm:mb-12">
            <p className="inline-flex items-center gap-3 rounded-full border border-brass-500/35 bg-ivory-50/60 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-forest-800/70">
              <span aria-hidden="true" className="text-brass-600">✳</span>
              Cleint testimonials
              <span aria-hidden="true" className="text-brass-600">✳</span>
            </p>
            <h2
              id="testimonials-heading"
              className="mt-4 font-serif text-[34px] font-normal leading-tight tracking-[-0.04em] text-forest-950 sm:text-[44px]"
            >
              A softer kind of care.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-forest-800/70">
              Thoughtful touches make all the difference.
            </p>
          </div>

          <div
            aria-label="Guest testimonials"
            aria-roledescription="carousel"
            className="relative mx-auto max-w-5xl"
          >
            <div
              aria-live="off"
              className="grid grid-cols-3 gap-3 sm:gap-5"
            >
              {Array.from({ length: 3 }, (_, cardOffset) => {
                const testimonialIndex =
                  (activeTestimonial + cardOffset) % testimonials.length;
                const testimonial = testimonials[testimonialIndex];

                return (
                  <figure
                    key={testimonial.treatment}
                    aria-label={`Guest note ${testimonialIndex + 1} of ${testimonials.length}`}
                    className="flex min-h-64 min-w-0 flex-col overflow-hidden rounded-b-[1.35rem] border border-forest-900/10 bg-[#f5f0e7] p-3 shadow-[0_8px_24px_rgba(42,56,43,0.045)] transition-all duration-500 hover:-translate-y-1 hover:border-forest-900/25 hover:shadow-[0_20px_48px_rgba(42,56,43,0.11)] sm:min-h-72 sm:p-7"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        aria-hidden="true"
                        className="font-serif text-4xl leading-none text-brass-500"
                      >
                        “
                      </span>
                      <span className="text-[8px] uppercase tracking-[0.1em] text-forest-800/50 sm:text-[9px] sm:tracking-[0.16em]">
                        Guest note {testimonialIndex + 1} of {testimonials.length}
                      </span>
                    </div>
                    <div
                      aria-label={`${testimonial.rating} out of 5 stars`}
                      className="mt-4 flex gap-1 text-brass-600"
                    >
                      {Array.from({ length: 5 }, (_, starIndex) => (
                        <span
                          key={starIndex}
                          aria-hidden="true"
                          className={
                            starIndex < testimonial.rating
                              ? "opacity-100"
                              : "opacity-30"
                          }
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <blockquote className="mt-3 flex-1 font-serif text-sm leading-6 text-forest-950 sm:text-[20px] sm:leading-7">
                      {testimonial.quote}
                    </blockquote>
                    <figcaption className="mt-5 flex items-center gap-2 border-t border-forest-900/10 pt-4 text-[8px] font-semibold uppercase tracking-[0.08em] text-forest-800/60 sm:gap-3 sm:text-[9px] sm:tracking-[0.15em]">
                      <span
                        aria-hidden="true"
                        className="h-px w-6 bg-brass-500/70"
                      />
                      {testimonial.treatment}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </div>
      </section>}

      <footer className="border-t border-white/10 bg-forest-950 px-5 py-10 text-ivory-50 sm:px-8 sm:py-12">
        <div className="mx-auto grid max-w-7xl gap-9 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.7fr_1fr_1fr_1.2fr] lg:gap-10">
          <div>
            <a
              href="#page-top"
              className="font-serif text-[19px] tracking-[0.14em] text-ivory-50 transition-colors hover:text-brass-200"
            >
              SOL <span className="text-brass-400">&amp;</span> STILL
            </a>
            <p className="mt-3 max-w-xs text-xs leading-6 text-ivory-100/60">
              Thoughtful care, naturally. A little space to slow down and
              reconnect with yourself.
            </p>
            <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.18em] text-brass-200">
              Accra, Ghana
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass-200">
              Explore
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href="#booking"
                  className="text-xs text-ivory-100/70 transition-colors hover:text-brass-200"
                >
                  Book a treatment
                </a>
              </li>
              <li>
                <a
                  href="#page-top"
                  className="text-xs text-ivory-100/70 transition-colors hover:text-brass-200"
                >
                  Back to top
                </a>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass-200">
              Your visit
            </h2>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-ivory-100/70">
              <li>Choose a treatment and a time that suits you.</li>
              <li>Appointments are available over the next 7 days.</li>
              <li>All times are shown in Accra local time.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass-200">
              Booking notes
            </h2>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-ivory-100/70">
              <li>Your selected time is held for up to 5 minutes.</li>
              <li>Online payment is not available yet.</li>
            </ul>
          </div>

          <address className="not-italic">
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass-200">
              Find &amp; contact us
            </h2>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-ivory-100/70">
              <li>Accra-Tessano, Accra</li>
              <li>
                <a
                  href="tel:+2330028824444"
                  className="transition-colors hover:text-brass-200"
                >
                  +233 002 882 4444
                </a>
              </li>
              <li>
                <a
                  href="mailto:solstill@gh.com"
                  className="transition-colors hover:text-brass-200"
                >
                  solstill@mail.outlook.com
                </a>
              </li>
              <li>Monday–Saturday, 9:00 am–9:00 pm</li>
            </ul>
          </address>
        </div>
        <div className="mx-auto mt-9 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-5 text-[9px] uppercase tracking-[0.16em] text-ivory-100/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SOL &amp; STILL. All rights reserved.</p>
          <p>Thoughtful care, naturally</p>
        </div>
      </footer>
    </div>
  );
}
