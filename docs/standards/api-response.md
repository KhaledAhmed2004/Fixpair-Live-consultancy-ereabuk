# API Response

Concrete **shapes** Fixpair uses / is moving toward.  
Philosophy + 7-layer thinking: [Response Architecture](/standards/response-architecture).  
Code gaps: [Response gaps](/standards/response-gaps).

Implementation reference today: `src/shared/sendResponse.ts`.

---

## Success (single / object) — current

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": "…",
    "status": "confirmed"
  }
}
```

## Success (list + pagination) — current

```json
{
  "success": true,
  "message": "Consultants retrieved successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPage": 8,
    "total": 157
  }
}
```

> **Note:** Architecture target may nest pagination under `meta.pagination` later. Until that migrate ships, **top-level `pagination`** is the live contract.

---

## Error — current (legacy)

```json
{
  "success": false,
  "message": "…",
  "errorMessages": [
    { "path": "durationMinutes", "message": "…" }
  ]
}
```

## Error — target (new work should aim here)

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

### Validation — target

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": [
      {
        "field": "durationMinutes",
        "code": "MIN_VALUE",
        "message": "Must be greater than 0"
      }
    ]
  }
}
```

Codes: [Error Codes](/standards/error-codes)

---

## Rules

1. Same envelope family everywhere — no one-off `{ msg, result }`
2. Never return raw Mongoose docs with secrets
3. Map through DTOs / explicit response objects
4. Humans read `message`; machines prefer `error.code`
5. Lists paginated; cap `limit`
6. Never HTTP `200` with business failure (`success: false`)
7. Prefer domain fields over UI-only `badge` / `subtitle` payloads
8. Document null vs omit vs `[]` in the feature contract

## Money / privileged fields

Never trust from client body:

- `userId`
- `amount` / final price (unless optional `expectedAmount` for price-lock)
- `status`
- `role`
- timestamps as client-owned writes

Prefer response money as `{ "amount": number, "currency": "…" }` once standardized.
