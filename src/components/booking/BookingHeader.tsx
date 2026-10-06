type BookingHeaderProps = {
  activeStep: 1 | 2 | 3;
};

const steps = ["Treatment", "Your time", "Your details"];

export function BookingHeader({ activeStep }: BookingHeaderProps) {
  return (
    <>
      <div className="bg-forest-950 px-5 py-2 text-center text-[10px] font-medium uppercase tracking-[0.24em] text-ivory-100 sm:text-[11px]">
        A little space for yourself <span className="mx-2 text-brass-300">✳</span>
        Thoughtful care, naturally
      </div>

      <header className="mx-auto max-w-7xl px-5 sm:px-8">
        <nav
          aria-label="Main navigation"
          className="flex h-[76px] items-center justify-between border-b border-forest-900/10"
        >
          <a
            href="#home"
            aria-label="Sol & Still home"
            className="group flex items-center gap-3"
          >
            <span className="brand-mark flex size-10 items-center justify-center rounded-full border border-brass-500/50 text-forest-900 transition-transform duration-500 group-hover:rotate-12">
              <svg viewBox="0 0 32 32" aria-hidden="true" className="size-6">
                <circle cx="16" cy="16" r="5.5" fill="currentColor" />
                <path
                  d="M16 2v6m0 16v6M2 16h6m16 0h6M6.1 6.1l4.3 4.3m11.2 11.2 4.3 4.3m0-19.8-4.3 4.3m-11.2 11.2-4.3 4.3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.2"
                />
              </svg>
            </span>
            <span>
              <span className="block font-serif text-[21px] leading-none tracking-[0.13em] text-forest-950">
                SOL <span className="text-brass-600">&</span> STILL
              </span>
              <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.32em] text-forest-700/70">
                A sanctuary for the senses
              </span>
            </span>
          </a>

          <div className="hidden items-center gap-9 text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-800/75 md:flex">
            <a className="transition-colors hover:text-brass-700" href="#treatments">
              Treatments
            </a>
            <a className="transition-colors hover:text-brass-700" href="#booking">
              The experience
            </a>
            <span className="h-5 w-px bg-forest-900/15" />
            <span className="normal-case tracking-[0.05em] text-forest-800">
              Accra, Ghana
            </span>
          </div>

          <a
            href="#booking"
            className="hidden rounded-full border border-forest-900/25 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-950 transition-all duration-300 hover:border-forest-900 hover:bg-forest-950 hover:text-ivory-100 sm:inline-flex"
          >
            Reserve your ritual
          </a>
        </nav>

        <div
          id="home"
          className="hero-entrance relative grid min-h-[350px] overflow-hidden rounded-b-[2rem] bg-forest-950 text-ivory-50 md:min-h-[405px] md:grid-cols-[1.02fr_0.98fr]"
        >
          <div className="relative z-10 flex flex-col justify-center px-7 py-12 sm:px-12 md:px-14 lg:px-[4.5rem]">
            <p className="mb-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.27em] text-brass-300 sm:text-[11px]">
              <span className="h-px w-8 bg-brass-400" />
              Your time, beautifully spent
            </p>
            <h1 className="max-w-xl font-serif text-[clamp(2.75rem,6vw,5.35rem)] font-normal leading-[0.99] tracking-[-0.045em]">
              Come back to
              <br />
              <span className="italic text-brass-200">yourself.</span>
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-7 text-ivory-100/75 sm:text-[15px]">
              Considered treatments, unhurried moments, and care that feels like
              it was made just for you.
            </p>
            <a
              href="#booking"
              className="mt-8 inline-flex w-fit items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ivory-50 transition-colors hover:text-brass-200"
            >
              Discover your treatment
              <span aria-hidden="true" className="text-lg leading-none">
                ↘
              </span>
            </a>
          </div>

          <div className="hero-image relative hidden min-h-full overflow-hidden md:block">
            <img
              src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1400&q=85"
              alt="A softly lit spa retreat with warm natural stone"
              className="absolute inset-0 size-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-forest-950/35 via-transparent to-forest-950/10" />
            <div className="absolute bottom-8 right-8 flex size-[118px] flex-col items-center justify-center rounded-full border border-white/45 bg-forest-950/25 text-center text-[9px] font-medium uppercase leading-[1.7] tracking-[0.19em] text-white backdrop-blur-sm">
              <span className="mb-1 text-brass-200">✳</span>
              Your own
              <br />
              kind of calm
            </div>
          </div>
        </div>

        <ol
          aria-label="Booking progress"
          className="mx-auto flex max-w-[530px] items-center justify-center px-4 py-8 sm:py-10"
        >
          {steps.map((step, index) => {
            const number = index + 1;
            const isComplete = number < activeStep;
            const isCurrent = number === activeStep;

            return (
              <li
                key={step}
                aria-current={isCurrent ? "step" : undefined}
                className="flex flex-1 items-center last:flex-none"
              >
                <div className="flex min-w-fit flex-col items-center gap-2.5">
                  <span
                    className={`flex size-8 items-center justify-center rounded-full border text-[10px] transition-all duration-500 ${
                      isCurrent
                        ? "border-forest-900 bg-forest-900 text-ivory-50 shadow-[0_0_0_5px_rgba(38,63,49,0.09)]"
                        : isComplete
                          ? "border-brass-600 bg-brass-600 text-white"
                          : "border-forest-900/20 bg-transparent text-forest-800/50"
                    }`}
                  >
                    {isComplete ? "✓" : `0${number}`}
                  </span>
                  <span
                    className={`text-[9px] font-semibold uppercase tracking-[0.15em] sm:text-[10px] ${
                      isCurrent
                        ? "text-forest-950"
                        : "text-forest-800/45"
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`mx-3 mb-[22px] h-px flex-1 sm:mx-5 ${
                      isComplete ? "bg-brass-600" : "bg-forest-900/15"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </header>
    </>
  );
}
