type BookingAsideProps = {
  hasSelectedService: boolean;
  hasSelectedTime: boolean;
  isHeld: boolean;
};

const comforts = [
  "A calm, private treatment space",
  "Thoughtful care from arrival",
  "Time set aside just for you",
];

export function BookingAside({
  hasSelectedService,
  hasSelectedTime,
  isHeld,
}: BookingAsideProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <section className="overflow-hidden rounded-[1.35rem] border border-forest-900/10 bg-[#fffdf8] shadow-[0_14px_38px_rgba(42,56,43,0.08)]">
        <div className="flex items-start justify-between gap-3 bg-forest-950 px-5 py-5 text-ivory-50">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass-300">
              A little reassurance
            </p>
            <h2 className="mt-2 font-serif text-[23px] leading-tight">
              The details, taken care of.
            </h2>
          </div>
          <span
            aria-hidden="true"
            className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-brass-300/50 font-serif text-lg text-brass-200"
          >
            ✳
          </span>
        </div>
        <div className="space-y-4 px-5 py-5">
          {comforts.map((comfort, index) => (
            <div key={comfort} className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-forest-900/10 bg-sage-100 text-[11px] text-forest-800">
                {index === 0 ? "✳" : "✓"}
              </span>
              <span className="text-xs leading-5 text-forest-800/75">
                {comfort}
              </span>
            </div>
          ))}
        </div>
        <div className="mx-4 mb-4 rounded-xl border border-forest-900/10 bg-ivory-100/65 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-forest-800/55">
              Your reservation
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${
                isHeld
                  ? "bg-sage-100 text-forest-900"
                  : "bg-[#f3efe7] text-forest-800/65"
              }`}
            >
              {isHeld
                ? "Held for you"
                : hasSelectedTime
                  ? "Time selected"
                  : hasSelectedService
                    ? "Treatment chosen"
                    : "Ready when you are"}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-forest-800/60">
            {isHeld
              ? "Your time is being kept just for you while you complete your details."
              : hasSelectedTime
                ? "Your chosen time is being reserved. Complete your details to confirm."
                : "Choose a treatment and we’ll find a time that works for you."}
          </p>
        </div>
      </section>

      <div className="relative overflow-hidden rounded-[1.2rem] bg-forest-900 px-5 py-5 text-ivory-50">
        <span
          aria-hidden="true"
          className="absolute -right-8 -top-10 size-28 rounded-full border border-white/10"
        />
        <p className="relative font-serif text-[20px] italic leading-snug text-brass-200">
          “Rest is not a luxury.”
        </p>
        <p className="relative mt-2 text-[9px] font-medium uppercase tracking-[0.15em] text-ivory-100/55">
          It is how you return to yourself.
        </p>
      </div>
    </aside>
  );
}
