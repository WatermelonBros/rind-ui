// The Tour's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in tour.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"tour"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

const button = {
  "data-focus": "While it has focus.",
  "data-focus-visible": "While it has focus and the last input was not a pointer or touch.",
  "data-pressed": "While it is pressed.",
}

const placement = {
  "data-side": "The physical side it is placed on (`top`, `right`, `bottom`, `left`).",
  "data-align": "The alignment on that side (`start`, `center`, `end`).",
  "data-anchor-hidden": "While the target is scrolled out of view.",
  "data-placing": "Until the first placement of the step.",
}

const run = {
  "data-state": '"open" while the tour runs, else "closed".',
  "data-phase": '"idle", "preparing", "shown" or "waiting".',
  "data-step-type": '"tooltip", "dialog" or "wait": the shown step\'s type.',
}

export const tourMeta = {
  scope: "tour",
  name: "Tour",
  stateless: false,
  parts: [
    {
      name: "Tour.Root",
      part: "root",
      element: "none",
      description:
        "Renders no element: takes the API from `useTour(props)` (`tour`) or the props directly.",
    },
    {
      name: "Tour.Trigger",
      part: "trigger",
      element: "button",
      description:
        'Optional: starts the tour, and is where focus returns. `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` while the card is mounted.',
    },
    {
      name: "Tour.Portal",
      part: "portal",
      element: "none",
      description: "Optional: renders its children in the shared `Portal`.",
    },
    {
      name: "Tour.Backdrop",
      part: "backdrop",
      element: "div",
      description:
        "Dims the viewport with a cutout around the target (`clip-path`); mounted for the whole run, `aria-hidden`, never blocks scrolling or touch.",
    },
    {
      name: "Tour.Spotlight",
      part: "spotlight",
      element: "div",
      description:
        "An element over the padded target rectangle (`--rind-tour-spotlight-*`); a ring for themes, or the pointer shield with `preventTargetInteraction`.",
    },
    {
      name: "Tour.Positioner",
      part: "positioner",
      element: "div",
      description:
        "Placed beside the target by positioning, or centred in the viewport for a dialog step.",
    },
    {
      name: "Tour.Content",
      part: "content",
      element: "div",
      description:
        '`role="dialog"`, `tabindex="-1"`, `aria-modal` for a modal step; named by the title, the consumer, or "Step 3 of 12". The same element for every step.',
    },
    {
      name: "Tour.Arrow",
      part: "arrow",
      element: "div",
      description: "Decorative (`aria-hidden`) arrow pointing at the target; anchored steps only.",
    },
    {
      name: "Tour.Title",
      part: "title",
      element: "h2",
      description: "`h{level}` (default 2); names the card while rendered.",
    },
    {
      name: "Tour.Description",
      part: "description",
      element: "p",
      description: "Describes the card; any content, not only text.",
    },
    {
      name: "Tour.ProgressText",
      part: "progress-text",
      element: "span",
      description: 'Renders `messages.progressText` ("3 of 12"), 1-based, wait steps not counted.',
    },
    {
      name: "Tour.Actions",
      part: "actions",
      element: "none",
      description: "Calls its children with the current step's `actions`.",
    },
    {
      name: "Tour.ActionTrigger",
      part: "action-trigger",
      element: "button",
      description:
        "Runs an action (`next`, `prev`, `dismiss`, `skip` or a function); named by its content, else by `messages`.",
    },
    {
      name: "Tour.CloseTrigger",
      part: "close-trigger",
      element: "button",
      description:
        "Ends the tour with `dismiss`; named by `messages.close` when it has no content of its own.",
    },
  ],
  props: {
    steps: {
      type: "TourStep[]",
      description:
        "The steps: `id`, `title`, `description`, `target`, `type`, `side`, `align`, offsets, `sticky`, `backdrop`, `arrow`, `modal`, `scroll`, `timeout`, `missingTarget`, `preventTargetInteraction`, `actions`, `effect`.",
    },
    tour: {
      type: "TourApi",
      description: "On `Tour.Root`: the API returned by `useTour(props)`, instead of the props.",
    },
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: {
      type: "boolean",
      default: "false",
      description: "Starts after mount (nothing on the server).",
    },
    onOpenChange: {
      type: "(open: boolean, details) => void",
      description:
        "Every request, with `details.reason` (`complete`, `skip`, `dismiss`, `escape-key`, `outside-press`, `outside-focus`, `target-missing`, `steps-changed`, `api`), `stepId`, `stepIndex`, `complete` and `cancel()`.",
    },
    stepId: { type: "string | null", description: "Controlled shown step." },
    defaultStepId: { type: "string", description: "The step a run starts at." },
    onStepChange: {
      type: "(stepId: string, details) => void",
      description:
        "Every step change, with `stepIndex`, `totalSteps`, `progress`, `direction` and `reason`.",
    },
    modal: {
      type: "boolean",
      description: "Every step modal (default: centred steps modal, anchored steps not).",
    },
    closeOnEscape: { type: "boolean", default: "true", description: "Escape ends the tour." },
    closeOnOutsidePress: {
      type: "boolean",
      default: "false",
      description: "A press outside the card and the target ends the tour.",
    },
    closeOnOutsideFocus: {
      type: "boolean",
      default: "false",
      description: "Focus moving outside ends the tour.",
    },
    keyboardNavigation: {
      type: "boolean",
      default: "true",
      description: "ArrowRight / ArrowLeft inside the card move between steps.",
    },
    prepareTimeout: {
      type: "number",
      default: "5000",
      description: "Milliseconds a step's target and effect may take before its policy applies.",
    },
    preventTargetInteraction: {
      type: "boolean",
      default: "false",
      description: "The spotlight swallows pointer presses on the target (never `inert`).",
    },
    spotlight: {
      type: "{ padding?, radius?, content? }",
      default: "{ padding: 8, radius: 8 }",
      description: "Cutout geometry; `content` also cuts out the card.",
    },
    initialFocus: {
      type: "(() => element | null | false) | null",
      default: "null",
      description: "The first focus on start (default: the card).",
    },
    finalFocus: {
      type: "((reason) => element | null | false) | null | false",
      default: "null",
      description: "Where focus returns when the tour ends (default: where it was at start).",
    },
    onMissingTarget: {
      type: "({ stepId, policy }) => void",
      description: "Called when a step's target or effect was not ready in time.",
    },
    persistentElements: {
      type: "() => Element[]",
      description: "Elements whose presses and focus count as inside (a toast region).",
    },
    messages: {
      type: "{ next?, prev?, skip?, close?, finish?, progressText?, stepLabel?, stepAnnouncement? }",
      description: "Every string the tour exposes; English defaults.",
    },
    "*.level": {
      type: "1 | 2 | 3 | 4 | 5 | 6",
      default: "2",
      description: "On `Tour.Title`: its heading level; headings in the card are one deeper.",
    },
    "*.action": {
      type: "TourAction",
      description: "On `Tour.ActionTrigger`: one of the step's actions.",
    },
    "*.render": {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    trigger: {
      ...base("trigger"),
      "data-state": run["data-state"],
      ...button,
      "data-disabled": "Never set (the trigger cannot be disabled).",
    },
    backdrop: { ...base("backdrop"), ...run },
    spotlight: {
      ...base("spotlight"),
      "data-state": '"open" while a step is shown.',
      "data-shield": "While it swallows presses on the target.",
      "data-step-changing":
        "For one step change, until its transition ends or a later scroll or resize: animate the spotlight only under it.",
    },
    positioner: {
      ...base("positioner"),
      ...run,
      "data-modal": "While the shown step is modal.",
      ...placement,
    },
    content: {
      ...base("content"),
      ...run,
      "data-state": '"open" while a step is shown, "closed" while it exits.',
      "data-step": "The shown step's id.",
      "data-step-index": "The shown step's 0-based index.",
      "data-step-count": "The number of steps that are not wait steps.",
      "data-modal": "While the step is modal.",
      "data-first": "On the first step.",
      "data-last": "On the last step.",
      "data-target-missing": "A missing target shown centred (`missingTarget: center`).",
      "data-close-reason": "The close reason while the card exits (`escape-key`).",
      "data-focus-within": "While focus is inside it.",
      "data-focus": "While the card itself has focus.",
      "data-focus-visible": "While the card has focus and the last input was not a pointer.",
      ...placement,
    },
    arrow: {
      ...base("arrow"),
      "data-side": placement["data-side"],
      "data-align": placement["data-align"],
      "data-anchor-hidden": placement["data-anchor-hidden"],
    },
    title: { ...base("title"), "data-level": "The heading level." },
    description: base("description"),
    "progress-text": base("progress-text"),
    "action-trigger": {
      ...base("action-trigger"),
      "data-action": '"next", "prev", "dismiss", "skip" or "custom".',
      "data-disabled": "Back on the first step (still focusable).",
      ...button,
    },
    "close-trigger": { ...base("close-trigger"), ...button },
  },
  keyboard: [
    ["Enter / Space on the trigger", "Starts the tour."],
    ["Enter / Space on an action or close trigger", "Runs it."],
    [
      "ArrowRight / ArrowLeft in the card",
      "Next / Back (swapped right-to-left; never at the ends).",
    ],
    ["Escape", "Ends the tour when it is the topmost layer (`closeOnEscape`)."],
    [
      "Tab / Shift+Tab",
      "Anchored step: the card follows its target in the Tab order. Modal step: wraps inside the card.",
    ],
  ],
  states: {
    idle: "Nothing is mounted; no layer, mark, lock or inert.",
    preparing: "The step's target is awaited and its effect runs; the backdrop stays, no card.",
    active: "A step is shown: one layer per step, modal or not, focus moved in on the first.",
    waiting: "A wait step: no card; its effect moves the tour on.",
  },
  contract: {
    actions: {
      start: ["pointer", "touch", "keyboard", "virtual"],
      next: ["pointer", "touch", "keyboard", "virtual"],
      prev: ["pointer", "touch", "keyboard", "virtual"],
      skip: ["pointer", "touch", "keyboard", "virtual"],
      dismiss: ["pointer", "touch", "keyboard", "virtual"],
      pressEscape: ["keyboard"],
      pressOutside: ["pointer", "virtual"],
      pressArrow: ["keyboard"],
      tab: ["keyboard"],
      shiftTab: ["keyboard"],
      waitForReady: ["pointer", "touch", "keyboard", "virtual"],
      waitForStep: ["keyboard"],
      waitForUnmount: ["keyboard"],
    },
    queries: [
      "side",
      "align",
      "isAnchorHidden",
      "isPlaced",
      "isOpen",
      "phase",
      "stepId",
      "stepIndex",
      "totalSteps",
      "title",
      "description",
      "progressText",
      "isModal",
      "hasFocus",
      "isTopmost",
      "spotlightRect",
      "closeReason",
    ],
    traits: ["layer", "restores-focus", "presence", "anchored"],
  },
} as const satisfies ComponentMeta
