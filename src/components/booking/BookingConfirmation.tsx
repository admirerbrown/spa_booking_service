type BookingConfirmationProps = {
  bookingId: string;
  startTime: string;
  serviceName: string | undefined;
};

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

export function BookingConfirmation({
  bookingId,
  startTime,
  serviceName,
}: BookingConfirmationProps) {
  return (
    <section
      aria-labelledby="confirmation-heading"
      className="confirmation-card overflow-hidden rounded-[1.4rem] border border-brass-600/25 bg-[#fbf8f1] shadow-[0_16px_45px_rgba(42,56,43,0.08)]"
    >
      <div className="relative overflow-hidden bg-forest-950 px-6 py-9 text-center text-ivory-50 sm:px-10 sm:py-11">
        <span
          aria-hidden="true"
          className="absolute -right-12 -top-24 size-64 rounded-full border border-white/10"
        />
        <span
          aria-hidden="true"
          className="absolute -right-3 -top-16 size-44 rounded-full border border-white/10"
        />
        <span className="relative mx-auto flex size-[54px] items-center justify-center rounded-full border border-brass-300/60 bg-white/5 text-[21px] text-brass-200">
          ✓
        </span>
        <p className="relative mt-5 text-[9px] font-semibold uppercase tracking-[0.25em] text-brass-200">
          Your time is yours
        </p>
        <h2
          id="confirmation-heading"
          className="relative mt-2 font-serif text-[30px] font-normal tracking-[-0.035em] sm:text-[36px]"
        >
          Booking confirmed
        </h2>
        <p className="relative mt-2 text-sm text-ivory-100/70">
          Your appointment is confirmed.
        </p>
      </div>

      <div className="px-6 py-6 sm:px-9 sm:py-8">
        <div className="grid gap-4 border-b border-forest-900/10 pb-6 sm:grid-cols-2">
          <div>
            <p className="section-kicker">Your treatment</p>
            <p className="mt-2 font-serif text-lg text-forest-950">
              {serviceName}
            </p>
          </div>
          <div>
            <p className="section-kicker">Date &amp; time</p>
            <p className="mt-2 font-serif text-lg text-forest-950">
              {formatAppointmentDate(startTime)}
            </p>
            <p className="mt-1 text-xs text-forest-800/65">
              {formatAppointmentTime(startTime)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-normal text-forest-800/70">
            Booking reference: {bookingId}
          </p>
          <p className="max-w-[185px] text-right text-[10px] leading-5 text-forest-800/55">
            We look forward to welcoming you.
          </p>
        </div>
      </div>
    </section>
  );
}
