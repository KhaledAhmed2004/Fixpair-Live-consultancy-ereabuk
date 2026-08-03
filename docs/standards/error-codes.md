# Error Codes

Use stable **UPPER_SNAKE** codes.  
Frontend should branch on `error.code`; show `message` to humans.

Full thinking: [Response Architecture](/standards/response-architecture) · migration: [Response gaps](/standards/response-gaps)

## Common platform codes

| Code | Typical HTTP | When |
|------|--------------|------|
| `VALIDATION_ERROR` | 400 | Zod / input validation failed |
| `UNAUTHORIZED` | 401 | Missing / invalid auth |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `NOT_FOUND` | 404 | Resource missing |
| `CONFLICT` | 409 | Generic state/resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |
| `SERVICE_UNAVAILABLE` | 503 | Dependency down |

## Domain examples (Consultation / Payment)

| Code | Typical HTTP | When |
|------|--------------|------|
| `CONSULTANT_NOT_FOUND` | 404 | Consultant id invalid / missing |
| `CONSULTANT_UNAVAILABLE` | 409 | Offline / busy / cannot accept instant |
| `SLOT_ALREADY_BOOKED` | 409 | Scheduling conflict |
| `INVALID_STATE_TRANSITION` | 409 | e.g. cancel after completed |
| `PRICE_CHANGED` | 409 | Optional expectedAmount mismatch |
| `PAYMENT_FAILED` | 402 / 409 | Auth/charge failed (pick one style and keep consistent) |
| `PAYMENT_REQUIRED` | 402 / 400 | Missing payment prerequisite |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key, different payload |

## Rules

1. Add new codes in this page when a feature introduces them
2. Do not invent one-off string errors without a code
3. Map each code to a UI action in the feature's Screen→API / contract table
4. Prefer specific domain codes over generic `CONFLICT` when clients need distinct UX

## Template for a new code

```text
CODE_NAME
HTTP:
When:
UI action:
Feature:
```
