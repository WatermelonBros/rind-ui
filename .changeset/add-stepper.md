---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Stepper: an ordered list of steps with `aria-current="step"` (never tabs); reachable steps are buttons, the rest text, each named with its status. Controllable, cancellable `step` (`next`, `prev`, `select`) for validation; `linear` (back freely, forward only with Next); disabled and completed steps from the mounted Items; the user's moves focus the step's region and announce "Step 2 of 4: Shipping"; contents stay mounted so field values survive. Testing: `getStepper`. Theme: `stepper.css` (a check for completed steps).
