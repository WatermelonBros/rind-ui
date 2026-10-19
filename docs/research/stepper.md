# Stepper — research

A sequence of steps (a checkout, an onboarding, a multi-page form) with an indicator of
where the user is, which steps are done, and controls to move between them. The hard part
is not the indicator but the semantics and the rules: what a step *is* to assistive
technology (a list position, not a tab), which steps may be visited (back freely, forward
only through the form's own action when the flow is linear), what moving announces and
where focus goes, and how a step's validity gates the next one.

Two of the nine libraries ship it: Zag / Ark (`steps`) and Reka (`Stepper`). MUI and
Mantine ship styled ones.

Sources read (October 2026): Zag `packages/machines/steps/src` (`steps.machine.ts`,
`steps.connect.ts`), Reka `packages/core/src/Stepper` (`StepperRoot.vue`,
`StepperItem.vue`, `StepperTrigger.vue`), the issue trackers of Zag, Ark and Reka, and the
accessibility guidance of design systems that document their steppers (PatternFly, Trimble
Modus, Toyota DX, UX4G).

## Pattern

There is no APG stepper pattern. What applies:

- **A sequence is a list**: an ordered list of steps, the current one marked
  `aria-current="step"` (the ARIA value made for this case).
- **Not tabs.** Tabs mean free switching between peer panels; a stepper's steps are ordered
  and often gated. Zag uses `tablist` / `tab` / `tabpanel`, which also forces the tab
  structure (Zag #1791: tabs wrapped in item divs are invalid ownership). UX4G's guidance
  sends non-sequential content to Tabs and sequences to a stepper.
- **Status in text**: each step's name carries its status ("Completed", "Current", "Not
  started"), visually hidden when the visual is an icon (Trimble).
- **Where am I**: "Step 2 of 4" in the step region's heading or label (Trimble, PatternFly's
  live summary).
- **One tab stop per step** that can be visited; a step that cannot be visited is not a
  button (Toyota: group the circle and the label in one control).

## How the others built it

### Zag / Ark (`steps`)

- Controllable `step` (0-based) and `count`; `linear`; `isStepValid(index)`,
  `isStepSkippable(index)`; events to go next / prev / to a step; `onStepInvalid`.
- Parts: list (`tablist` with `aria-owns` the triggers), item (`aria-current="step"`),
  trigger (`tab`, `aria-selected`, `aria-controls`, `tabIndex` 0 only for the current step
  when linear), content (`tabpanel`), next / prev triggers (disabled at the ends),
  separator, indicator, progress (`progressbar` with `aria-valuetext` "N% complete").
- In linear mode a click on a trigger does nothing (navigation only through next / prev).
- #3259 (closed) the triggers had no `type="button"` and submitted an ancestor form.

### Reka (`Stepper`)

- `modelValue` (1-based), `linear` (default true), `orientation`, `dir`; exposes
  `goToStep`, `nextStep`, `prevStep`, `hasNext`, `hasPrev`, `isFirstStep`, `isLastStep`.
- Items: `step`, `completed`, `disabled`; state `completed` / `active` / `inactive` and
  `aria-current="true"` on the active item.
- Triggers are buttons with `aria-labelledby` the title and `aria-describedby` the
  description; arrow keys move focus between triggers (`useArrowNavigation`); in linear mode
  a trigger more than one step ahead is not focusable (`tabindex="-1"`, `disabled`).
- Bugs: #2777 (closed) unmounted triggers stayed counted, inflating `totalSteps`;
  #2862 / #2864 (closed) the indicator rendered invalid HTML; #2437 (open) linear mode
  still lets the user click the *next* step, skipping its validation; #1925 (closed) the
  navigation was not reachable from outside the Root.

### MUI and Mantine (styled)

- MUI `Stepper` with `nonLinear`, `StepButton` for clickable steps, `completed` per step,
  `alternativeLabel`; Mantine `Stepper` with `allowNextStepsSelect` and per-step
  `allowStepSelect`. Both keep the step state in the consumer and treat a step's validity
  as the consumer's business.

### Not shipped

Radix, React Aria, Base UI, Headless UI, Ariakit, Kobalte, Melt.

## Accessibility

- An ordered list named by the consumer ("Checkout progress"); `aria-current="step"` on the
  current step.
- Each step's accessible name: its title plus its status ("Shipping (completed)"). The
  default status words are messages.
- A step the user can go to is a `<button type="button">`; one they cannot (ahead, in
  linear mode, or disabled) is plain text, not a disabled button (no dead tab stops).
- Tab moves through the reachable steps; no roving arrow keys: a stepper is navigation, not
  a composite widget, and arrows would clash with the step content's own fields.
- The step content region is labelled by the step title with "Step 2 of 4". When the step
  changes by the user's action, focus moves to that region (programmatic, `tabindex="-1"`),
  so a screen reader reads the new step from its start, and the change is announced
  politely ("Step 2 of 4: Shipping").
- Next / Previous are real buttons; Next on the last step is the consumer's submit.

## Bug history

- Zag #1791 (closed) tab roles with invalid ownership (the reason not to use tabs).
- Zag #3259 (closed) no `type="button"`: a step trigger submitted the form.
- Reka #2437 (open) linear mode still allowed clicking the next step, skipping validation.
- Reka #2777 (closed) unmounted steps still counted.
- Reka #2862, #2864 (closed) invalid HTML in the indicator.
- Reka #1925, #1158 (closed) navigation and state not reachable outside the Root.

## Known pitfalls

- Counting steps from mounted elements breaks with conditional steps (Reka #2777): count
  from the consumer's declaration (`count`, or the registered items, unregistering on
  unmount).
- A validation that runs only on "Next" is skipped by clicking a later step: in linear mode
  only Next moves forward, and it can be refused (`onStepChange` with `cancel()`).
- Moving focus on a programmatic step change (the consumer's own code) steals focus; only
  the user's navigation moves it.
- 1-based vs 0-based: rind-ui uses 0-based indexes like its collections, and "Step 2 of 4"
  in text.

## Testing notes

- Machine in Node: next / previous / go-to, linear rules (back free, forward only by next),
  disabled and completed steps, refusal through cancel, ends.
- DOM: list semantics, `aria-current`, names with status, reachable steps are buttons and
  the rest text, focus to the content region on the user's change only, announcement.
- Model: next / previous / step clicks by pointer and keyboard over linear and non-linear
  configurations.

## Decisions

1. **List semantics, not tabs**: Root (consumer-named group), List (`ol`), Item (`li`,
   `aria-current="step"`), Trigger (a button for reachable steps, else text), Content (the
   current step's region), PrevTrigger, NextTrigger, Progress (optional, "Step 2 of 4").
2. **Controllable `step`** (0-based) with `onStepChange(step, details)`; `details.reason`
   `next` / `prev` / `select` / `api`, cancellable (validation).
3. **`linear`** (default true): back to any visited step; forward only by NextTrigger, one
   step at a time. Non-linear: any step not disabled.
4. **Completed**: a step before the current one is completed unless the consumer passes its
   own `completed` per item (skipped steps).
5. **Focus and announcement** on the user's step change: the Content region (labelled
   "Step 2 of 4: Shipping") gets focus and the change is announced; never on `api` changes.
6. **No arrow-key roving**; Tab order through the reachable steps.

## Open questions

- Should the Content hold every step (each hidden but mounted, so form state survives) or
  only the current one? Decided in the spec: every step's Content stays mounted and hidden
  unless the consumer unmounts it; form values survive navigation.
