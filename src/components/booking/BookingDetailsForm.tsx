import type { FormEvent } from "react";

type BookingDetailsFormProps = {
  isConfirming: boolean;
  isReleasingHold: boolean;
  customerName: string;
  customerContact: string;
  nameError?: string;
  contactError?: string;
  remainingLabel: string | null;
  onNameChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export function BookingDetailsForm({
  isConfirming,
  isReleasingHold,
  customerName,
  customerContact,
  nameError,
  contactError,
  remainingLabel,
  onNameChange,
  onContactChange,
  onSubmit,
  onCancel,
}: BookingDetailsFormProps) {
  return (
    <section
      aria-labelledby="hold-heading"
      className="booking-section overflow-hidden rounded-[1.25rem] border border-brass-600/25 bg-[#fbf8f1] shadow-[0_12px_38px_rgba(42,56,43,0.055)]"
    >
      <div className="flex items-start gap-4 border-b border-brass-600/15 bg-gradient-to-r from-[#eee7d8] via-[#f7f3eb] to-[#edf0e9] px-5 py-5 sm:px-7">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-900 text-brass-200">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
            <path
              d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.35"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="hold-heading"
              className="font-serif text-[24px] leading-tight tracking-[-0.025em] text-forest-950"
            >
              Appointment held
            </h2>
            <span className="rounded-full border border-brass-700/25 bg-white/55 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-forest-800/70">
              Reserved for you
            </span>
          </div>
          <p className="mt-1 text-xs text-forest-800/65">
            A few details, and this moment is all yours.
          </p>
          {!isConfirming && remainingLabel && (
            <p
              role="timer"
              className="mt-3 inline-flex rounded-full bg-forest-900 px-3 py-1.5 text-[11px] font-medium tabular-nums text-ivory-50"
            >
              Kindly complete within {remainingLabel}
            </p>
          )}
          {isConfirming && (
            <p
              role="status"
              aria-label="Confirming booking"
              className="mt-3 flex items-center gap-2 text-xs text-forest-800/70"
            >
              <span className="loading-orb size-3" aria-hidden="true" />
              Confirming your booking…
            </p>
          )}
        </div>
      </div>

      <form className="space-y-4 px-5 py-5 sm:px-7 sm:py-6" onSubmit={onSubmit}>
        <div>
          <label
            htmlFor="customer-name"
            className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-800/80"
          >
            Name
          </label>
          <input
            id="customer-name"
            name="name"
            type="text"
            autoComplete="name"
            value={customerName}
            onChange={(event) => onNameChange(event.target.value)}
            disabled={isConfirming}
            placeholder="How may we welcome you?"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "customer-name-error" : undefined}
            className={`form-field ${nameError ? "border-red-500/60" : ""}`}
          />
          {nameError && (
            <p id="customer-name-error" role="alert" className="mt-1.5 text-[11px] text-[#7d3c2b]">
              {nameError}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="customer-contact"
            className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-800/80"
          >
            Contact
          </label>
          <input
            id="customer-contact"
            name="contact"
            type="text"
            autoComplete="tel"
            value={customerContact}
            onChange={(event) => onContactChange(event.target.value)}
            disabled={isConfirming}
            placeholder="Your phone number or email"
            aria-invalid={Boolean(contactError)}
            aria-describedby={contactError ? "customer-contact-error" : undefined}
            className={`form-field ${contactError ? "border-red-500/60" : ""}`}
          />
          {contactError && (
            <p id="customer-contact-error" role="alert" className="mt-1.5 text-[11px] text-[#7d3c2b]">
              {contactError}
            </p>
          )}
        </div>

        <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3">
          <button
            type="submit"
            disabled={isConfirming || isReleasingHold}
            className="group flex min-w-0 items-center justify-center gap-1.5 rounded-full bg-forest-950 px-2 py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ivory-50 shadow-[0_6px_16px_rgba(30,48,40,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-forest-800 hover:shadow-[0_10px_20px_rgba(30,48,40,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65 sm:px-4 sm:tracking-[0.12em]"
          >
            Confirm
            <span
              aria-hidden="true"
              className="text-sm transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming || isReleasingHold}
            className="flex min-w-0 items-center justify-center rounded-full border border-forest-900/20 bg-white/50 px-2 py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-forest-900 transition-colors hover:border-forest-900 hover:bg-ivory-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65 sm:px-4 sm:tracking-[0.12em]"
          >
            {isReleasingHold ? "Cancelling…" : "Cancel"}
          </button>
        </div>
        <p className="text-center text-[10px] leading-5 text-forest-800/50">
          Your details are treated with the same care as your time.
        </p>
      </form>
    </section>
  );
}
