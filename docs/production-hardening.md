# Production Hardening & UX Quality

This document outlines the UX quality and production hardening applied to the frontend architecture.

## Session Model
- "All" session size no longer relies on a magic `9999` value. It uses a strong explicit type: `{ mode: 'all' } | { mode: 'fixed'; count: number }`.
- Randomization is handled cleanly by `SessionActivitySelector` independently from the React render cycle, preserving testability and ensuring reproducibility.

## Navigation & Resilience
- **React Router Navigation Blocker**: Configured via `useBlocker` on the Session Page to prevent data loss via accidental Browser Back or internal navigation clicks without user confirmation.
- **Lost State Recovery**: Fallbacks provided if React Router memory state disappears (e.g. strict refreshes or sharing direct URLs). An elegant "Your practice session is no longer available" warning is surfaced instead of a crash.

## Placeholder Behaviors
- Development controls (Simulate Correct / Incorrect) have been stripped.
- Fallback activities use a professional message: "We are still building this type of activity. Please skip it for now."

## Performance
- Reduced React re-renders by enforcing dependency cleanliness and extracting expensive `sessionService` initializations out of normal renders via `useMemo`.
- Avoided large application crashes when evaluators are missing by defaulting gracefully to the safe `PlaceholderActivity`.

## Accessibility
- Used appropriate `role="progressbar"` coupled with `aria-live="polite"` to correctly announce progression transitions through screen readers.
- Ensured touch targets are appropriately sized, layouts scale gracefully into responsive constraints, and standard `a` or `button` navigation semantics are honored.
