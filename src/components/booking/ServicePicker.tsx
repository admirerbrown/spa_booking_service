import type { Service } from "../../types/booking";
import aromaticMassageImage from "../../assets/aromatic-massage.jpg";
import swedishMassageImage from "../../assets/swedishmassage.jpg";
import warmStoneImage from "../../assets/warmstone.jpg";
import deepTissueMassageImage from "../../assets/woman-receiving-deep-tissue-massage.jpg";

type ServicePickerProps = {
  services: Service[];
  selectedServiceId: string | null;
  isLoading: boolean;
  onSelect: (serviceId: string) => void;
};

const serviceImages: Record<string, string> = {
  "restorative swedish massage": swedishMassageImage,
  "deep tissue massage": deepTissueMassageImage,
  "aromatic reset": aromaticMassageImage,
  "warm stone ritual": warmStoneImage,
};

export function ServicePicker({
  services,
  selectedServiceId,
  isLoading,
  onSelect,
}: ServicePickerProps) {
  return (
    <section
      aria-labelledby="services-heading"
      id="treatments"
      className="scroll-mt-8 px-5 py-7 sm:px-7 sm:py-9"
    >
      <div className="mx-auto mb-8 max-w-2xl pb-7 text-center sm:mb-10 sm:pb-9">
        <p className="inline-flex items-center gap-3 rounded-full border border-brass-500 bg-brass-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-forest-950 shadow-sm sm:text-xs">
          <span className="font-serif text-sm italic text-forest-950">01</span>
          <span aria-hidden="true" className="h-px w-5 bg-forest-950/45" />
          Begin here
        </p>
        <h2
          id="services-heading"
          className="mt-4 font-serif text-[40px] font-normal leading-[1.05] tracking-[-0.04em] text-forest-950 sm:text-[52px]"
        >
          Choose your ritual
        </h2>
        <p className="mx-auto mt-4 max-w-xl font-serif text-[17px] leading-7 text-forest-800/75 sm:text-lg">
          A little time set aside just for you. Find the treatment that feels
          right, then choose a time to visit.
        </p>
        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-serif text-[13px] italic tracking-[0.04em] text-forest-800/70 sm:text-sm">
          <span>Grounding care</span>
          <span aria-hidden="true" className="text-brass-600">✳</span>
          <span>Unhurried moments</span>
          <span aria-hidden="true" className="text-brass-600">✳</span>
          <span>Room to exhale</span>
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

      <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 sm:gap-6">
        {services.map((service, index) => {
          const isSelected = selectedServiceId === service.id;

          return (
            <button
              type="button"
              key={service.id}
              aria-pressed={isSelected}
              onClick={() => onSelect(service.id)}
              className={`service-card group relative flex min-h-[21rem] flex-col overflow-hidden rounded-b-[1.35rem] border bg-[#f5f0e7] text-left transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(42,56,43,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-600 focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-forest-800 shadow-[0_12px_36px_rgba(42,56,43,0.12)]"
                  : "border-forest-900/10 shadow-[0_8px_24px_rgba(42,56,43,0.045)] hover:border-forest-900/25"
              }`}
            >
              <span
                className="service-art relative block h-40 overflow-hidden bg-forest-900 sm:h-44"
              >
                <img
                  src={serviceImages[service.name.toLocaleLowerCase()] ?? swedishMassageImage}
                  alt={`${service.name} spa treatment`}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                />
                <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-forest-950/50 via-forest-950/5 to-transparent" />
                <span className="absolute bottom-4 left-5 flex size-8 items-center justify-center rounded-full border border-white/55 bg-white/10 font-serif text-sm italic text-white backdrop-blur-sm">
                  0{index + 1}
                </span>
                <span className="absolute bottom-4 right-5 text-[9px] font-semibold uppercase tracking-[0.17em] text-white/90">
                  A moment for you
                </span>
                {isSelected && (
                  <span className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-full bg-forest-950 text-[11px] text-white shadow-lg">
                    ✓
                  </span>
                )}
              </span>

              <span className="flex flex-1 flex-col px-6 pb-6 pt-5 sm:px-7">
                <span className="font-serif text-[23px] leading-snug tracking-[-0.025em] text-forest-950">
                  {service.name}
                </span>
                <span className="mt-2 line-clamp-2 min-h-10 text-[13px] leading-5 text-forest-800/65">
                  {service.description}
                </span>
                <span className="mt-auto flex items-end justify-between gap-3 border-t border-forest-900/10 pt-4">
                  <span className="flex flex-col gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-forest-800/45">
                      Duration
                    </span>
                    <span className="text-[11px] font-medium text-forest-800/75">
                      {service.duration_minutes} minutes
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-forest-800/45">
                      From
                    </span>
                    <span className="font-serif text-[18px] text-forest-950">
                      GHS {Number(service.price).toFixed(2)}
                    </span>
                  </span>
                  <span className="mb-0.5 inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-forest-800/65">
                    Choose
                    <span aria-hidden="true" className="text-base text-brass-600 transition-transform group-hover:translate-x-1">
                      →
                    </span>
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
