update public.therapist_working_hours
set ends_at = '21:00'::time
where therapist_id = '20000000-0000-4000-8000-000000000001'
  and starts_at = '09:00'::time
  and ends_at = '17:00'::time;
