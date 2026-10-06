import type { Service } from "../../types/booking";

type ServicePickerProps = {
  services: Service[];
  selectedServiceId: string | null;
  isLoading: boolean;
  onSelect: (serviceId: string) => void;
};

const artwork = [
  "from-[#b89572] via-[#d7baa0] to-[#7d8e76]",
  "from-[#85917b] via-[#c3b49a] to-[#d6b79c]",
  "from-[#b59c83] via-[#dfc9ab] to-[#8b9982]",
  "from-[#758477] via-[#c3b091] to-[#b98e78]",
];

export function ServicePicker({
  services,
  selectedServiceId,
  isLoading,
  onSelect,
}: ServicePickerProps) {
  return (
    <section aria-labelledby="services-heading" id="treatments">
      <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
        <div>
          <p className="section-kicker">01 <span>—</span> The first step</p>
          <h2
            id="services-heading"
            className="mt-2 font-serif text-[32px] font-normal leading-tight tracking-[-0.035em] text-forest-950 sm:text-[38px]"
          >
            Choose your ritual
          </h2>
        </div>
        <p className="hidden max-w-[175px] pb-1 text-right text-xs leading-5 text-forest-800/60 sm:block">
          Each treatment is a moment to return to yourself.
        </p>
      </div>

      {isLoading && (
        <p
          role="status"
          aria-label="Loading services"
          className="flex items-center gap-3 rounded-xl bg-white/65 px-5 py-5 text-sm text-forest-800/70"
        >
          <span className="loading-orb" aria-hidden="true" />
          Preparing your treatments…
        </p>
      )}

      {!isLoading && services.length === 0 && (
        <p className="rounded-xl border border-forest-900/10 bg-white/60 px-5 py-6 text-sm text-forest-800/65">
          Our treatment menu is being refreshed. Please check back shortly.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((service, index) => {
          const isSelected = selectedServiceId === service.id;

          return (
            <button
              type="button"
              key={service.id}
              aria-pressed={isSelected}
              onClick={() => onSelect(service.id)}
              className={`service-card group relative flex min-h-[280px] flex-col overflow-hidden rounded-[1.15rem] border bg-white text-left transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(42,56,43,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-600 focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-forest-800 shadow-[0_12px_36px_rgba(42,56,43,0.12)]"
                  : "border-forest-900/10 shadow-[0_5px_20px_rgba(42,56,43,0.035)] hover:border-forest-900/25"
              }`}
            >
              <span
                aria-hidden="true"
                className={`service-art relative block h-[115px] overflow-hidden bg-gradient-to-br ${artwork[index % artwork.length]}`}
              >
                <span className="absolute -right-4 -top-14 size-44 rounded-full border border-white/30" />
                <span className="absolute -right-1 -top-7 size-32 rounded-full border border-white/35" />
                <span className="absolute -right-7 -top-1 size-20 rounded-full border border-white/40" />
                <span className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-white/10" />
                <span className="absolute bottom-4 left-5 flex size-8 items-center justify-center rounded-full border border-white/55 bg-white/10 font-serif text-sm italic text-white backdrop-blur-sm">
                  0{index + 1}
                </span>
                {isSelected && (
                  <span className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-full bg-forest-950 text-[11px] text-white shadow-lg">
                    ✓
                  </span>
                )}
              </span>

              <span className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:px-6">
                <span className="font-serif text-[21px] leading-snug tracking-[-0.02em] text-forest-950">
                  {service.name}
                </span>
                <span className="mt-2 line-clamp-2 min-h-[40px] text-xs leading-5 text-forest-800/65">
                  {service.description}
                </span>
                <span className="mt-4 flex items-center justify-between border-t border-forest-900/10 pt-3.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.13em] text-forest-800/65">
                    {service.duration_minutes} min
                  </span>
                  <span className="font-serif text-[16px] text-forest-950">
                    GHS {Number(service.price).toFixed(2)}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
