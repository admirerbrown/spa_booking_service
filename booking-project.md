# Therapist Booking System

## 1. Project Overview

A simple therapist appointment booking system that allows customers to browse available services, select a therapist and time slot, provide their contact details, and confirm an appointment.

The system is intentionally scoped as a small, production-style application focused on **booking availability, time-slot management, and database-level booking integrity**.

There are no payments, notifications, authentication, admin dashboard, AI agents, or workflow automation components.

---

## 2. Technology Stack

### Frontend

* React
* Vite
* GitHub Pages

### Backend / Database

* Supabase
* PostgreSQL
* Supabase auto-generated API
* Supabase JavaScript client

### Infrastructure

No separately hosted backend server is required.

```text
React + Vite
     │
     │ Supabase Client
     ▼
Supabase
 ├── PostgreSQL
 └── Auto-generated API
```

---

## 3. Core Entities

The system contains three primary entities.

### `services`

Represents the services customers can book.

| Field         | Description                |
| ------------- | -------------------------- |
| `id`          | Unique service identifier  |
| `name`        | Service name               |
| `duration`    | Service duration           |
| `price`       | Service price              |
| `description` | Description of the service |

---

### `therapists`

Represents therapists who provide the services.

| Field           | Description                     |
| --------------- | ------------------------------- |
| `id`            | Unique therapist identifier     |
| `name`          | Therapist name                  |
| `bio`           | Therapist biography / specialty |
| `working_hours` | Therapist working schedule      |

Therapist-skill/service mapping is intentionally excluded from the scope.

---

### `bookings`

Represents customer appointments.

| Field              | Description                  |
| ------------------ | ---------------------------- |
| `id`               | Unique booking identifier    |
| `service_id`       | Selected service             |
| `therapist_id`     | Selected therapist           |
| `customer_name`    | Customer name                |
| `customer_contact` | Customer contact information |
| `start_time`       | Appointment start time       |
| `end_time`         | Appointment end time         |
| `status`           | Booking state                |

---

## 4. Customer Flow

The primary customer journey is:

```text
Browse
   ↓
Select Service
   ↓
Select Therapist
   ↓
View Available Slots
   ↓
Pick Slot
   ↓
Hold Slot
   ↓
Enter Customer Details
   ↓
Confirm Booking
   ↓
Confirmation Screen
```

### Browse

The customer can view the available services and their:

* Name
* Description
* Duration
* Price

### Select Therapist

The customer selects a therapist available for the booking flow.

### Select Slot

The system displays available appointment slots based on:

* Therapist working hours
* Service duration
* Existing bookings
* Booking status

### Hold

The selected slot is temporarily held while the customer completes the booking details.

### Confirm

The customer provides:

* Name
* Contact

The booking is then confirmed if the slot remains available.

### Confirmation

The customer receives an on-screen confirmation containing the relevant appointment information.

---

## 5. Booking Integrity

Booking correctness is a core requirement of the system.

The frontend must **not** be responsible for guaranteeing that a slot is available.

Booking rules must be enforced by PostgreSQL through an appropriate constraint, function, transaction, or combination of database mechanisms.

### Required behaviour

If two customers attempt to book overlapping appointments with the same therapist, the database must prevent both bookings from succeeding.

Example:

```text
Therapist A

09:00 ───────── 10:00
       Booking A

         09:30 ───────── 10:30
                Booking B
```

Booking B must be rejected if Booking A already occupies the overlapping period.

This must remain true even if both booking requests arrive concurrently.

Overlap is scoped **per therapist**: the same time range is fine for two different therapists, so the constraint or check must key on `(therapist_id, time range)` together, not on the time range alone.

### Principle

> The database is the final authority on whether a booking can be created.

The React application may calculate and display available slots, but it must not be trusted as the final source of booking integrity.

---

## 6. Booking Status

Bookings will have a status representing their current state.

At minimum, the system needs to distinguish between:

* `held`
* `confirmed`

The exact hold-expiration mechanism will be defined during database design.

A held booking must not permanently block a slot if the customer abandons the booking flow.

### Hold expiration mechanism

Each `held` booking stores a `held_until` timestamp, set at creation time (e.g. now + 5 minutes).

* Availability queries treat a `held` booking as active only while `held_until` is in the future. An expired hold is excluded from conflict checks, freeing the slot without requiring a background job.
* Optionally, the client may run a countdown and call a "release" operation if the customer abandons the flow, but this is a convenience only. The `held_until` check is the real backstop and must not be bypassed.
* A confirm operation must re-validate that the hold has not expired before creating the `confirmed` booking.

---

## 7. Availability

Available slots are calculated from:

1. Therapist working hours
2. Service duration
3. Existing active bookings
4. Booking status
5. Appointment date

A slot is available only when it falls within the therapist's working hours and does not conflict with an active booking.

---

## 8. Security

Supabase Row Level Security (RLS) is required on all tables. At minimum:

* `services`, `therapists`: public `SELECT` only. No public `INSERT`, `UPDATE`, or `DELETE`.
* `bookings`: public `INSERT` (to create a hold or booking) only. No public `SELECT`, `UPDATE`, or `DELETE`, so one customer cannot read, modify, or cancel another customer's booking. Confirming or releasing a hold happens through a database function (see §5/§11) that runs with the access it needs, not through direct row access.

The application should expose only the operations required by the public booking flow.

The database must not rely solely on frontend validation for data integrity.

---

## 9. Explicitly Out of Scope

The following features are intentionally excluded:

* User accounts
* Authentication / login
* Payments
* Payment gateways
* Notifications
* Email notifications
* SMS notifications
* WhatsApp notifications
* Admin dashboard
* Therapist dashboard
* AI agents
* n8n
* Workflow automation
* Separate backend server
* Server hosting / server keep-alive
* Therapist-skill mapping
* Customer booking history
* Reviews / ratings
* Calendar integrations

---

## 10. Deployment

### Frontend

The React/Vite application will be deployed to:

**GitHub Pages**

### Backend

Supabase will provide:

* PostgreSQL database
* Database functions / constraints
* Auto-generated API
* Required database access

No separately deployed backend application is required.

---

## 11. Primary Engineering Goals

The project should demonstrate the ability to build a complete application while keeping the architecture simple.

The main engineering goals are:

* Correct relational database design
* Reliable appointment availability
* Correct time-slot generation
* Database-enforced booking integrity
* Safe handling of concurrent booking attempts
* Clean React/Supabase integration
* Appropriate Supabase security policies
* Simple deployment architecture
* Clear separation between UI logic and data integrity

---

## 12. Definition of Done

The project is complete when a customer can:

1. Browse available services.
2. Select a service.
3. Select a therapist.
4. View available appointment slots.
5. Select a slot.
6. Temporarily hold the slot.
7. Enter their name and contact information.
8. Confirm the appointment.
9. See a confirmation screen.

The system must also:

* Prevent overlapping bookings for the same therapist.
* Enforce booking integrity at the database level.
* Handle abandoned holds appropriately.
* Respect therapist working hours.
* Work without a separate backend server.
* Be deployed and accessible through GitHub Pages.
* Use Supabase as the backend/database layer.

---

## 13. Testing Approach

The project is built using TDD. Tests are written before implementation at each layer.

### Database layer (highest priority)

Tested directly against Postgres/Supabase, before any UI exists:

* Two concurrent booking attempts for the same therapist and overlapping time → exactly one succeeds, the other is rejected.
* A `held` booking with a future `held_until` blocks conflicting bookings.
* A `held` booking with an expired `held_until` does not block a new booking for the same slot.
* Confirming a hold after it has expired is rejected.
* A booking outside a therapist's `working_hours` is rejected.
* Overlapping (not just identical) time ranges for the same therapist are rejected.

Concurrency tests require two requests to genuinely overlap in time, not just run one after another. This is done either by firing parallel requests from a test script (e.g. `Promise.all` against the Supabase client) or by opening two concurrent transactions directly in Postgres. Sequential test calls do not exercise the race condition and are not sufficient on their own.

### Application layer

Vitest, covering slot-availability calculation (working hours minus active bookings), hold creation, and the confirm flow, including the case where confirmation fails because the hold expired or was taken.

### UI layer

Light coverage: booking flow renders the expected steps, and a rejected booking (e.g. slot taken) surfaces a clear error rather than failing silently.

### TDD Process

Each unit of work follows this cycle:

1. **Discuss design/implementation** — agree on the behavior and approach before any test or code is written.
2. **TDD - Review** — review the planned test cases against the design.
3. **TDD - Red** — write the test(s) and confirm they fail for the expected reason.
4. **TDD - Green** — write the minimum implementation needed to make the test(s) pass.
5. **TDD - Refactor** — clean up the implementation and/or tests while keeping them passing.
6. **Save checkpoint** — commit the passing state before moving to the next unit of work.

---

## 14. Architecture Principle

The project follows one central principle:

> **Keep the infrastructure simple, but make the booking logic correct.**

The application does not need a complicated backend architecture. The engineering challenge is to correctly model appointments, availability, temporary holds, and concurrent bookings using PostgreSQL and Supabase.
