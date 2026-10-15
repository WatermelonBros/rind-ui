# Pending amendments

Amendments to changes that are being implemented right now. They are applied at the
next round boundary (when the implementer hands the change off for review), never
mid-round. See CLAUDE.md "Review rules" and the coordination protocol.

## add-a11y-foundations (requested by add-combobox, 2026-10-14)

1. `platform-and-preferences`: add the rendering engine (`webkit` | `blink` | `gecko`) to
   the platform info.
   **APPLIED to add-a11y-foundations (round 1 boundary, 2026-10-14) → task R1.1**
2. `announcer` / `a11y-quirks`: narrow `vo-activedescendant` (per-item highlight
   announcements) to Apple platforms AND the WebKit engine — VoiceOver in Chrome now
   reads options natively and our announcement interrupts it (RA PR #10503); Safari is
   still silent (RA#10326).
   **APPLIED to add-a11y-foundations (round 1 boundary, 2026-10-14) → task R1.2**
3. `a11y-quirks`: add a `vo-section-entry` entry (section label + option count on
   section entry), same gating.
   **APPLIED to add-a11y-foundations (round 1 boundary, 2026-10-14) → task R1.3** (gated on all Apple platforms, per add-combobox request 1 and RA PR #10503; also gates the commit-selection announcement)
4. `announcer`: the result-count announcement of an active-descendant composite is a
   WCAG 4.1.3 status message and is made on ALL platforms (not only Apple).
   **APPLIED to add-a11y-foundations (round 1 boundary, 2026-10-14) → task R1.4**

## add-a11y-foundations (requested by add-label / add-form / add-text-field, 2026-10-14)

5. `press-interactions`: a `labelActivation: "focus" | "activate"` press option — a
   click on the control's label focuses the control and, with `"focus"`, never activates
   it (popup triggers: radix#3679, headlessui#3787). Default `"activate"`.
   **APPLIED to add-a11y-foundations (round 1 boundary, 2026-10-14) → task R1.5**
6. `a11y-quirks`: an entry for detecting React 19's automatic form reset after an action
   (React Aria's `form.reset` heuristic, react-spectrum#6830/#7708), used by add-form to
   keep the action's errors.
   **APPLIED to add-a11y-foundations (round 1 boundary, 2026-10-14) → task R1.6**
7. `a11y-test-tooling` / keyboard: confirm both test adapters can drive a full IME
   composition sequence (compositionstart → updates with isComposing → compositionend →
   commit), and add it if missing.
   **APPLIED to add-a11y-foundations (round 1 boundary, 2026-10-14) → task R1.7**

## add-a11y-foundations (requested by add-link, 2026-10-14) — apply at round 2 boundary

8. `press-interactions`: a press in progress SHALL end (PRESS.CANCEL, no activation,
   `data-pressed` removed) when the pressable loses focus or the document becomes
   hidden (tab switch / app switch during a press).
   **APPLIED (round 2 boundary, 2026-10-14) → task R2.1**

## add-a11y-foundations (requested by add-number-input, 2026-10-14) — apply at round 2 boundary

9. A `core/dom/inject-style.ts` helper (one rule set per document, CSP nonce from the
   environment), generalised from the `touch-action` injection, reused by Scroll Area
   and Number Input.
   **APPLIED (round 2 boundary, 2026-10-14) → task R2.2**
10. `press-interactions`: an opt-in to suppress the touch context menu during a held
    press without making the part long-pressable (stepper auto-repeat).
    **APPLIED (round 2 boundary, 2026-10-14) → task R2.3**
11. `a11y-quirks`: entries `ios-vo-spinbutton-input` and `keypad-decimal-separator`.
    **APPLIED (round 2 boundary, 2026-10-14) → task R2.4**

## CLAUDE.md — APPLIED 2026-10-14 (round 2 boundary of add-a11y-foundations)

- "Every component ships" line → "…, tests, theme stylesheet, stories (rendering the
  themed component), docs page — in that order." (user, theme before stories)
- "Allowed today" runtime dependencies: add `@internationalized/number` (decision 0009).

## add-a11y-foundations (requested by add-calendar / add-date-field, 2026-10-14) — MOVED: add-a11y-foundations was approved after round 3; these become deltas inside add-calendar / add-date-field once it is archived

12. `keyboard-interactions`: a `"grid"` orientation with logical keys `PREV_ROW` /
    `NEXT_ROW` (today `"both"` cannot tell a day move from a week move), and a
    `value: "vertical"` mode for segments (Up/Down step, Left/Right move).
    **DONE as deltas in add-calendar / add-date-field**
13. `a11y-quirks`: reserve `nvda-calendar-focus-mode`; `ios-vo-spinbutton-input` also
    covers date/time segments.
    **DONE as deltas in add-calendar / add-date-field**
