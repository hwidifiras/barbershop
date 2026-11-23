# Barbershop mode: changelog

Every pull request that changes behaviour under [`SPEC.md`](./SPEC.md) adds an entry here
in the same PR. Newest first. Keep entries factual: what changed, which files, which
phase, how it was verified, and confirmation that non-barbershop types are unaffected.

## Entry template

```
### YYYY-MM-DD: short title (PR #N, phase X)
- **What changed:** …
- **Where:** files / routes
- **Barbershop vs standard:** how it differs; standard types unaffected because …
- **Data/migrations:** none | file name and what it does
- **Spec section(s):** 4.x
- **Verified:** tsc / check:i18n / tests / viewports checked
- **Notes / follow-ups:** …
```

## Log

### 2026-11-23: client answers recorded (phase 0, docs only)
- **What changed:** spec now covers the universal walk-in/appointment model (4.10), team-access foundations (4.11), French-only, cash-only, and RTL after team access; phases re-ordered (5 = team access, 6 = RTL and extras).
- **Where:** `docs/barbershop-mode/SPEC.md` (3, 4.4, 4.7, 4.9, 4.10, 4.11, 9, 11, 12)
- **Barbershop vs standard:** no code change.
- **Spec section(s):** as listed

### 2026-11-23: Products default recorded (phase 0, docs only)
- **What changed:** spec records that Products is off by default for barbershops and can be re-enabled.
- **Where:** `docs/barbershop-mode/SPEC.md` (4.6, 7, 12)
- **Barbershop vs standard:** no code change.
- **Spec section(s):** 4.6, 7, 12

### 2026-11-23: spec drafted (phase 0, docs only)
- **What changed:** added `docs/barbershop-mode/SPEC.md` and this changelog.
- **Where:** `docs/barbershop-mode/`
- **Barbershop vs standard:** no code changes; nothing user-visible.
- **Data/migrations:** none
- **Spec section(s):** all
- **Verified:** n/a (documentation)
- **Notes / follow-ups:** awaiting approval of the matrix in section 4 and answers to section 11.

### Context (already shipped, not part of this spec)
- #3 French localization (merged). #4 self-hosted fonts (open at time of writing; enables the barbershop display font without
  a build-time Google dependency).
