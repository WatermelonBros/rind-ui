# Timer — research

Status: done · Wave: 3

A Timer shows a running time: a countdown to a target (an auction, an exam, a promo, a
reservation hold) or a stopwatch counting up, with start, pause, resume, reset and restart
controls. It is a display, not an input: nobody types a time into it. Of the nine libraries
only Ark/Zag ships one. The other libraries leave it to `setInterval` in app code, which is
exactly where the bug history comes from: the time drifts, stops in a background tab, or
overshoots its target. This note records Zag's design, every bug its trackers recorded, the
accessibility of a changing time, and the decisions for `add-timer`.

Builds on the cross-cutting notes [accessibility.md](accessibility.md) §7 (live regions),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes A, D, H,
[native-platform.md](native-platform.md) (Intl), and rind-ui's injected `Clock`, `Scheduler`,
`PageVisibility` and `Announcer` (core `env/capabilities.ts`), the same ones Toast times with.

Sources read (local shallow clones, 2026-10-26):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/timer/src/{timer.machine,timer.connect,timer.dom,timer.types,timer.anatomy,timer.parse,timer.props}.ts`, `CHANGELOG.md`; `ark/packages/react/src/components/timer/*` |
| Trackers | chakra-ui/zag (search "timer"), chakra-ui/ark (search "timer") |
| Platform | `role="timer"` (WAI-ARIA 1.2), `Intl.DurationFormat`, `Intl.NumberFormat`, Page Visibility, timer throttling in background tabs (Chrome, Safari, Firefox) |

Radix, React Aria, Base UI, Headless UI, Ariakit, Reka UI, Bits UI and Kobalte ship no Timer
(search "timer", "countdown", "stopwatch" on their trackers, 2026-10-26).

## Pattern

- WAI-ARIA APG: **none**. WAI-ARIA 1.2 defines `role="timer"`: "a numerical counter which
  indicates an amount of elapsed time from a start point, or the time remaining until an end
  point". Its implicit `aria-live` is `off`: assistive technology does not announce each
  change, and the user reads it on demand. That is the right default: a live region that speaks
  every second makes a page unusable (accessibility.md §7).
- What *does* need announcing: the transitions the user did not cause or cannot see, chiefly
  completion ("Time's up"). Start, pause and reset follow a press of the user's own button, so
  the button's state is enough.
- WCAG 2.2.1 (Timing Adjustable) is about the page that uses the timer (extend, turn off);
  the component's job is to make pause and resume possible and reachable.
- The controls are buttons (Button pattern). A control that disappears when the state changes
  drops keyboard focus to `<body>` (cause D): Zag hides `start` once running and shows `pause`,
  so a keyboard user who presses Start loses focus.

## How Zag / Ark built it

- **Anatomy**: `root`, `area` (`role="timer"`, `aria-atomic`, `aria-label` = the formatted
  time), `control`, `item` (`data-type` = days | hours | minutes | seconds | milliseconds,
  `--value`), `itemValue`, `itemLabel`, `separator` (`aria-hidden`), `actionTrigger` (`action` =
  start | pause | resume | reset | restart).
- **Props**: `countdown`, `startMs`, `targetMs`, `autoStart`, `interval` (default 1000, was
  250), `onTick({ value, time, formattedTime })`, `onComplete`, `translations.areaLabel`.
- **States**: `idle`, `running`, `paused`, `running:temp` (a one-frame hop used to restart).
  Completion goes back to `idle`: a finished countdown and an untouched one look the same.
- **Ticking**: `setRafInterval` sends `TICK { deltaMs }`; `updateTime` adds
  `floor(deltaMs / interval) * interval` to `currentMs`, clamped to `targetMs`.
- **Action triggers**: the inapplicable ones get `hidden` (start while running, pause while
  not running, resume while not paused, reset while idle).
- **Validation**: throws on a negative or inconsistent `startMs` / `targetMs`, a non-positive
  `interval`.
- **Format**: `padStart(2)` on each unit, milliseconds to 3; the area label is
  `"${days} days ${hh}:${mm}:${ss}"`, English, until `translations` (1.36.0).

## Bug history

| Bug | Where | Cause | Decision |
|---|---|---|---|
| Stops when switching tabs | zag#2226, ark#3298, fixed 1.3.3 | rAF does not run in a hidden tab, so no `TICK`, no time | Time is **derived from the clock**, never accumulated: `value = base ± (clock.now() − startedAt)`. A missed tick costs nothing. |
| Slows down in a background tab | zag 1.3.3 changelog | Each tick floors its delta to the interval and drops the remainder; throttled ticks (≥ 1 s) lose up to an interval each | Same: no accumulation, no rounding of elapsed time; only the *display* is floored. |
| Continues beyond `targetMs` when the window is not visible | zag#2549, fixed 1.17.2 | The overshooting tick was clamped but completion compared with `===` (zag#2254) | Completion is `value` reaching the target in the clock's terms, `<=` / `>=`; the value is clamped. A completion timeout is scheduled for the exact remaining time, and re-checked when the page becomes visible. |
| Does not stop at `targetMs`, goes negative | zag#2254 | `currentMs === targetMs` with deltas that skip it | As above. |
| Not updated when `startMs` changes | zag#2262, fixed 1.0.1 | The machine read `startMs` once | A change of `startMs` (or `targetMs`, `countdown`) while idle resets to the new start; while running or paused it restarts from the new start in the same state (spec). |
| Runs 100× faster | zag#2335 (Ark 5) | A second ticking effect started on re-render | One ticking effect, owned by the state (`running`); the machine runtime's effect cleanup is tested. |
| `derived_inert` warning in Svelte | zag#3365 | A scheduled tick read props after the machine stopped | Every scheduled callback is cleared by the effect cleanup; the adapters' unmount tests cover it. |
| `asChild` drops the element on `Timer.Item` (Vue) | ark#4186 | Adapter | Every part accepts `render` / the framework's equivalent; adapter tests. |
| Hidden action triggers drop focus | Zag connect (no issue) | `hidden` on the focused button | Triggers are never hidden by core: an inapplicable action is `disabled` (focusable, `aria-disabled`). A `toggle` action (start / pause / resume by state) gives the common single play–pause button. |
| Area label is English and reads "0 days 00:01:05" | Zag connect, 1.36.0 `translations` | Hard-coded format | The area's name is the duration in words, from `Intl.DurationFormat` (`style: "long"`) for the component's locale, falling back to messages when the engine lacks it; leading zero units are omitted ("1 minute, 5 seconds"). |

## Platform notes

- **Background tabs**: Chrome throttles `setTimeout` in hidden tabs to once per second, and
  intensive throttling to once a minute after 5 minutes; Safari and Firefox throttle too. A
  value derived from the clock is right whenever it is read; completion can fire late by the
  throttle while hidden, so on `visibilitychange` to visible the machine re-checks completion
  at once (it fires `onComplete` once, with the real time).
- **Clock**: `performance.now()` (monotonic), not `Date.now()`: a system clock change must not
  jump the timer. rind-ui's `Clock` capability is monotonic in the DOM environment and virtual
  in tests.
- **Formatting**: `Intl.NumberFormat(locale, { minimumIntegerDigits: 2 })` for each unit (Arabic
  and Devanagari digits come out right), `Intl.DurationFormat` for the spoken form (Chrome 129,
  Safari 16.4, Firefox 136).
- **Ticks aligned to the interval**: the next tick is scheduled for the next interval boundary
  of the elapsed time, so seconds change on the second and a long-running timer does not
  stutter.

## Accessibility decisions

- `Area`: `role="timer"`, no `aria-live` override (implicit `off`), `aria-atomic="true"`,
  named by the spoken duration (`aria-label`), which updates with the value: reading it on
  demand gives the current time in words, never "zero zero colon zero five".
- `Item`, `ItemValue`, `Separator`: presentation; the separator `aria-hidden`.
- Completion is announced through the Announcer (`messages.completed`, "Time's up"), politely;
  nothing else is announced.
- `ActionTrigger`: a button; inapplicable actions are disabled, never hidden; `toggle` names
  itself from messages by state ("Start", "Pause", "Resume") with `aria-pressed` absent (its
  name changes, which is acceptable for a button whose action changes, Button pattern).

## Decisions for `add-timer`

1. States `idle`, `running`, `paused`, `completed` (not back to `idle`): `data-state` on every
   part, so a finished countdown can be styled.
2. Props: `countdown`, `startMs` (default 0), `targetMs` (default 0 for a countdown, none for a
   stopwatch), `autoStart`, `interval` (default 1000; the display granularity), `onTick`,
   `onComplete`, `onStateChange`, `messages`, `locale`. Invalid configurations warn in
   development and are normalised (no throw on render).
3. Time from the injected `Clock`; ticks on the injected `Scheduler`, aligned to the interval;
   `PageVisibility` re-checks on becoming visible.
4. Actions: `start`, `pause`, `resume`, `reset`, `restart`, `toggle`; never hidden.
5. Parts: `Root`, `Area`, `Control`, `Item` (`type`), `ItemValue`, `ItemLabel`, `Separator`,
   `ActionTrigger` (`action`). CSS variables on `Root`: `--rind-timer-progress` (0–1).
6. Contract actions `start`, `pause`, `resume`, `reset`, `restart`, `toggle`; queries `state`,
   `value` (ms), `label` (the area's name).
7. Non-goals: a date target ("until 18:00"; the app computes `startMs`), a lap list, sound.
