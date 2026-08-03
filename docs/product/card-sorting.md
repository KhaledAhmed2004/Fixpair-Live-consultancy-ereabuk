# Card Sorting

Product-level method to learn **how people group Fixpair concepts** (menus, labels, settings).  
Do this for the **whole app or a large area** — not for a single small feature flow.

Related: [Information Architecture](/product/information-architecture) · [Glossary](/product/glossary)

---

## What it is

Give participants cards (one label each). They sort into groups and (in open sorting) name the groups.  
You use the pattern to fix navigation and naming.

| Type | Participant does |
|------|------------------|
| **Open** | Creates groups + names them |
| **Closed** | Places cards into your predefined groups |

---

## When to run

- Building / redesigning app navigation
- Naming conflicts (`Booking` vs `Consultation`, `Wallet` vs `Payments`)
- Admin or consultant areas feel crowded
- After many features shipped and IA feels messy

**Skip** for a single feature like Instant Consultation alone — use journey/flow there instead.

---

## Starter card deck (Fixpair)

Copy onto physical cards or a FigJam/Miro board:

```text
Instant consultation
Scheduled consultation
Callback request
My bookings
Upcoming sessions
Past sessions
Search consultants
Recommended consultants
Consultant profile
Online status
Availability / calendar
Join video call
Call summary
Leave review
Payment methods
Authorize payment
Invoices
Wallet / balance
Payouts (consultant)
Reports
Notifications
Profile settings
Help / support
FAQ
Terms
Privacy
Transcription history
Admin users
Admin consultations
```

Add/remove cards as the product grows. Keep each card **short** (2–5 words).

---

## How to run (light)

1. Pick 5–8 participants (users and/or consultants separately if possible)
2. Choose **open** first (better for discovery)
3. Ask: “Group these the way you’d expect in the app”
4. Photograph / export results
5. Note common groups + surprising labels
6. Update [IA navigation](/product/information-architecture#3-navigation-map-draft) + [Glossary](/product/glossary)

---

## Results log

Record each round here (don’t invent — fill after a real session).

### Round __ — YYYY-MM-DD

- **Type:** Open / Closed
- **Audience:** Users / Consultants / Mixed
- **Participants:** _
- **Top groups observed:**
  - 
  - 
- **Naming insights:**
  - 
- **Decisions for product:**
  - [ ] Nav change:
  - [ ] Glossary update:
  - [ ] No change (reason):

---

## Closed groups (optional draft)

If you run **closed** sorting later, start with:

| Group | Intended cards |
|-------|----------------|
| Discover | Search, recommended, consultant profile |
| Sessions | Instant, scheduled, my bookings, join call |
| Money | Payment methods, invoices, wallet, payouts |
| Account | Profile, notifications, support, legal |

Revise after open-sort findings.

---

## Link to features

Card sorting does **not** replace feature specs.  
After IA decisions:

- Update glossary/IA here
- Then implement feature journeys under `/features`
