// Signature Pad parts (add-signature-pad design §4, §7, §8): every aria-* and data-* attribute.
// The Control is an image named by the Label and described by the Status, not a Tab stop (no
// keyboard function: Zag's role="application" is wrong). Clear and Undo stay rendered and
// focusable when there is nothing to do (aria-disabled), never hidden: focus stays.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import type { LinkEnv } from "../../dom/link"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { buttonLikeProps } from "../shared/button-like"
import {
  isSignatureEmpty,
  type SignatureStroke,
  type SignatureValue,
  signatureFormValue,
  signaturePath,
} from "./signature-pad.geometry"
import type { SignaturePadState } from "./signature-pad.machine"
import type { SignaturePadMessages } from "./signature-pad.messages"

export type SignaturePadPart =
  | "root"
  | "label"
  | "control"
  | "segment"
  | "guide"
  | "status"
  | "clear-trigger"
  | "undo-trigger"
  | "hidden-input"
  | "stroke"

export interface SignaturePadConnectInput {
  readonly instance: string
  readonly state: SignaturePadState
  readonly value: SignatureValue
  /** The stroke being drawn, rendered after the value's strokes. */
  readonly stroke: SignatureStroke | null
  readonly messages: SignaturePadMessages
  readonly ids: {
    readonly label: string
    readonly control: string
    readonly status: string
    readonly input: string
  }
  /** Which optional parts are rendered: no IDREF points at a missing element. */
  readonly rendered: { readonly label: boolean; readonly status: boolean }
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly invalid: boolean
  readonly name?: string | undefined
  readonly form?: string | undefined
  readonly formValue: "svg" | "json"
  /** The ink colour inlined in the SVG form value (default "#000"). */
  readonly inkColor: string
  /** The Field's description and error ids, when inside one. */
  readonly describedBy?: string | undefined
}

export interface SignaturePadTriggerInput {
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
}

/** Drawing needs every touch and no selection (signature_pad#825, #532; perfect-freehand#2). */
const SURFACE_STYLE = {
  "touch-action": "none",
  "overscroll-behavior": "contain",
  "user-select": "none",
  "-webkit-user-select": "none",
  "-webkit-touch-callout": "none",
}

export function signaturePadConnect(input: SignaturePadConnectInput, env: LinkEnv) {
  const empty = isSignatureEmpty(input.value)
  const shared = {
    "data-state": input.state,
    "data-empty": dataFlag(empty),
    "data-disabled": dataFlag(input.disabled),
    "data-readonly": dataFlag(input.readOnly),
    "data-required": dataFlag(input.required),
    "data-invalid": dataFlag(input.invalid),
  }
  const base = (part: SignaturePadPart): PartProps => ({
    ...scopeAttrs("signature-pad", part, input.instance),
    ...shared,
  })
  const labelId = input.rendered.label ? input.ids.label : undefined
  const described =
    [input.rendered.status ? input.ids.status : undefined, input.describedBy]
      .filter(Boolean)
      .join(" ") || undefined
  const nothingToDo = empty || input.state === "drawing" || input.disabled || input.readOnly
  const trigger =
    (part: "clear-trigger" | "undo-trigger", name: string) =>
    (t: SignaturePadTriggerInput): PartProps => ({
      ...buttonLikeProps(
        {
          role: "button",
          tag: t.tag,
          type: "button",
          disabled: nothingToDo,
          focusableWhenDisabled: true,
        },
        env,
      ),
      ...base(part),
      ...focusAttrs(t.focused, t.modality),
      id: `${input.ids.control}-${part}`,
      "aria-label": name,
      // "Clear Signature": the trigger's own name, then the Label.
      "aria-labelledby": labelId ? `${input.ids.control}-${part} ${labelId}` : undefined,
    })
  const strokes = input.stroke ? [...input.value.strokes, input.stroke] : input.value.strokes
  return {
    empty,
    strokeCount: input.value.strokes.length,
    /** The path data of every stroke, the one being drawn last. */
    paths: strokes.map((s) => signaturePath(s)).filter(Boolean),
    /** The Status text. */
    statusText: empty ? input.messages.empty : input.messages.signed,
    /** The hidden input's value. */
    formValue: signatureFormValue(input.value, input.formValue, input.inkColor),
    root: (): PartProps => base("root"),
    label: (): PartProps => ({ ...base("label"), id: input.ids.label }),
    control: (): PartProps => ({
      ...base("control"),
      id: input.ids.control,
      role: "img",
      tabindex: -1,
      "aria-labelledby": labelId,
      "aria-describedby": described,
      style: SURFACE_STYLE,
      [CRITICAL]: ["role"],
    }),
    segment: (): PartProps => ({
      ...base("segment"),
      "aria-hidden": "true",
      focusable: "false",
      viewBox: `0 0 ${Math.max(1, input.value.width)} ${Math.max(1, input.value.height)}`,
      preserveAspectRatio: "xMidYMid meet",
      fill: "none",
      stroke: "currentColor",
      // In style, not attributes: a framework maps no kebab-case SVG attribute the same way.
      style: { "stroke-linecap": "round", "stroke-linejoin": "round" },
    }),
    /** One `<path>` in the Segment per entry of `paths`. */
    stroke: (d: string): PartProps => ({ ...base("stroke"), d }),
    guide: (): PartProps => ({ ...base("guide"), "aria-hidden": "true" }),
    status: (): PartProps => ({
      ...base("status"),
      id: input.ids.status,
      style: visuallyHiddenStyle,
    }),
    clearTrigger: trigger("clear-trigger", input.messages.clear),
    undoTrigger: trigger("undo-trigger", input.messages.undo),
    hiddenInput: (): PartProps => ({
      ...base("hidden-input"),
      id: input.ids.input,
      type: "text",
      name: input.name,
      form: input.form,
      value: signatureFormValue(input.value, input.formValue, input.inkColor),
      required: input.required || undefined,
      disabled: input.disabled || undefined,
      tabindex: -1,
      "aria-hidden": "true",
      style: hiddenFormInputStyle,
      [CRITICAL]: ["type", "tabindex", "aria-hidden"],
    }),
  }
}

export type SignaturePadApi = ReturnType<typeof signaturePadConnect>
