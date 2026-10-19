// Date Field parts (design §4): the group, one native input per editable segment (spinbutton
// unless the iOS quirk applies), aria-hidden literals, a hidden name node per segment type,
// the value description, and the hidden native input typed by the value's kind. Field
// attributes come merged (`mergeFieldProps`); the key mapping and the insertion plan are
// here so every adapter shares them.

import type { DateValue } from "@internationalized/date"
import { CalendarDateTime, Time, ZonedDateTime } from "@internationalized/date"
import { focusAttrs } from "../../a11y/focus"
import { isMod, type KeyDescription, toLogicalKey } from "../../a11y/keys"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import type { PlatformFlags } from "../../env/capabilities"
import { dateFormatter } from "../../i18n/date"
import {
  type DateGranularity,
  type DateSegmentType,
  type DateValidityReason,
  type Draft,
  dateValidity,
  defaultValueText,
  draftState,
  type FieldValue,
  limits,
  onDay,
  type SegmentFormat,
  type SegmentType,
  validityFlags,
} from "../date-segments"
import type { FieldControlProps } from "../shared/field-control"
import { type DateFieldEvent, formValueOf } from "./date-field.machine"
import { type DateFieldMessages, defaultPlaceholder } from "./date-field.messages"

export type DateFieldPart =
  | "root"
  | "label"
  | "description"
  | "error-message"
  | "input"
  | "segment"
  | "segment-name"
  | "value-description"
  | "hidden-input"
  | "control"
  | "trigger"
  | "clear-trigger"

// ── Keys and insertions ─────────────────────────────────────────────────────────────

/**
 * A key on a segment as a machine event, `"select-all"` (⌘/Ctrl+A: the next Backspace
 * clears every segment), `"open-picker"` (Alt+ArrowDown / Alt+ArrowUp), or null (left to the browser: Tab, Enter's implicit submission,
 * shortcuts). Up/Down step and Left/Right move (`value: "vertical"`).
 */
export function dateFieldKey(
  k: KeyDescription,
  segment: DateSegmentType,
  o: { readonly dir: "ltr" | "rtl"; readonly platform: PlatformFlags; readonly selectAll: boolean },
): DateFieldEvent | "select-all" | "open-picker" | null {
  if (k.composing) return null
  const mod = isMod(k, o.platform)
  if (mod && !k.alt && !k.shift && k.key.toLowerCase() === "a") return "select-all"
  // Alt+ArrowDown / Alt+ArrowUp open a picker's popover (the segment's value is untouched).
  if (k.alt && !k.ctrl && !k.meta && (k.key === "ArrowDown" || k.key === "ArrowUp")) {
    return "open-picker"
  }
  if (k.alt || k.ctrl || k.meta) return null
  if (k.key === "Backspace" || k.key === "Delete") {
    return o.selectAll ? { type: "CLEAR_ALL" } : { type: "BACKSPACE", segment }
  }
  const type = toLogicalKey(k, {
    dir: o.dir,
    orientation: "horizontal",
    platform: o.platform,
    value: "vertical",
  })
  switch (type) {
    case "INCREASE":
    case "DECREASE":
    case "PAGE_PREV":
    case "PAGE_NEXT":
    case "FIRST":
    case "LAST":
      return { type, segment, modality: "keyboard" }
    case "NEXT":
    case "PREV":
      return { type, segment }
    default:
      return null
  }
}

/**
 * What a `beforeinput` on a segment does: insertions (typing, a drop, a keyboard's
 * suggestion) go to the machine as text, deletions as Backspace; every other edit is
 * cancelled, so the input only ever shows the machine's text. A composition cannot be
 * cancelled: its text arrives at `compositionend`.
 */
export function planSegmentInput(
  e: { readonly data: string | null; readonly inputType: string },
  segment: DateSegmentType,
): { readonly cancel: boolean; readonly event: DateFieldEvent | null } {
  if (e.inputType === "insertCompositionText") return { cancel: false, event: null }
  if (e.inputType === "insertFromPaste") return { cancel: true, event: null }
  if (e.inputType.startsWith("insert") && e.data) {
    return { cancel: true, event: { type: "INPUT", segment, data: e.data } }
  }
  if (e.inputType.startsWith("delete"))
    return { cancel: true, event: { type: "BACKSPACE", segment } }
  return { cancel: true, event: null }
}

// ── Parts ───────────────────────────────────────────────────────────────────────────

export type DateValueKind = "date" | "datetime" | "zoned" | "time"

export const valueKind = (v: FieldValue): DateValueKind =>
  v instanceof Time
    ? "time"
    : v instanceof ZonedDateTime
      ? "zoned"
      : v instanceof CalendarDateTime
        ? "datetime"
        : "date"

/** The hidden input's type for a value kind (spec "Form Participation"). */
export const hiddenInputType = (kind: DateValueKind) =>
  kind === "date"
    ? "date"
    : kind === "datetime"
      ? "datetime-local"
      : kind === "time"
        ? "time"
        : "text"

/** A bound mirrored as a native `min`/`max` only when it is of the input's own kind. */
export const nativeBound = (
  v: FieldValue | null | undefined,
  kind: DateValueKind,
  granularity: DateGranularity,
): string | undefined => {
  if (!v || kind === "zoned" || v instanceof Time !== (kind === "time")) return undefined
  return formValueOf(v, granularity, kind)
}

/** The hidden input's `step` for date-time and time granularities (reka-ui#3000). */
export const STEP: Readonly<Record<DateGranularity, number | undefined>> = {
  day: undefined,
  hour: 3600,
  minute: 60,
  second: 1,
}

export interface DateFieldConnectInput {
  readonly instance: string
  readonly format: SegmentFormat
  readonly draft: Draft
  readonly value: FieldValue | null
  readonly defaultValue: FieldValue | null
  readonly kind: DateValueKind
  readonly granularity: DateGranularity
  readonly active: DateSegmentType | null
  readonly modality: Modality
  readonly composing: boolean
  readonly field: FieldControlProps
  readonly fieldData?: Readonly<Record<`data-${string}`, string | undefined>> | undefined
  /** The label ids segments and the group are named by (the Field's Label, or the host's). */
  readonly labelledBy: string | undefined
  readonly minValue?: FieldValue | null | undefined
  readonly maxValue?: FieldValue | null | undefined
  readonly isDateUnavailable?: ((date: DateValue) => boolean) | undefined
  readonly required: boolean
  readonly messages: DateFieldMessages
  /** Quirk `ios-vo-spinbutton-input`: segments without the spinbutton role and values. */
  readonly plainTextbox: boolean
  /** Run inside a host (Date Picker, range fields): no group role, no form footprint. */
  readonly embedded: boolean
  readonly autoComplete?: string | undefined
  readonly form?: string | undefined
  readonly dir: "ltr" | "rtl"
}

export interface SegmentPart {
  readonly type: SegmentType
  readonly key: string
  readonly editable: boolean
  /** The literal's or the time zone's text. */
  readonly text: string
}

const id = (input: DateFieldConnectInput, part: string) => `date-field-${input.instance}-${part}`
export const segmentId = (instance: string, type: DateSegmentType | "timeZoneName") =>
  `date-field-${instance}-segment-${type}`
const nameId = (input: DateFieldConnectInput, type: DateSegmentType | "timeZoneName") =>
  id(input, `segment-name-${type}`)

const NUMERIC: ReadonlySet<SegmentType> = new Set([
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
])

export function dateFieldConnect(input: DateFieldConnectInput) {
  const { field, format: f, draft } = input
  const part = (name: DateFieldPart) => scopeAttrs("date-field", name, input.instance)
  const conversion = draftState(draft, f)
  const reason: DateValidityReason | null = dateValidity(
    conversion === "empty"
      ? "empty"
      : conversion === "partial"
        ? "incomplete"
        : input.value === null
          ? "impossible"
          : "complete",
    input.value,
    {
      minValue: input.minValue,
      maxValue: input.maxValue,
      isDateUnavailable: input.isDateUnavailable,
      // valueMissing is native (`required` on the hidden input); embedded hosts get it here.
      required: input.embedded && input.required,
    },
  )
  const formatted = (v: FieldValue) =>
    v instanceof Time ? timeText(v, f) : f.format(onDay(v).toDate(f.options.timeZone))
  const message =
    reason === null || reason === "valueMissing"
      ? ""
      : reason === "incomplete"
        ? input.messages.incomplete
        : reason === "impossible"
          ? input.messages.impossible
          : reason === "unavailable"
            ? input.messages.unavailable
            : reason === "rangeUnderflow" && input.minValue
              ? input.messages.rangeUnderflow({ min: formatted(input.minValue) })
              : input.maxValue
                ? input.messages.rangeOverflow({ max: formatted(input.maxValue) })
                : ""
  const invalid = field.invalid
  const focused = input.active !== null
  const fieldState = {
    ...input.fieldData,
    "data-disabled": dataFlag(field.disabled),
    "data-readonly": dataFlag(field.readOnly),
    "data-required": dataFlag(input.required),
    "data-invalid": dataFlag(invalid),
  }
  const state = {
    ...fieldState,
    ...focusAttrs(focused, input.modality),
    "data-placeholder-shown": dataFlag(conversion === "empty"),
    "data-complete": dataFlag(conversion === "filled"),
    "data-composing": dataFlag(input.composing),
  }
  const descriptionId = input.value === null ? undefined : id(input, "value-description")
  const firstEditable = f.editable[0]
  const segmentProps = (type: DateSegmentType): PartProps => {
    const entry = draft[type]
    const { min, max } = limits(type, draft, f)
    const spoken = defaultValueText(type, entry, draft, f)
    const valueText =
      entry?.value === null || entry?.value === undefined || spoken === null
        ? input.messages.empty
        : input.messages.segmentValueText({
            type,
            value: entry.value,
            text: entry.text,
            formatted: spoken,
          })
    const describe = invalid || type === firstEditable
    return {
      ...part("segment"),
      ...fieldState,
      ...focusAttrs(input.active === type, input.modality),
      "data-type": type,
      "data-editable": "",
      "data-placeholder": dataFlag(!entry),
      id: segmentId(input.instance, type),
      type: "text",
      ...(input.plainTextbox
        ? {}
        : {
            role: "spinbutton",
            "aria-valuemin": min,
            "aria-valuemax": max,
            "aria-valuenow": entry?.value ?? undefined,
            "aria-valuetext": valueText,
          }),
      "aria-labelledby": [nameId(input, type), input.labelledBy].filter(Boolean).join(" "),
      "aria-describedby": describe ? field["aria-describedby"] : undefined,
      "aria-invalid": invalid ? "true" : undefined,
      "aria-readonly": field.readOnly ? "true" : undefined,
      value: entry?.text ?? "",
      placeholder: input.messages.placeholder(type) || defaultPlaceholder(type),
      size: f.size(type),
      inputmode: type === "era" || type === "dayPeriod" ? "text" : "numeric",
      autocomplete: "off",
      autoCorrect: "off",
      spellcheck: "false",
      enterkeyhint: "next",
      dir: NUMERIC.has(type) ? "ltr" : undefined,
      readonly: field.readOnly || undefined,
      disabled: field.disabled || undefined,
      [CRITICAL]: input.plainTextbox
        ? ["type", "value"]
        : ["role", "aria-valuenow", "aria-valuetext", "type", "value"],
    }
  }
  const names: readonly (DateSegmentType | "timeZoneName")[] = [
    ...f.editable,
    ...(f.segments.some((s) => s.type === "timeZoneName") ? (["timeZoneName"] as const) : []),
  ]
  const nameOf = (type: DateSegmentType | "timeZoneName") =>
    input.messages.segmentName({ type, locale: f.options.locale })
  return {
    /** The control's own validity (date-segments "Validity"); "" when none. */
    validity: { reason, message, flags: validityFlags(reason) },
    /** The Root's own state (a standalone Root is the Field: its Field attributes are its own). */
    root: (): PartProps => ({
      ...focusAttrs(focused, input.modality),
      "data-placeholder-shown": state["data-placeholder-shown"],
      "data-complete": state["data-complete"],
      "data-composing": state["data-composing"],
      dir: input.dir,
      lang: f.options.locale,
    }),
    /**
     * The segments' container: the group, or (embedded, or inside a picker's Control, which is
     * then the group) a presentation element.
     */
    input: (o: { readonly inControl?: boolean } = {}): PartProps => {
      const plain = input.embedded || o.inControl === true
      return {
        ...part("input"),
        ...state,
        role: plain ? "presentation" : "group",
        id: id(input, "input"),
        "aria-labelledby": plain ? undefined : input.labelledBy,
        "aria-describedby": plain
          ? undefined
          : [field["aria-describedby"], descriptionId].filter(Boolean).join(" ") || undefined,
        "aria-disabled": field.disabled ? "true" : undefined,
        "aria-invalid": !plain && invalid ? "true" : undefined,
        style: { "unicode-bidi": "isolate" },
      }
    },
    /** A picker's group around the input and its triggers (spec "Picker — Names"). */
    control: (): PartProps => ({
      ...part("control"),
      ...state,
      role: "group",
      id: id(input, "control"),
      "aria-labelledby": input.labelledBy,
      "aria-describedby":
        [field["aria-describedby"], descriptionId].filter(Boolean).join(" ") || undefined,
      "aria-disabled": field.disabled ? "true" : undefined,
      "aria-invalid": invalid ? "true" : undefined,
    }),
    /**
     * The picker trigger, named by its message and the Label, described by the value. The
     * Popover's trigger adds `aria-expanded`, `aria-controls` and `aria-haspopup`.
     */
    trigger: (o: { readonly range?: boolean } = {}): PartProps => ({
      ...part("trigger"),
      id: id(input, "trigger"),
      "aria-label": o.range ? input.messages.rangeTrigger : input.messages.trigger,
      "aria-labelledby": [id(input, "trigger"), input.labelledBy].filter(Boolean).join(" "),
      "aria-describedby": descriptionId,
      // Read-only: focusable, announced unavailable, never opens.
      "aria-disabled": field.readOnly && !field.disabled ? "true" : undefined,
      "data-disabled": dataFlag(field.disabled),
      "data-readonly": dataFlag(field.readOnly),
    }),
    /** The open content's name: the trigger's (its message and the Label). */
    contentLabelledBy: (): string =>
      [id(input, "trigger"), input.labelledBy].filter(Boolean).join(" "),
    /** Clears the value and every draft segment (spec "Picker — Clear"). */
    clearTrigger: (): PartProps => ({
      ...part("clear-trigger"),
      type: "button",
      id: id(input, "clear-trigger"),
      "aria-label": input.messages.clear,
      "aria-labelledby": [id(input, "clear-trigger"), input.labelledBy].filter(Boolean).join(" "),
      disabled: field.disabled || undefined,
      "aria-disabled": field.readOnly && !field.disabled ? "true" : undefined,
      "data-disabled": dataFlag(field.disabled),
      "data-empty": dataFlag(conversion === "empty"),
    }),
    segments: (): readonly SegmentPart[] =>
      f.segments.map((s, i) => ({
        type: s.type,
        key: s.type === "literal" ? `literal-${i}` : s.type,
        editable: s.type !== "literal" && s.type !== "timeZoneName",
        text: s.text,
      })),
    segment: (s: SegmentPart): PartProps => {
      if (s.type === "literal") {
        return {
          ...part("segment"),
          "data-type": "literal",
          "aria-hidden": "true",
        }
      }
      if (s.type === "timeZoneName") {
        return {
          ...part("segment"),
          ...fieldState,
          "data-type": "timeZoneName",
          id: segmentId(input.instance, "timeZoneName"),
          type: "text",
          value: s.text,
          readonly: true,
          "aria-readonly": "true",
          tabindex: -1,
          size: s.text.length,
          "aria-labelledby": [nameId(input, "timeZoneName"), input.labelledBy]
            .filter(Boolean)
            .join(" "),
        }
      }
      return segmentProps(s.type)
    },
    /** The hidden name of each segment type (named by it and the label: iOS reads no group). */
    segmentNames: () =>
      names.map((type) => ({
        key: type,
        props: {
          ...part("segment-name"),
          id: nameId(input, type),
          style: visuallyHiddenStyle,
        } as PartProps,
        text: nameOf(type),
      })),
    valueDescription: () =>
      input.value === null
        ? null
        : {
            props: {
              ...part("value-description"),
              id: id(input, "value-description"),
              style: visuallyHiddenStyle,
            } as PartProps,
            text: input.messages.valueDescription({
              formatted: fullValueText(input.value, f),
              time: input.value instanceof Time || f.options.maxGranularity === "hour",
            }),
          },
    /** The native input: name, value (ISO or ""), constraints, validity, reset, autofill. */
    hiddenInput: (): PartProps => {
      const iso = (v: FieldValue | null | undefined) =>
        v ? formValueOf(v, input.granularity, input.kind) : undefined
      return {
        ...part("hidden-input"),
        type: hiddenInputType(input.kind),
        id: id(input, "hidden-input"),
        "aria-hidden": "true",
        tabindex: -1,
        name: field.name,
        form: input.form,
        min: nativeBound(input.minValue, input.kind, input.granularity),
        max: nativeBound(input.maxValue, input.kind, input.granularity),
        step:
          input.kind === "datetime" || input.kind === "time" ? STEP[input.granularity] : undefined,
        required: field.required || undefined,
        disabled: field.disabled || undefined,
        autocomplete: input.autoComplete,
        // The current value: a controlled value is in the server's HTML, so a submit before
        // hydration posts it (a reset is restored by the machine).
        defaultValue: iso(input.value) ?? "",
        // The control's own validity reason, for drivers (contract query `validity`).
        "data-validity": reason ?? undefined,
        style: hiddenFormInputStyle,
      }
    },
    /** What copying from a segment puts on the clipboard: the whole field when complete. */
    copyText: (type: DateSegmentType) =>
      input.value !== null ? formatted(input.value) : (draft[type]?.text ?? ""),
  }
}

/** A time of day in the field's locale, cycle and granularity ("9:30 PM"). */
function timeText(value: Time, f: SegmentFormat): string {
  const g = f.options.granularity
  return dateFormatter(f.options.locale, {
    timeZone: "UTC",
    hour: "numeric",
    ...(g === "minute" || g === "second" ? { minute: "2-digit" } : {}),
    ...(g === "second" ? { second: "2-digit" } : {}),
    hourCycle: f.hour12 ? "h12" : "h23",
  }).format(onDay(value).toDate("UTC"))
}

/** The whole value spoken by the group ("Wednesday, October 14, 2026, 9:30 AM"). */
function fullValueText(value: FieldValue, f: SegmentFormat): string {
  if (value instanceof Time) return timeText(value, f)
  const time = value instanceof CalendarDateTime || value instanceof ZonedDateTime
  const g = f.options.granularity
  const dates = f.options.maxGranularity !== "hour"
  return dateFormatter(f.options.locale, {
    calendar: f.options.calendar.identifier,
    timeZone: f.options.timeZone,
    ...(dates ? { weekday: "long", year: "numeric", month: "long", day: "numeric" } : {}),
    ...(time && g !== "day" ? { hour: "numeric" } : {}),
    ...(time && (g === "minute" || g === "second") ? { minute: "2-digit" } : {}),
    ...(time && g === "second" ? { second: "2-digit" } : {}),
    ...(f.options.hourCycle ? { hourCycle: f.options.hourCycle === 12 ? "h12" : "h23" } : {}),
    ...(value instanceof ZonedDateTime && f.options.showTimeZone ? { timeZoneName: "short" } : {}),
  }).format(value.toDate(f.options.timeZone))
}

export type DateFieldApi = ReturnType<typeof dateFieldConnect>
