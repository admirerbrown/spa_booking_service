import { useEffect, useState } from "react";

import { getAvailability } from "./lib/availabilityApi";
import { supabase } from "./lib/supabase";

import "./app.css";

type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
};

type AvailableSlot = {
  therapistId: string;
  startTime: string;
  endTime: string;
};

export default function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

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
      });
  }, []);

  useEffect(() => {
    if (!selectedServiceId) {
      setAvailableSlots([]);
      return;
    }

    getAvailability(selectedServiceId, "2026-10-05").then((slots) => {
      setAvailableSlots(slots);
    });
  }, [selectedServiceId]);

  return (
    <main className="page-shell">
      <header>
        <p className="eyebrow">THERAPIST BOOKING</p>
        <h1>Make time for yourself.</h1>
        <p className="lede">
          Choose a treatment, therapist, and time that works for you.
        </p>
      </header>

      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}

      <section aria-labelledby="services-heading">
        <h2 id="services-heading">Choose a service</h2>

        <div className="service-grid">
          {services.map((service) => (
            <button
              type="button"
              className="service-card"
              key={service.id}
              aria-pressed={selectedServiceId === service.id}
              onClick={() => setSelectedServiceId(service.id)}
            >
              <h3>{service.name}</h3>

              <p>{service.description}</p>

              <footer>
                <span>{service.duration_minutes} min</span>
                <strong>GHS {Number(service.price).toFixed(2)}</strong>
              </footer>
            </button>
          ))}
        </div>
      </section>

      {availableSlots.length > 0 && (
        <section aria-labelledby="availability-heading">
          <h2 id="availability-heading">Choose a time</h2>

          <div>
            {availableSlots.map((slot) => (
              <button
                key={slot.startTime}
                type="button"
                aria-pressed={selectedSlot === slot.startTime}
                onClick={() => setSelectedSlot(slot.startTime)}
              >
                {slot.startTime}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
