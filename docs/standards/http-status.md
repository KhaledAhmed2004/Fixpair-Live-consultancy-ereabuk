# HTTP Status

Use status codes intentionally. Body envelope still includes `success` / `message` / `data` or `error`.

Architecture: [Response Architecture](/standards/response-architecture)

**Fixpair choice:** validation → **`400`** (not 422), unless a versioned change says otherwise.

## Success

| Code | Use |
|------|-----|
| `200 OK` | Read / update / successful action with body |
| `201 Created` | Resource created |
| `202 Accepted` | Async job accepted |
| `204 No Content` | Success with no body (e.g. some deletes) |

## Client errors

| Code | Use |
|------|-----|
| `400 Bad Request` | Validation / malformed request |
| `401 Unauthorized` | Not authenticated |
| `403 Forbidden` | Authenticated but not permitted |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Business conflict / invalid state / unavailable |
| `422 Unprocessable Entity` | Optional alternative for semantic validation — **pick 400 or 422 project-wide, don't mix randomly** |
| `429 Too Many Requests` | Rate limited |

## Server errors

| Code | Use |
|------|-----|
| `500 Internal Server Error` | Unexpected bug |
| `502 / 503 / 504` | Upstream / overload / timeout |

## Practical Fixpair mapping

| Situation | Status |
|-----------|--------|
| Create booking OK | `201` |
| Get booking / list | `200` |
| Cancel / reschedule OK | `200` |
| Validation fail | `400` |
| Missing token | `401` |
| Other user's booking | `403` |
| Unknown id | `404` |
| Consultant unavailable / slot taken / bad transition | `409` |
| Payment provider down | `503` |

## Anti-patterns

- Returning `200` with `success: false` for business failures
- Using `500` for expected domain conflicts
- Using `401` when you meant `403`
- Creating resources with `200` instead of `201`
