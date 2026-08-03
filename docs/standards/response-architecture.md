# Response Architecture

World-class API responses are not “pretty JSON”.  
They are a **predictable, stable, scalable contract** for web, mobile, partners, logs, and debugging.

> **Good API response = domain-driven, machine-readable, secure, backward-compatible.**

Related: [API Response shapes](/standards/api-response) · [Error Codes](/standards/error-codes) · [HTTP Status](/standards/http-status) · [Fixpair gaps](/standards/response-gaps)

---

## One-line principle

Design in this order — not `res.json(doc)` first:

```text
Domain → invariants → state → permission → failure modes → client contract → response
```

---

## 7 layers of thinking

### 1. Response is a contract

Do not invent a new shape per endpoint.

**Avoid mixing:**

```json
{ "msg": "done", "result": { "name": "…" } }
```

```json
{ "success": true, "data": { "itemName": "…" } }
```

```json
{ "error": "Not found" }
```

**Fixpair target envelope:**

```json
{
  "success": true,
  "message": "Human-readable summary",
  "data": {},
  "meta": {
    "requestId": "req_…",
    "pagination": null
  },
  "error": null
}
```

**Error:**

```json
{
  "success": false,
  "message": "Consultant is currently unavailable",
  "data": null,
  "meta": {
    "requestId": "req_…"
  },
  "error": {
    "code": "CONSULTANT_UNAVAILABLE",
    "message": "Consultant is currently unavailable",
    "details": null,
    "fields": null
  }
}
```

Today’s live code still uses a simpler shape — see [Response gaps](/standards/response-gaps). New work should move toward this target.

---

### 2. HTTP status ≠ business body (but they must agree)

| Outcome | Status |
|---------|--------|
| Read / update OK | `200` |
| Created | `201` |
| Accepted async | `202` |
| Deleted, no body | `204` (or `200` + envelope — pick one style) |
| Validation | `400` (Fixpair choice; don’t mix with 422 randomly) |
| Unauthenticated | `401` |
| Forbidden | `403` |
| Missing | `404` |
| Conflict / invalid state | `409` |
| Rate limit | `429` |
| Bug | `500` |
| Dependency down | `503` |

**Never:** HTTP `200` + `{ "success": false }` for business failures.

Details: [HTTP Status](/standards/http-status)

---

### 3. Return domain truth, not UI chrome

**Avoid** presentation-only payloads:

```json
{ "title": "…", "subtitle": "…", "badge": "Low Stock" }
```

**Prefer** business structure:

```json
{
  "id": "…",
  "name": "…",
  "status": "LOW_STOCK",
  "stock": { "quantity": 12, "unit": "KG" },
  "valuation": { "amount": 3200, "currency": "BDT" }
}
```

Frontend builds labels. Backend owns facts.

Money: prefer explicit `{ amount, currency }` (and project-wide cents vs decimal rule).

---

### 4. Lists always think pagination + filter + sort

```http
GET /resource?page=1&limit=20&status=…&sort=-updatedAt
```

```json
{
  "success": true,
  "message": "…",
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 146,
      "totalPage": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

Large feeds (notifications): consider **cursor** pagination (`nextCursor`, `hasMore`).  
Always cap `limit` (e.g. max 100).

---

### 5. Errors are first-class API design

Machine code + human message:

```json
{
  "success": false,
  "message": "Please correct the highlighted fields.",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": [
      {
        "field": "email",
        "code": "INVALID_EMAIL",
        "message": "Enter a valid email address"
      }
    ]
  }
}
```

Client branches on `error.code` / `fields[]` — never `message.includes("email")`.

Registry: [Error Codes](/standards/error-codes)

---

### 6. Define null vs missing vs empty array

| Shape | Meaning |
|-------|---------|
| `"phone": null` | Field exists; value currently empty |
| field omitted | Not part of this response version / not loaded |
| `"items": []` | Loaded successfully; zero results |

Document per endpoint which fields are nullable. Don’t flip meanings casually (breaking change).

---

### 7. Never leak database documents

```text
DB Model → Domain → DTO / serializer → API Response
```

Not:

```text
DB → res.json(document)
```

Strip: `passwordHash`, internal flags, raw Stripe secrets, `__v`, etc.  
Expose: stable `id`, public fields, intentional enums.

---

## Endpoint design sequence (before coding)

```text
1. WHO          — who calls?
2. INTENT       — what do they want?
3. RESOURCE     — which domain object?
4. RULES        — business rules
5. STATE        — current / allowed next
6. SUCCESS      — what must the client receive?
7. FAILURE      — predictable failures
8. STATUS       — HTTP per outcome
9. CONTRACT     — stable schema
10. SCALE       — pagination / idempotency / concurrency?
11. SECURITY    — what must not leak?
12. OBSERVABILITY — requestId / logs
```

Example: `POST /consultations/:id/cancel` — think cancellable states, owner-only authZ, double-submit idempotency, race with “in progress”, audit (`cancelledBy`, `cancelledAt`), then error codes like `INVALID_STATE_TRANSITION`.

---

## Target shapes (cheat sheet)

### Single resource

```json
{
  "success": true,
  "message": "Consultation retrieved successfully",
  "data": {
    "id": "…",
    "status": "CONFIRMED"
  },
  "meta": { "requestId": "req_…" },
  "error": null
}
```

### Collection

```json
{
  "success": true,
  "message": "Consultants retrieved successfully",
  "data": [],
  "meta": {
    "requestId": "req_…",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 54,
      "totalPage": 3
    }
  },
  "error": null
}
```

### Domain error

```json
{
  "success": false,
  "message": "Not enough stock is available.",
  "data": null,
  "meta": { "requestId": "req_…" },
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough stock is available.",
    "details": {
      "itemId": "…",
      "requestedQuantity": 10,
      "availableQuantity": 4
    }
  }
}
```

---

## Enforce on every module

1. Same envelope
2. Same error code convention
3. Same pagination fields
4. DTO out (no raw mongoose)
5. Correct HTTP status
6. `requestId` when observability lands

See migration checklist: [Response gaps](/standards/response-gaps)
