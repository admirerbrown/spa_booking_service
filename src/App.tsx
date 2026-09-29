import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import './app.css';

type Service = { id: string; name: string; description: string; duration_minutes: number; price: number };

export default function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('services').select('id, name, description, duration_minutes, price').order('name')
      .then(({ data, error: queryError }) => {
        if (queryError) setError('Services could not be loaded. Please try again later.');
        else setServices(data ?? []);
      });
  }, []);

  return (
    <main className="page-shell">
      <header>
        <p className="eyebrow">THERAPIST BOOKING</p>
        <h1>Make time for yourself.</h1>
        <p className="lede">Choose a treatment, therapist, and time that works for you.</p>
      </header>
      {!supabase && <p className="notice">Add your Supabase public keys to <code>.env.local</code> to load services.</p>}
      {error && <p role="alert" className="notice">{error}</p>}
      <section aria-labelledby="services-heading">
        <h2 id="services-heading">Choose a service</h2>
        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" key={service.id}>
              <h3>{service.name}</h3>
              <p>{service.description}</p>
              <footer><span>{service.duration_minutes} min</span><strong>GHS {Number(service.price).toFixed(2)}</strong></footer>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
