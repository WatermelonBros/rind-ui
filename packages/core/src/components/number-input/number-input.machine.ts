// Number Input (design §3): `idle` / `composing` / `pressing` / `spinning`, one controllable
// `value` (number or null), free text in context. Typing never changes the value: blur,
// Enter, keys, steppers, wheel, paste and reset do, each through `write`. Delays come from
// the injected scheduler, so press-and-hold runs in Node with fake timers.

import type { PointerKind } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import type { FormInputCapability } from "../../dom/hidden-input"
import type { AnnouncerEnv, SchedulerEnv } from "../../env/capabilities"
import type { LocaleNumberParser } from "../../i18n/number-parser"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import { canStep, clampTo, type NumberRange, nextStep, snapValue } from "./number-input.math"
import type { NumberInputMessages } from "./number-input.messages"

export type Trigger = "increment" | "decrement"
export type NumberInputKey = "INCREASE" | "DECREASE" | "PAGE_PREV" | "PAGE_NEXT" | "FIRST" | "LAST"

export type NumberInputEvent =
  /** An accepted edit (the insertion plan passed). */
  | { readonly type: "INPUT"; readonly text: string }
  | { readonly type: "COMMIT"; readonly source: "blur" | "enter" }
  /** A paste replacing the whole text, already known to parse. */
  | { readonly type: "PASTE"; readonly text: string }
  | { readonly type: NumberInputKey; readonly large: boolean; readonly modality: Modality }
  | { readonly type: "WHEEL"; readonly direction: 1 | -1; readonly large: boolean }
  | {
      readonly type: "PRESS.START" | "PRESS" | "PRESS.END" | "PRESS.CANCEL"
      readonly trigger: Trigger
      readonly pointerType: PointerKind
      readonly modality: Modality
    }
  /** The pointer left a held trigger: repeats stop. */
  | { readonly type: "PRESS.LEAVE" }
  | { readonly type: "COMPOSITION.START" }
  | { readonly type: "COMPOSITION.END"; readonly text: string }
  | { readonly type: "FOCUS"; readonly modality: Modality }
  | { readonly type: "BLUR" }
  | { readonly type: "RESET" }
  /** The hidden input changed behind the component (autofill). */
  | { readonly type: "INPUT.ADOPT"; readonly value: number | null }
  /** The controlled value prop changed (onProps). */
  | { readonly type: "VALUE.SYNCED" }
  /** `disabled` or `readOnly` changed (onProps): a held trigger stops (base-ui#5434). */
  | { readonly type: "LOCK.CHANGED" }

/** Public change reasons (spec "Value And Callbacks"). */
export type NumberInputReason =
  | "INPUT.COMMIT"
  | "STEP"
  | "EDGE"
  | "WHEEL"
  | "PASTE"
  | "SPIN"
  | "RESET"

export interface NumberInputCommitDetails {
  readonly reason: NumberInputReason
}

export interface NumberInputProps extends NumberRange {
  readonly value?: number | null | undefined
  readonly defaultValue?: number | null | undefined
  readonly onValueChange?:
    | ((value: number | null, details: ChangeDetails<NumberInputEvent>) => void)
    | undefined
  readonly onValueCommit?:
    | ((value: number | null, details: NumberInputCommitDetails) => void)
    | undefined
  readonly onInputValueChange?: ((text: string) => void) | undefined
  /** `snap` (default): clamp and snap at commit; `validate`: keep and let validity report. */
  readonly commitBehavior?: "snap" | "validate" | undefined
  readonly spinOnPress?: boolean | undefined
  /** Before the first repeat (default 400 ms; 600 ms for touch). */
  readonly spinDelay?: number | undefined
  readonly spinInterval?: number | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** The locale's parser for the format options (number-parsing). */
  readonly parser: LocaleNumberParser
  readonly messages: NumberInputMessages
  /** Keys the field's announcements. */
  readonly id: string
}

export interface NumberInputEnv extends SchedulerEnv, Partial<AnnouncerEnv> {
  /** Absent where there is no DOM (a model test's oracle). */
  readonly formInput?: FormInputCapability | undefined
}

export interface NumberInputContext {
  /** The input's text: free while editing, the formatted value otherwise. */
  text: string
  /** Edited since the last commit. */
  dirty: boolean
  /** A blur arrived while composing: commit when the composition ends. */
  commitAfterComposition: boolean
  focused: boolean
  /** The numbering system the user typed (kept when reformatting). */
  numberingSystem: string | undefined
  trigger: Trigger | null
  pointerType: PointerKind | null
  /** A mouse or pen press stepped on PRESS.START: its trailing PRESS is swallowed. */
  steppedOnStart: boolean
  /** The press repeated: a touch release does not step again. */
  spun: boolean
  /** The value when a press began (commit only when it changed). */
  start: number | null | undefined
  /** A controlled proposal not yet applied: its input events and commit run when it is. */
  pending: {
    readonly value: number | null
    readonly user: boolean
    readonly commit: NumberInputReason | null
  } | null
}

type Args = ActionArgs<{
  props: NumberInputProps
  events: NumberInputEvent
  env: NumberInputEnv
  context: NumberInputContext
  values: "value"
}>

/** null as the runtime's fallback: the empty value (a controlled null is a value). */
const EMPTY = null as unknown as number

const isPercent = (props: NumberInputProps) => props.parser.resolved.style === "percent"
const currentValue = (args: Pick<Args, "values">): number | null => args.values.value ?? null
const latest = (args: Args): number | null =>
  args.context.pending ? args.context.pending.value : currentValue(args)
const controlled = (props: NumberInputProps) => props.value !== undefined

export const formatValue = (v: number | null, props: NumberInputProps, nu?: string) =>
  v === null ? "" : props.parser.format(v, { step: props.step, numberingSystem: nu })

/** What a commit does to a number: snap and clamp (`snap`) or keep (`validate`). */
function normalise(v: number, props: NumberInputProps): number {
  const kept = props.commitBehavior === "validate" ? v : snapValue(v, props)
  // Explicit rounding options: the value of the shown text is the value (WYSIWYG).
  return props.parser.parse(props.parser.format(kept, { step: props.step })) ?? kept
}

function commit(props: NumberInputProps, value: number | null, reason: NumberInputReason) {
  props.onValueCommit?.(value, { reason })
}

/** The text after a value resolves (zag#3444: right after a refusal or a parent clamp). */
function resyncText(args: Args) {
  const { set, props, context } = args
  set("text", formatValue(currentValue(args), props, context.numberingSystem))
  set("dirty", false)
}

/**
 * The one write: proposes `next`; uncontrolled, an accepted change mirrors the hidden input
 * (user changes dispatch input/change) and commits now; controlled, both wait for the prop.
 * Returns whether the value changes (or was proposed).
 */
function write(
  args: Args,
  next: number | null,
  o: { readonly user: boolean; readonly commit: NumberInputReason | null },
): boolean {
  const { props, set, env } = args
  if (Object.is(latest(args), next)) return false
  set("value", next ?? EMPTY)
  if (controlled(props)) {
    set("pending", { value: next, user: o.user, commit: o.commit })
    return true
  }
  if (!Object.is(currentValue(args), next)) return false // refused through details.cancel()
  env.formInput?.sync({ value: next === null ? "" : String(next) }, { dispatch: o.user })
  if (o.commit !== null) commit(props, next, o.commit)
  return true
}

/** The base of a step: the typed text while edited (ark#1838), else the value. */
const stepBase = (args: Args) =>
  args.context.dirty ? args.props.parser.parse(args.context.text) : latest(args)

function announce(args: Args, message: string) {
  args.env.announcer?.announce({
    message,
    priority: "polite",
    key: `number-input-${args.props.id}`,
  })
}

const valueText = (args: Args, v: number | null) =>
  v === null
    ? args.props.messages.empty
    : args.props.messages.valueText({
        value: v,
        text: args.props.parser.valueText(v, { step: args.props.step }),
      })

const remote = (pointerType: PointerKind | null) =>
  pointerType === "touch" || pointerType === "virtual"

function stepOnce(
  args: Args,
  direction: 1 | -1,
  size: "step" | "large",
  reason: NumberInputReason | null,
) {
  const next = nextStep(stepBase(args), direction, size, args.props, isPercent(args.props))
  const changed = write(args, next, { user: true, commit: reason })
  resyncAfterWrite(args)
  return changed
}

/** Uncontrolled the text follows at once; controlled it follows the prop (VALUE.SYNCED). */
function resyncAfterWrite(args: Args) {
  if (!controlled(args.props) || args.context.pending === null) resyncText(args)
  else args.set("dirty", false)
}

/** Blur or Enter: empty → null; garbage restores; else normalised and written. */
function commitTextNow(args: Args) {
  const { context, props, set } = args
  if (!context.dirty) return
  const typed = context.text
  if (typed.trim() === "") {
    write(args, null, { user: true, commit: "INPUT.COMMIT" })
    resyncAfterWrite(args)
    return
  }
  const parsed = props.parser.parse(typed)
  if (parsed === null) {
    // Garbage restores the formatted value (react-spectrum#3862), announced once.
    resyncText(args)
    announce(args, props.messages.committed(valueText(args, currentValue(args))))
    return
  }
  set("numberingSystem", props.parser.numberingSystem(typed))
  const next = normalise(parsed, props)
  write(args, next, { user: true, commit: "INPUT.COMMIT" })
  resyncAfterWrite(args)
  // The typed number was rewritten (clamped, snapped, rounded): say so (react-spectrum#4967).
  if (next !== parsed) announce(args, props.messages.committed(valueText(args, next)))
}

const directionOf = (t: Trigger | null): 1 | -1 => (t === "decrement" ? -1 : 1)

export const numberInputMachine = /* @__PURE__ */ setup({
  types: type<{
    props: NumberInputProps
    events: NumberInputEvent
    env: NumberInputEnv
    context: NumberInputContext
    values: "value"
  }>(),
  guards: {
    editable: ({ props }) => props.disabled !== true && props.readOnly !== true,
    /** The pressed trigger can move the value (aria-disabled otherwise). */
    canStepTrigger: ({ props, values, event }) => {
      if (props.disabled === true || props.readOnly === true) return false
      const trigger = "trigger" in event ? event.trigger : null
      return canStep(values.value ?? null, directionOf(trigger), props)
    },
    /** The held trigger can still move (repeats stop at the bound: base-ui#3887). */
    canKeepSpinning: (args) =>
      args.props.disabled !== true &&
      args.props.readOnly !== true &&
      canStep(latest(args as never), directionOf(args.context.trigger), args.props),
    spins: ({ props }) => props.spinOnPress !== false,
    locked: ({ props }) => props.disabled === true || props.readOnly === true,
    dirty: ({ context }) => context.dirty,
    /** A press that activates on release: touch (not repeated), keyboard, assistive tech. */
    activatesOnRelease: ({ event, context }) =>
      event.type === "PRESS" &&
      (event.pointerType === "keyboard" ||
        event.pointerType === "virtual" ||
        (event.pointerType === "touch" && !context.spun)),
  },
  actions: {
    setText: ({ event, set, props }) => {
      if (event.type !== "INPUT" && event.type !== "COMPOSITION.END") return
      set("text", event.text)
      set("dirty", true)
      props.onInputValueChange?.(event.text)
    },
    deferCommit: ({ set }) => set("commitAfterComposition", true),
    commitDeferred: (args) => {
      if (!args.context.commitAfterComposition) return
      args.set("commitAfterComposition", false)
      commitTextNow(args)
    },
    commitText: (args) => commitTextNow(args),
    commitPaste: (args) => {
      if (args.event.type !== "PASTE") return
      const parsed = args.props.parser.parse(args.event.text)
      if (parsed === null) return
      write(args, normalise(parsed, args.props), { user: true, commit: "PASTE" })
      resyncAfterWrite(args)
    },
    stepKey: (args) => {
      const { event } = args
      if (!("large" in event) || event.type === "WHEEL") return
      const props = args.props
      if (event.type === "FIRST" || event.type === "LAST") {
        const bound = event.type === "FIRST" ? props.min : props.max
        if (bound === undefined) return
        // An off-grid bound (max 10.5, step 1): the last grid value inside it, as native
        // stepUp does, so the hidden input never reports a step mismatch.
        write(args, snapValue(bound, props), { user: true, commit: "EDGE" })
        resyncAfterWrite(args)
        return
      }
      const up = event.type === "INCREASE" || event.type === "PAGE_PREV"
      const large = event.large || event.type === "PAGE_PREV" || event.type === "PAGE_NEXT"
      stepOnce(args, up ? 1 : -1, large ? "large" : "step", "STEP")
    },
    stepWheel: (args) => {
      if (args.event.type !== "WHEEL") return
      stepOnce(args, args.event.direction, args.event.large ? "large" : "step", "WHEEL")
    },
    /** A press begins: a mouse or pen steps now (native spinners do), touch on release. */
    startPress: (args) => {
      const { event, set } = args
      if (event.type !== "PRESS.START") return
      set("trigger", event.trigger)
      set("pointerType", event.pointerType)
      set("spun", false)
      set("start", latest(args))
      const steps = event.pointerType === "mouse" || event.pointerType === "pen"
      set("steppedOnStart", steps)
      if (steps) stepOnce(args, directionOf(event.trigger), "step", null)
    },
    /** A release activation (touch not repeated, keyboard, AT): one step, committed. */
    stepOnRelease: (args) => {
      const { event, set } = args
      if (event.type !== "PRESS") return
      set("steppedOnStart", false)
      if (stepOnce(args, directionOf(event.trigger), "step", "STEP") && remote(event.pointerType)) {
        announce(args, valueText(args, latest(args)))
      }
    },
    /** The trailing PRESS of a press that already stepped (base-ui#2588). */
    swallowPress: ({ set }) => set("steppedOnStart", false),
    spinStep: (args) => {
      args.set("spun", true)
      stepOnce(args, directionOf(args.context.trigger), "step", null)
    },
    /** The press is over: commit once if it changed the value. */
    endPress: (args) => {
      const { context, set, props } = args
      const start = context.start
      const now = latest(args)
      set("trigger", null)
      set("start", undefined)
      if (start === undefined || Object.is(start, now)) return
      if (context.pending) set("pending", { ...context.pending, commit: "STEP" })
      else commit(props, now, "STEP")
      if (remote(context.pointerType)) announce(args, valueText(args, now))
    },
    restoreDefault: (args) => {
      write(args, args.props.defaultValue ?? null, { user: false, commit: null })
      resyncAfterWrite(args)
    },
    adopt: (args) => {
      if (args.event.type !== "INPUT.ADOPT") return
      const v = args.event.value
      write(args, v === null ? null : normalise(clampTo(v, args.props), args.props), {
        user: false,
        commit: "INPUT.COMMIT",
      })
      resyncAfterWrite(args)
    },
    resyncHidden: (args) => {
      const v = currentValue(args)
      args.env.formInput?.sync({ value: v === null ? "" : String(v) }, { dispatch: false })
    },
    /** The controlled value arrived (or changed on its own): text, hidden input, commit. */
    applySynced: (args) => {
      const { context, env, props, set } = args
      const pending = context.pending
      const v = currentValue(args)
      const met = pending !== null && Object.is(pending.value, v)
      set("pending", null)
      env.formInput?.sync({ value: v === null ? "" : String(v) }, { dispatch: met && pending.user })
      // The parent's own change shows even while focused; a typed draft survives only an
      // unrelated re-render (no value change reaches here then).
      resyncText(args)
      if (met && pending.commit !== null) commit(props, v, pending.commit)
    },
    /** A refused or cancelled proposal: forget it and show the value again. */
    revert: (args) => {
      args.set("pending", null)
      resyncText(args)
      const v = currentValue(args)
      args.env.formInput?.sync({ value: v === null ? "" : String(v) }, { dispatch: false })
    },
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
    raiseCommit: ({ send }) => send({ type: "COMMIT", source: "blur" }),
  },
  delays: {
    // A touch hold waits longer (a tap must not start a repeat).
    spinDelay: ({ props, context }) =>
      context.pointerType === "touch" ? 600 : (props.spinDelay ?? 400),
    spinInterval: ({ props }) => props.spinInterval ?? 60,
  },
}).machine({
  id: "number-input",
  initial: "idle",
  context: (props) => ({
    text: formatValue(props.value ?? props.defaultValue ?? null, props),
    dirty: false,
    commitAfterComposition: false,
    focused: false,
    numberingSystem: undefined,
    trigger: null,
    pointerType: null,
    steppedOnStart: false,
    spun: false,
    start: undefined,
    pending: null,
  }),
  values: { value: { fallback: EMPTY } },
  onProps: { value: "VALUE.SYNCED", disabled: "LOCK.CHANGED", readOnly: "LOCK.CHANGED" },
  on: {
    FOCUS: { actions: ["setFocused"] },
    BLUR: { actions: ["clearFocused", "raiseCommit"] },
    RESET: { actions: ["restoreDefault"] },
    "INPUT.ADOPT": [{ guard: "editable", actions: ["adopt"] }, { actions: ["resyncHidden"] }],
    "VALUE.SYNCED": { actions: ["applySynced"] },
    $reverted: { actions: ["revert"] },
  },
  states: {
    idle: {
      on: {
        INPUT: { actions: ["setText"] },
        COMMIT: { actions: ["commitText"] },
        PASTE: { guard: "editable", actions: ["commitPaste"] },
        INCREASE: { guard: "editable", actions: ["stepKey"] },
        DECREASE: { guard: "editable", actions: ["stepKey"] },
        PAGE_PREV: { guard: "editable", actions: ["stepKey"] },
        PAGE_NEXT: { guard: "editable", actions: ["stepKey"] },
        FIRST: { guard: "editable", actions: ["stepKey"] },
        LAST: { guard: "editable", actions: ["stepKey"] },
        WHEEL: { guard: "editable", actions: ["stepWheel"] },
        "PRESS.START": {
          guard: "canStepTrigger",
          target: "pressing",
          actions: ["startPress"],
        },
        PRESS: [
          { guard: { and: ["canStepTrigger", "activatesOnRelease"] }, actions: ["stepOnRelease"] },
          { actions: ["swallowPress"] },
        ],
        "COMPOSITION.START": "composing",
      },
    },
    composing: {
      on: {
        INPUT: { actions: ["setText"] },
        // A blur mid-composition commits once the composed text is in (no lost input).
        COMMIT: { actions: ["deferCommit"] },
        "COMPOSITION.END": { target: "idle", actions: ["setText", "commitDeferred"] },
      },
    },
    pressing: {
      after: {
        spinDelay: { guard: { and: ["spins", "canKeepSpinning"] }, target: "spinning" },
      },
      on: {
        // A blur while a trigger is held still commits typed text (a form submit sees it).
        COMMIT: { actions: ["commitText"] },
        "PRESS.END": { target: "idle", actions: ["endPress"] },
        "PRESS.CANCEL": { target: "idle", actions: ["endPress"] },
        "PRESS.LEAVE": { target: "idle", actions: ["endPress"] },
        "LOCK.CHANGED": { guard: "locked", target: "idle", actions: ["endPress"] },
      },
    },
    // Entered after spinDelay; each spinInterval then repeats one step (400 + 3 × 60 ms of a
    // mouse hold: the press step and three repeats).
    spinning: {
      after: {
        spinInterval: [
          { guard: "canKeepSpinning", target: "spinning", reenter: true, actions: ["spinStep"] },
          { target: "idle", actions: ["endPress"] },
        ],
      },
      on: {
        // A blur while a trigger is held still commits typed text (a form submit sees it).
        COMMIT: { actions: ["commitText"] },
        "PRESS.END": { target: "idle", actions: ["endPress"] },
        "PRESS.CANCEL": { target: "idle", actions: ["endPress"] },
        "PRESS.LEAVE": { target: "idle", actions: ["endPress"] },
        "LOCK.CHANGED": { guard: "locked", target: "idle", actions: ["endPress"] },
      },
    },
  },
})

export type NumberInputMachine = typeof numberInputMachine
