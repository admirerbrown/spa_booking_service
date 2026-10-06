import type { AvailableSlot } from "../../types/booking";

type AvailabilityPickerProps = {
  slots: AvailableSlot[];
  selectedSlot: string | null;
  hasSelectedService: boolean;
  isLoading: boolean;
  isCreatingHold: boolean;
  onSelect: (slot: AvailableSlot) => void;
};

function formattedDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function AvailabilityPicker({
  slots,
  selectedSlot,
  hasSelectedService,
  isLoading,
  isCreatingHold,
  onSelect,
}: AvailabilityPickerProps) {
  if (!hasSelectedService) {
    return (
      <section
        aria-labelledby="availability-heading"
        className="rounded-2xl border border-dashed border-forest-900/20 bg-white/35 px-6 py-7 sm:px-8"
      >
        <div className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-forest-900/[0.06] text-lg text-forest-800">
            ◷
          </span>
          <div>
            <p className="section-kicker">02 — Your moment</p>
            <h2
              id="availability-heading"
              className="mt-1 font-serif text-[22px] text-forest-950"
            >
              Choose a time
            </h2>
            <p className="mt-1 text-xs leading-5 text-forest-800/60">
              Select a treatment to see the times waiting for you.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="availability-heading"
      className="booking-section"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-kicker">02 <span>—</span> Your moment</p>
          <h2
            id="availability-heading"
            className="mt-2 font-serif text-[30px] font-normal leading-tight tracking-[-0.035em] text-forest-950"
          >
            Choose a time
          </h2>
        </div>
        <span className="rounded-full border border-forest-900/10 bg-white/70 px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-forest-800/75">
          {formattedDate(new Date().toISOString().slice(0, 10))}
        </span>
      </div>

      {isLoading && (
        <p
          role="status"
          aria-label="Loading availability"
          className="flex items-center gap-3 py-5 text-sm text-forest-800/70"
        >
          <span className="loading-orb" aria-hidden="true" />
          Finding a moment that feels right…
        </p>
      )}

      {!isLoading && slots.length === 0 && (
        <p
          role="status"
          aria-label="No appointments available"
          className="rounded-xl border border-forest-900/10 bg-white/65 px-5 py-5 text-sm leading-6 text-forest-800/70"
        >
          There are no appointments available today. Please check back soon for
          a little time to yourself.
        </p>
      )}

      {slots.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {slots.map((slot) => {
            const isSelected = selectedSlot === slot.startTime;

            return (
              <button
                key={slot.startTime}
                type="button"
                aria-label={slot.startTime}
                aria-pressed={isSelected}
                disabled={isCreatingHold}
                onClick={() => onSelect(slot)}
                className={`slot-button min-w-[88px] rounded-full border px-5 py-3 text-[13px] font-medium tabular-nums transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-45 ${
                  isSelected
                    ? "border-forest-950 bg-forest-950 text-ivory-50 shadow-[0_5px_14px_rgba(30,48,40,0.2)]"
                    : "border-forest-900/15 bg-white/80 text-forest-950 hover:border-forest-900/50 hover:bg-white"
                }`}
              >
                {slot.startTime}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
