# Context Meter — research

Status: done · Wave: AI

A Context Meter shows how much of a model's context window a conversation has used: "42,310 of
200,000 tokens (21%)". It is a gauge with a number behind it, usually a small ring or bar next to
the prompt, and often a popover with the breakdown (input, output, reasoning, cached). Its job is
to warn the user before the window fills and the model forgets or the chat compacts. It is a
display, not an input, and the component never counts tokens: the consumer passes `used` and
`max`. Of the nine headless libraries none ships it. Vercel AI Elements ships `Context`; the
other kits show usage as text or leave it out. rind-ui already owns the primitive: Meter
(`role="meter"`, zones, `data-zone`). This note records how AI Elements built it, the bugs on
its tracker and the accessibility of a number that changes while the model streams, and the
decisions for `add-context-meter`.

Builds on [meter.md](meter.md) (value, `low` / `high` / `optimum`, `data-zone`),
[progress.md](progress.md) (why a context fill is not progress), [popover.md](popover.md) and
[hover-card.md](hover-card.md) (the breakdown), [timer.md](timer.md) (a changing value and
`role="timer"`), [streaming-message.md](streaming-message.md) (what updates the number), and the
cross-cutting notes [accessibility.md](accessibility.md) §7 (live regions),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes A, D, H and
[native-platform.md](native-platform.md) (`Intl.NumberFormat`).

Sources read (GitHub API and `gh`, 2026-10-26):

| Library | Files |
|---|---|
| Vercel AI Elements | `vercel/ai-elements` `packages/elements/src/context.tsx` (409 lines: `Context`, `ContextIcon`, `ContextTrigger`, `ContextContent`, `ContextContentHeader`, `ContextContentBody`, `ContextContentFooter`, `ContextInputUsage`, `ContextOutputUsage`, `ContextReasoningUsage`, `ContextCacheUsage`) |
| assistant-ui | `packages/ui/src/components/react/assistant-ui/utils/context-usage.ts`, `.../utils/context-display-state.ts`, `.../elements/context-display{,.aui,.radix}.tsx` (grepped for `aria`, `role`, `Tooltip`, `Trigger`; not read in full) |
| Open WebUI | `open-webui/open-webui` issues #32854 (usage info button), #30035 (context compaction), #32811 (reply start and finish not announced) |
| Platform | WAI-ARIA APG Meter pattern; HTML `<meter>`; `Intl.NumberFormat` (`notation: "compact"`, `style: "percent"`) |

Radix, React Aria, Ark/Zag, Base UI, Headless UI, Ariakit, Reka UI, Bits UI and Kobalte ship no
Context Meter. assistant-ui ships `ContextDisplay` (see below). prompt-kit has no context-usage
component (its `components/prompt-kit` tree lists none, 2026-10-26). React Aria and Base UI
ship a generic `Meter` (meter.md), which is the base.

## Pattern

- WAI-ARIA APG **Meter**: "A meter is a graphical display of a numeric value that varies
  within a defined range." Required: `role="meter"`, `aria-valuenow`, `aria-valuemin`,
  `aria-valuemax`, a name through `aria-labelledby` or `aria-label`. Keyboard: not applicable.
  APG's note: "The meter should not be used to indicate progress, such as loading or percent
  completion of a task"; use `progressbar` for that. A context window filling over a
  conversation is a quantity in a range, not task completion, so `meter` is right.
- Value text: `aria-valuetext` is the human sentence ("42,310 of 200,000 tokens, 21 percent");
  without it a screen reader reads the bare `aria-valuenow`.
- Not live: `role="meter"` has no implicit live region. The meter changes on every streamed
  turn; announcing each change would speak all the time (accessibility.md §7). The things worth
  announcing are **threshold crossings** the user did not cause (WCAG 4.1.3 Status Messages):
  "Context 80% full", "Context full".
- A popover with the breakdown is a disclosure: a button with `aria-expanded` opening a
  popover (rind-ui Popover). Content that appears **only on hover** fails WCAG 1.4.13 on touch
  and for keyboard users unless it is also reachable by focus or press.

## How the others built it

### Vercel AI Elements (`Context`)

- `Context` is a shadcn **`HoverCard`** (`openDelay={0}`, `closeDelay={0}`) with a context
  provider for `{ usedTokens, maxTokens, usage, modelId }`. The consumer passes the numbers; it
  computes nothing from text.
- `ContextTrigger` renders a ghost `Button` with the percent (`Intl.NumberFormat("en-US",
  { style: "percent", maximumFractionDigits: 1 })`, hard-coded locale) and a `ContextIcon`.
- `ContextIcon` is an `svg` with `role="img"` and a **static** `aria-label="Model context
  usage"`: two `circle`s with `strokeDashoffset` computed from `used / max`. The label never
  carries the value, so the ring tells assistive technology nothing about the fill. The
  visible percent text beside it is in the button, so the button's name does include it; the
  `role="img"` name does not.
- `ContextContentHeader` shows the percent, the used and max tokens (compact notation) and a
  shadcn `Progress` (`value={usedPercent * 100}`): a `progressbar`, although the quantity is a
  meter.
- Usage rows: `ContextInputUsage`, `ContextOutputUsage`, `ContextReasoningUsage`,
  `ContextCacheUsage` (per-category counts).
- Division by `maxTokens` is unguarded in the icon and the trigger (`usedTokens / maxTokens`);
  `used > max` is not clamped in what was read.
- No thresholds or zones, no colour change, no announcement.

### assistant-ui (`ContextDisplay`)

- `ContextDisplay.Root` / `Trigger` / content: a Radix-style **Tooltip** on a trigger, in three
  presentations (bar, ring, text), each with a static `aria-label="Context usage"` on the
  trigger: the name never carries the number.
- `context-usage.ts`: `getUsagePercent(total, window)` clamps at 100 and returns 0 for a
  falsy total; severity is `normal` below 65 %, `warning` from 65 %, `critical` above 85 %,
  and the severity maps only to colours (`stroke-red-500`, `bg-amber-500`, `text-red-500`):
  no text and no attribute carries the zone.
- A comment in `getContextSegments` records a real data hazard: providers differ on whether
  cached tokens are inside `inputTokens` (OpenAI's `cached_tokens` is a subset of
  `prompt_tokens`; Anthropic's `input_tokens` excludes `cache_read_input_tokens`), so segments
  are shown as counts and not as shares of the bar, "which stays the one reading that always
  holds: the provider's own total against the window".
- `useContextDisplayState(usage, resetKey, window)` keeps the last positive total and resets
  when `resetKey` changes (a new thread), so a turn that reports no usage does not blank the
  gauge.

### Open WebUI

- Shows reply usage in an "i" button's tooltip; see bug #32854. Compaction (summarising old
  turns when the window fills) is a real behaviour tied to the number
  ([#30035](https://github.com/open-webui/open-webui/issues/30035): compaction keeps a
  percentage of the **message count**, so chats with very large messages compact again every
  turn): the meter's number must be tokens, not messages.

### Not shipped

prompt-kit: no context meter in its component tree. LlamaIndex chat-ui and Chainlit were not
searched for one. React Aria `Meter` and Base UI `Meter` (see meter.md) are generic ranges.

## Bug history

Search: `vercel/ai-elements` for "context", "usage", "token"; `open-webui/open-webui` for
"context window", "token usage", "usage info" (open and closed), about 40 titles listed, those
below read.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| AI Elements | [#459](https://github.com/vercel/ai-elements/issues/459) | `usage` typed as the SDK's `LanguageModelUsage` forces callers to supply nested token detail the element never reads | the prop type copies the SDK shape | open (title and summary read) | the component's own minimal types: `used`, `max`, and a `breakdown` list of `{ key, label, value }`; no SDK types in the public API |
| AI Elements | [#500](https://github.com/vercel/ai-elements/issues/500) | `ContextReasoningUsage` and `ContextCacheUsage` do not compile with `ai` 7 | the same coupling | open (title only) | same |
| assistant-ui | `context-display` (source, no issue) | trigger named "Context usage" with no value; severity by colour only; Tooltip as the only breakdown | design | open (by design) | the value is in the name or value text; the zone is text and `data-zone`; the breakdown is a disclosure |
| assistant-ui | `context-usage.ts` comment (no issue) | cached and reasoning tokens counted inside or outside input / output depending on the provider | provider differences | documented in code | the component takes `used` and `max` as given; a breakdown is a list of counts, never shares of the bar |
| AI Elements | `context.tsx` (source, no issue) | `role="img"` ring with a constant name; value only in neighbouring text | design | open (by design) | the ring is decoration (`aria-hidden`) over a real `role="meter"` whose `aria-valuetext` is the sentence |
| AI Elements | `context.tsx` (source, no issue) | `Progress` used for a fill that is not progress; `Intl` locale hard-coded to `en-US` | design | open (by design) | `meter`, not `progressbar`; locale from the environment |
| AI Elements | `context.tsx` (source, no issue) | `usedTokens / maxTokens` with no guard | design | open (by design) | `max` unknown, 0 or less than `used` are modelled states (see decisions) |
| AI Elements | `context.tsx` (source, no issue) | the breakdown lives in a `HoverCard` opened on pointer | design | open (by design) | breakdown reachable by press and by focus (Popover), not hover only |
| Open WebUI | [#32854](https://github.com/open-webui/open-webui/issues/32854) | the "i" button under a reply: hidden from screen readers yet Tab stops on it; usage tooltip not read | a focusable control hidden from the accessibility tree | closed | the figures are real text on a named control; never `aria-hidden` on something focusable |
| Open WebUI | [#32811](https://github.com/open-webui/open-webui/issues/32811) | the user is not told when a reply starts or finishes | no status message | closed | the meter updates silently; only threshold crossings are announced, once |
| Open WebUI | [#30035](https://github.com/open-webui/open-webui/issues/30035) | context compaction counted messages, not tokens | proxy for size | closed | the unit of `used` and `max` is the consumer's number (tokens), not derived by the component |
| rind-ui Meter | `meter.md` | NVDA wording for `meter` and its filler | registered quirk | n/a | reuse the Meter's value text and quirk handling |

## Accessibility decisions

- **`role="meter"` with a name and `aria-valuetext`**, from Meter. Default text: "{used} of
  {max} tokens used ({percent})", numbers through `Intl.NumberFormat` (`notation: "compact"`
  optional), messages overridable. The visible percent is `aria-hidden` when the meter's
  value text already says it (no double reading).
- **Never a live region.** The streamed update changes `aria-valuenow` silently. The
  transitions announced (polite, once per crossing, via the Announcer): entering the
  `warning` zone and entering the `full` zone ("Context 80% full", "Context full"). A
  decrease (compaction, a new chat) re-arms the thresholds and is announced as "Context
  reset" only when the consumer enables it.
- **No colour-only status.** The zone is in text in the value text ("warning") and in
  `data-zone`; the theme may add colour and an icon, never colour alone (WCAG 1.4.1).
- **Unknown or invalid max.** `max` null, 0 or not finite means the window is unknown: no
  `role="meter"` (a meter without a range is invalid); the Root renders the used count as
  text (`data-state="unknown"`). `used > max` is clamped for the fill and reported as
  `data-state="over"` with value text "over the limit".
- **The breakdown is a disclosure**, not a hover card: a named trigger button
  (`aria-expanded`, `aria-haspopup="dialog"`), the content in rind-ui's Popover, a list of
  `Term: value` rows (`dl`). Also openable by hover when the consumer composes Hover Card;
  the default is press.
- **Trigger name** includes the value: the button contains the visible text and the meter,
  so the accessible name reads the same as the value text (name matches visible label,
  WCAG 2.5.3).
- **Reduced motion**: the fill does not animate under `prefers-reduced-motion` (theme).
- **Touch and zoom**: the ring has a minimum hit area of 24 by 24 CSS px (WCAG 2.5.8).

## Testing notes

- Pure model in Node: `percent`, zone for given `warnAt` / `fullAt`, clamping, unknown
  `max`, threshold events (rising edge once; no repeat while above; re-arm below), compact
  formatting by locale.
- Browser: `role="meter"` attributes, `aria-valuetext` updates with `used`, announcements
  recorded (0 while streaming below a threshold, 1 on crossing), the disclosure opens by
  Enter and Space and closes by Escape with focus back on the trigger, axe on the meter in
  every zone (contrast of the fill), forced-colors.
- Property: a monotone stream of `used` values yields at most one announcement per
  threshold.

## Decisions for `add-context-meter`

- **One widget over Meter, no new primitive**: `Root` is the Meter machine's Root
  (`role="meter"`) with the AI semantics added in the connect (`aria-valuetext`, thresholds).
  The Context Meter machine wraps Meter's value model (`range-value.ts`) and adds the
  thresholds and the unknown / over states; Meter itself is unchanged.
- **Parts**: `Root` (`div`, `role="meter"`), `Label` (visible name, optional), `ValueText`
  (the visible "21%"; `aria-hidden` when `aria-valuetext` carries it), `Track` / `Indicator`
  (linear, `--rind-context-meter-percent`), `Ring` (optional SVG-free ring: a styled
  `Indicator` through the theme's conic-gradient recipe; decoration, `aria-hidden`),
  `Trigger` (a `button` opening the breakdown), `Content` (Popover content), `Breakdown`
  (`dl`), `BreakdownItem` (`dt` / `dd`). Only `Root` is required.
- **Machine** `context-meter`: states `ok | warning | full | over | unknown`, derived from
  `used`, `max`, `warnAt` (default 0.75) and `fullAt` (default 0.95), as a pure function so
  the contract and `testMachine` apply; events `VALUE.CHANGE` (from props) and `ARM` /
  `DISARM` for the announced thresholds. Effects: `announce` on a rising edge.
- **Props**: `used: number`, `max: number | null`, `warnAt`, `fullAt`, `formatOptions`
  (default compact tokens), `locale`, `announce: "off" | "polite"` (default `"polite"`),
  `resetKey?: string` (a new thread re-arms thresholds), `breakdown?: { key: string; label: string; value: number }[]`, `messages` (`valueText`,
  `warning`, `full`, `over`, `unknown`).
- **Thresholds**: defaults `warnAt` 0.75 and `fullAt` 0.95 (assistant-ui uses 65 % and 85 %;
  there is no standard, so both are props).
- **Zones**: `data-zone` (`ok | warning | full`), identical to Meter's attribute family;
  `data-state` (`ok | warning | full | over | unknown`).
- **`data-*`**: `data-scope="context-meter"`; Root `data-state`, `data-zone`,
  `data-percent` (0 to 100, one decimal), `data-used`, `data-max`; Trigger `data-state`
  (`open | closed`); Breakdown items `data-key`.
- **Contract**: locate by role `meter` and name. Actions `open` / `close` (breakdown),
  `setUsed(n)` (an Env action driving the prop in tests). Queries `used`, `max`, `percent`,
  `zone`, `valueText`, `announcements`, `breakdown`, `isOpen`.
- **Reuse**: Meter's `range-value.ts`, Popover for the breakdown, the Announcer, `Intl`.
- **Deliberately different from AI Elements**: `meter`, not `progressbar` or a bare
  `role="img"`; the number is in the accessible name; thresholds are announced once and the
  stream is silent; the breakdown opens on press and focus, not hover only; no SDK types in
  the API; locale from the environment, not `en-US`; the zone is never colour alone
  (assistant-ui); a reset key re-arms the thresholds (assistant-ui's `resetKey`).
- **Non-goals**: counting tokens or choosing a tokenizer; cost or price (a consumer part in
  `BreakdownItem`); compaction logic and its trigger (the consumer reacts to `onThreshold`);
  a per-model window table; a chart over time.

## Open questions

- **Ring**: a conic-gradient ring in the theme only, or a shared ring recipe with Progress
  (meter.md already asks this). Defer to the theme change; the parts above work for both.
- **Announce a decrease** ("Context reset") by default or opt-in? No kit announces anything;
  the manual NVDA and VoiceOver pass decides.
- **Should the threshold announcement be assertive at `full`?** The model is about to forget
  context; polite is the default until a user study says otherwise.
