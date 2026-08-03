# Glossary

Canonical language for Fixpair — **UI, docs, API, and DB should stay aligned**.  
If you invent a new term, add it here before it spreads.

Related: [Information Architecture](/product/information-architecture)

---

## How to use

| Status | Meaning |
|--------|---------|
| **Preferred** | Use this everywhere by default |
| **Allowed** | OK in UI copy if clearer for users |
| **Avoid** | Do not use in API/docs; migrate away in UI |

---

## People

| Preferred | Meaning | Avoid / notes |
|-----------|---------|----------------|
| User | Client who seeks consultancy | Customer (OK in marketing only) |
| Consultant | Expert delivering sessions | Doctor/Lawyer as role name in API — use consultancy type instead |
| Admin | Internal operator | — |

---

## Sessions & booking

| Preferred | Meaning | Allowed | Avoid |
|-----------|---------|---------|--------|
| Consultation | Core booked engagement entity | “Booking” in user-facing UI if clearer | Appointment, meeting, talk (API) |
| Instant consultation | Start soon / now flow | Instant book | — |
| Scheduled consultation | Future slot booking | — | — |
| Callback | Request consultant to call back | — | — |
| Video session | Live media session for a consultation | Call (UI) | Channel as user-facing name |
| Availability | Consultant open/blocked time | Calendar | — |

---

## Money

| Preferred | Meaning | Allowed | Avoid |
|-----------|---------|---------|--------|
| Payment | Charge / auth / capture flow | — | Pay action as entity name in API loosely |
| Authorization | Hold / confirm card before fulfill | Pay auth | — |
| Capture / finalize | Take money after/during rules | Bill finalize | — |
| Invoice | User-visible bill/receipt | Receipt (UI) | — |
| Refund | Return of funds | — | — |
| Payout | Consultant earnings transfer | — | Withdraw loosely in API without definition |

---

## Trust & aftercare

| Preferred | Meaning | Notes |
|-----------|---------|--------|
| Review | Star/text feedback | After completed consultation |
| Report | Structured session write-up | Often consultant/admin |
| Transcript / transcription | Speech-to-text history | Tied to consultation/session |

---

## Product status language (examples)

Lock exact enums in feature contracts; keep meanings stable:

| Idea | Prefer consistent wording |
|------|---------------------------|
| Waiting money | pending payment / authorizing |
| Ready to go | confirmed / ready |
| In call | in progress |
| Finished | completed |
| Stopped by user/system | cancelled |
| Money failed | failed / payment failed |

---

## Open naming decisions

Track conflicts here until resolved:

| Conflict | Options | Decision | Date |
|----------|---------|----------|------|
| Booking vs Consultation | UI “My Bookings” vs API `consultation` | _TBD — e.g. UI Bookings, API Consultation_ | |
| Live Session vs Experience (journey stage) | Journey label only | Experience = stage; Video session = object | |

---

## Rule

> New feature PR/spec should not introduce a synonym without a glossary row.
