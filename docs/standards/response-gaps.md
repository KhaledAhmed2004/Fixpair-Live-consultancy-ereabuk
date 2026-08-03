# Response Gaps (Fixpair)

Gap analysis: **target** [Response Architecture](/standards/response-architecture) vs **current code**.

| Area | Current | Target | Priority |
|------|---------|--------|----------|
| Success envelope | `success`, `message`, `data`, optional `pagination` via `sendResponse` | Same + optional `meta.requestId`; pagination under `meta` **or** keep top-level `pagination` but document one forever | Medium |
| Error envelope | `success`, `message`, `errorMessages[]`, optional `stack` | Add stable `error.code`, optional `error.fields` / `error.details`, `meta.requestId` | **High** |
| Machine error codes | Mostly human `message` only (`ApiError`, Zod path messages) | UPPER_SNAKE codes from [Error Codes](/standards/error-codes) | **High** |
| HTTP vs body | Generally OK | Enforce: never `200` + `success: false` | High |
| Validation status | Zod → typically 400 | Keep **400** project-wide (don’t mix 422) | Low (document) |
| DTO / leak | Inconsistent; some handlers return lean objects, risk of raw docs | Mandatory mapper/DTO on all public responses | **High** |
| List pagination | Present on many list APIs | Always + max `limit` cap | Medium |
| Cursor pagination | Rare / absent | Notifications & large feeds | Low |
| null vs `[]` vs omit | Undocumented | Document per contract | Medium |
| Money shape | Mixed | `{ amount, currency }` (+ cents vs decimal lock) | Medium |
| Idempotency responses | Partial (billing tests exist) | Document 200 vs 409 policy per action | Medium |
| requestId | Not in JSON body | Add to success + error `meta` | Medium |
| Standards docs | `api-response`, `error-codes`, `http-status` | Architecture is source of intent; shapes stay in sibling pages | Done (docs) |

---

## Code anchors

| Concern | File |
|---------|------|
| Success sender | `src/shared/sendResponse.ts` |
| Global errors | `src/app/middlewares/globalErrorHandler.ts` |
| Zod errors | `src/errors/handleZodError.ts` |
| ApiError | `src/errors/ApiError.ts` |

### Current success (simplified)

```ts
// sendResponse
{ success, message, pagination?, data }
```

### Current error (simplified)

```ts
// globalErrorHandler
{ success: false, message, errorMessages: [{ path, message }], stack? }
```

### Target error (direction)

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "meta": { "requestId": "req_…" },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": [
      { "field": "durationMinutes", "code": "MIN_VALUE", "message": "…" }
    ]
  }
}
```

During migration, clients may temporarily read both `errorMessages` and `error.fields` — then deprecate `errorMessages`.

---

## Suggested implementation order

1. [ ] Extend `ApiError` with `code` (+ optional `details`)
2. [ ] Map Zod → `VALIDATION_ERROR` + `fields[]`
3. [ ] Unify error JSON in `globalErrorHandler` toward target envelope
4. [ ] Add `requestId` middleware (header + body `meta`)
5. [ ] Audit modules for raw mongoose returns → DTOs
6. [ ] Decide: keep top-level `pagination` **or** move to `meta.pagination` (one PR, don’t thrash)
7. [ ] Update feature contracts + e2e expectations
8. [ ] Mark gaps Done in this page

---

## Decision log

| Date | Decision | Why |
|------|----------|-----|
| 2026-08-01 | Validation stays **400** | Align with current Zod handling; avoid 400/422 mix |
| 2026-08-01 | Target adds `error.code` without deleting `message` | Mobile/web already show messages |
| 2026-08-01 | Pagination field names stay `total` / `totalPage` for now | Match `sendResponse` until a versioned migrate |

---

## Rule

> New endpoints should not invent a third response shape. Follow [Response Architecture](/standards/response-architecture); if code can’t yet emit `error.code`, still pick a code in the feature contract and track the gap here.
