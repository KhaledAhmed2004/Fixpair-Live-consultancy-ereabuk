# Operating System

Fixpair-এর **Feature Operating System** — Product Design + Backend একসাথে চালানোর repeatable process।

## Core principle

```text
Want → Walk → Rules → Contract → Build → Break → Fix
```

| Step | Meaning |
|------|---------|
| **Want** | User story + goal + acceptance (light) |
| **Walk** | User journey (+ failures) |
| **Rules** | Product / business policies |
| **Contract** | IA + states + Screen→API + API contract |
| **Build** | Thin vertical slice |
| **Break** | Dual QA (product walk + backend break) |
| **Fix** | Harden + standardize |

## Pipeline

```text
BACKLOG
  ↓
SPEC (Product + Bridge)     ← User story / Goal / Journey / Rules / States / Screen→API
  ↓
CONTRACT (Backend)          ← Endpoints / errors / DTOs
  ↓
BUILD                       ← Thin vertical slice
  ↓
VERIFY                      ← Product walk + backend break
  ↓
DONE                        ← Definition of Done checklist
```

**Gate rule:** `SPEC` incomplete থাকলে `BUILD` শুরু নয়।

## Hats (roles)

| Hat | Responsibility |
|-----|----------------|
| **Product** | User story, acceptance, journey, rules, UI states, fairness |
| **Backend** | Enforce rules, auth, money safety, DTOs, tests |
| **Bridge** | Naming, states, Screen→API map, shared language |
| **Dual** | Final walkthrough + break tests |

### Conflict rule

- UX clarity conflict → **Product wins** if safely enforceable
- Safety / money / security conflict → **Backend wins**, Product redesigns around the constraint

## How to use this docs site

1. Read [Dual-role Workflow](/guide/dual-role-workflow)
2. Align full-app structure in [Product](/product/overview) (IA, [data model](/product/data-model), card sorting, glossary)
3. Design journeys with [User Journey (Visual)](/guide/user-journey)
4. Copy [Feature Template](/features/template) for each new feature
5. Follow [Response Architecture](/standards/response-architecture), [API Response](/standards/api-response), [Error Codes](/standards/error-codes), [HTTP Status](/standards/http-status)
6. Fill the spec → then implement
7. Mark Definition of Done only when checklist passes

## One-line memory

> Product hat দিয়ে সিদ্ধান্ত নাও, Bridge hat দিয়ে contract লেখো, Backend hat দিয়ে enforce করো, Dual hat দিয়ে ভেঙে পরীক্ষা করো।
