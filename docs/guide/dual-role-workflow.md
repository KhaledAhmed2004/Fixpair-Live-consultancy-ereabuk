# Dual-role Workflow

তুমি **Product Designer + Backend Developer**।  
প্রতি step-এ একটা primary hat পরো; অন্যটা শুধু check করো।

## Step-by-step

### Step 0 — Pick feature (Product)

Write:

```text
Feature: Instant Consultation
User story: As a user, I want instant consult now, so that I get help immediately
Acceptance: online-only Instant, no booking if payment fails, join after success, idempotent
Out of scope: reschedule, tips, gifts
```

Keep stories **light** (1 main + optional 2–3 supporting).  
Do not create a backlog of micro-stories for every screen/API.

**Backend check:** feasible? payment/session dependencies?

---

### Step 1 — User Journey (Product)

Happy path + at least 3–5 failure paths.

Use the visual board format:

→ Full guide: [User Journey (Visual)](/guide/user-journey)

```text
Open → Login → Search → Profile → Instant → Pay → Join → End → Review
```

Fill in the feature spec:

- Story header
- Stage map
- Step board (action / screen / emotion / system)
- Mermaid flow
- Decision points
- Failure + recovery
- Pain → opportunity

Failures examples:

- Consultant offline
- Payment fail
- Double tap book
- Call drop early
- Session create fail after payment

---

### Step 2 — Product Rules (Product — final say)

Examples:

1. Offline consultant → Instant disabled
2. Payment auth fail → no booking
3. Double tap → one booking only
4. Early end → charge by actual duration
5. User can only see own bookings

---

### Step 3 — Information Architecture (Bridge)

Name objects consistently across UI, API, DB:

```text
User, Consultant, Consultation, Payment, VideoSession, Review
```

---

### Step 4 — States & Transitions (Bridge)

Example:

```text
PENDING_PAYMENT → CONFIRMED → IN_PROGRESS → COMPLETED
PENDING_PAYMENT → FAILED
CONFIRMED → CANCELLED
```

For each transition: who / when / side effects.

---

### Step 5 — Screen → API Map (Bridge)

| User moment | UI state | API |
|-------------|----------|-----|
| Consultant list | List | `GET /consultants` |
| Tap Instant | Booking loading | `POST /consultations/instant` |
| Join | Call screen | session + token API |
| End | Ending | end session API |
| Review | Form | `POST /reviews` |

This map is your dual-role plan sheet. Do not code without it.

---

### Step 6 — API Contract (Backend, Product reviews UX)

For each critical endpoint freeze:

- Method / path
- Auth
- Idempotency
- Body
- Success shape
- Error codes + UI action

---

### Step 7 — Data Model (Backend)

Persist rules safely. Money features need idempotency / ledger notes.

- App-wide light map: [Data Model](/product/data-model)
- Feature delta: template [§8 Data Model Notes](/features/template#8-data-model-notes-backend)
- API returns DTOs — [Response Architecture](/standards/response-architecture)

---

### Step 8 — Build thin slice (Backend first)

```text
Auth + validation
→ happy path service
→ transitions
→ errors + DTOs
→ E2E happy
→ failure tests
→ product polish
```

---

### Step 9 — Dual QA

**Product walk:** goal clear? CTA sense? errors human?

**Backend break:** authZ, double submit, invalid transition, race, payment failure orphans.

---

### Step 10 — Standardize

Promote naming, statuses, error codes into [Standards](/standards/api-response).

## Who decides?

| Step | Primary | Secondary |
|------|---------|-----------|
| Goal / scope | Product | Backend feasibility |
| Journey | Product | Backend touchpoints |
| Rules | **Product** | Backend feasibility |
| IA / states / Screen→API | Bridge | Both |
| API contract | Backend | Product UX review |
| Data model | Backend | Product fields |
| Build | Backend | Product validates |
| QA | Dual | — |

## Daily rhythm

```text
Block A — Think (Product/Bridge): Goal → Journey → Rules → States → Screen→API
Block B — Contract (Backend): endpoints, errors, DTOs
Block C — Build core
Block D — Product verify
Block E — Harden
```

Finish one block before mixing the next.
