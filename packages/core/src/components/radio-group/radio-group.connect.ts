// Radio Group parts (design "Connect"): a radiogroup root that owns the arrow keys (all
// four, whatever the orientation, mirrored in RTL), button-like radio controls with a
// roving tab index from the collections' tab stop, labels from control-label and one
// hidden radio input per item from hidden-form-input.

import { focusAttrs } from "../../a11y/focus"
import { toLogicalKey } from "../../a11y/keys"
import { type CompositeEnv, tabStop } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import { describeKey } from "../../dom/keyboard"
import type { LinkEnv } from "../../dom/link"
import { itemId, partId } from "../../ids"
import { buttonLikeProps } from "../shared/button-like"
import { type RadioGroupEvent, radioSelection } from "./radio-group.machine"

export type RadioGroupPart =
  | "root"
  | "label"
  | "description"
  | "error-message"
  | "item"
  | "item-control"
  | "item-indicator"
  | "item-label"
  | "item-description"

/**
 * The scope and the radio's part name: Radio Group's, or a component that is a radio group
 * under its own name (Segmented Control: one `item` element per segment, ark#2629).
 */
export interface RadioNaming {
  readonly scope: string
  readonly control: string
  /** The host's name for every other part (default: Radio Group's own names). */
  readonly part?: ((name: RadioPart) => string) | undefined
}

/** Radio Group's parts other than the radio control (named by `RadioNaming.control`). */
export type RadioPart = Exclude<RadioGroupPart, "item-control"> | "hidden-input"

/** A part's name under `naming` (its own name by default). */
export const radioPartName = (naming: RadioNaming, name: RadioPart): string =>
  naming.part?.(name) ?? name
const RADIO_GROUP: RadioNaming = { scope: "radio-group", control: "item-control" }

export const radioGroupIds = (root: string, naming: RadioNaming = RADIO_GROUP) => {
  const sc = naming.scope
  return {
    list: partId(sc, root, "root"),
    item: (key: CollectionKey) => itemId(sc, root, naming.control, key),
    label: partId(sc, root, "label"),
    description: partId(sc, root, "description"),
    errorMessage: partId(sc, root, "error-message"),
    itemLabel: (key: CollectionKey) => itemId(sc, root, "item-label", key),
    itemDescription: (key: CollectionKey) => itemId(sc, root, "item-description", key),
    hiddenInput: (key: CollectionKey) => itemId(sc, root, "hidden-input", key),
    /** The default `name`: two groups never form one browser group (ariakit#3833). */
    name: partId(sc, root, "name"),
  }
}

export interface RadioGroupConnectInput {
  readonly instance: string
  readonly collection: Collection<unknown>
  readonly value: string | null
  readonly highlightedKey: CollectionKey | null
  readonly highlightSource: string | null
  /** Items not registered yet (server render): the tab stop comes from the value. */
  readonly pending: boolean
  /** The server tab stop (the checked declared item if enabled, else the first enabled). */
  readonly pendingStop?: string | null | undefined
  readonly orientation: "vertical" | "horizontal"
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly invalid: boolean
  readonly name: string | undefined
  readonly form: string | undefined
  readonly rendered: {
    readonly label?: string | undefined
    readonly description?: string | undefined
    readonly errorMessage?: string | undefined
  }
  /** The enclosing Field's ids (field-control), when the group is registered with one. */
  readonly field?:
    | {
        readonly label?: string | undefined
        readonly description?: string | undefined
        readonly error?: string | undefined
      }
    | undefined
  readonly ariaLabel?: string | undefined
  /** Default Radio Group's. */
  readonly naming?: RadioNaming | undefined
  /** Hosted by a composite (a Toolbar): the host owns the arrows and the tab stop. */
  readonly hosted?: boolean | undefined
}

/** One radio's interaction state (its own press, hover and focus). */
export interface RadioItemState {
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  readonly hovered: boolean
  readonly itemDisabled: boolean
  /** The rendered control is labelable (named by `<label for>`), else aria-labelledby. */
  readonly labelable: boolean
  readonly labelRendered: boolean
  readonly descriptionRendered: boolean
}

const join = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(" ") || undefined

export function radioGroupConnect(
  input: RadioGroupConnectInput,
  send: (event: RadioGroupEvent) => void,
  env: CompositeEnv & LinkEnv,
) {
  const naming = input.naming ?? RADIO_GROUP
  const sc = naming.scope
  const ids = radioGroupIds(input.instance, naming)
  const c = input.collection
  const selection = radioSelection(input.value)
  const inert = input.disabled && !input.focusableWhenDisabled
  // The single tab stop: the checked radio if enabled, else the first enabled one.
  const stop = inert
    ? null
    : tabStop({
        collection: c,
        highlightedKey: input.highlightedKey,
        highlightSource: null,
        selection,
        selectionMode: "single",
        focusableWhenDisabled: input.focusableWhenDisabled,
      })
  const enabledRadio = stop !== null && !input.disabled
  const error = input.invalid ? input.rendered.errorMessage : undefined
  const groupState = {
    "data-disabled": dataFlag(input.disabled),
    "data-readonly": dataFlag(input.readOnly),
    "data-invalid": dataFlag(input.invalid),
  }
  const checked = (key: CollectionKey) => input.value === key
  const itemState = (key: CollectionKey, disabled: boolean) => ({
    "data-key": key,
    "data-state": checked(key) ? "checked" : "unchecked",
    "data-disabled": dataFlag(disabled),
    "data-readonly": dataFlag(input.readOnly),
    "data-invalid": dataFlag(input.invalid),
  })
  const isDisabled = (key: CollectionKey, own: boolean) =>
    input.disabled || own || c.get(key)?.disabled === true

  return {
    root: (): PartProps => ({
      ...scopeAttrs(sc, radioPartName(naming, "root"), input.instance),
      id: ids.list,
      role: "radiogroup",
      "aria-orientation": input.orientation,
      "aria-labelledby": input.field?.label ?? input.rendered.label,
      "aria-describedby": join(
        input.field?.description,
        input.field?.error,
        input.rendered.description,
        error,
      ),
      "aria-required": input.required ? "true" : undefined,
      "aria-invalid": input.invalid ? "true" : undefined,
      "aria-readonly": input.readOnly ? "true" : undefined,
      "aria-disabled": input.disabled ? "true" : undefined,
      "data-orientation": input.orientation,
      "data-required": dataFlag(input.required),
      ...groupState,
      // The root is the stop only when no radio can be (all disabled, or a focusable
      // disabled group).
      tabindex: inert || input.pending || input.hosted ? undefined : enabledRadio ? undefined : 0,
      onKeyDown: (event: unknown) => {
        if (input.hosted) return
        const e = event as KeyboardEvent
        const target = e.target as Element | null
        // Only keys on a radio of this group (a link inside an item keeps its keys).
        if (
          inert ||
          target?.getAttribute("data-part") !== naming.control ||
          target.getAttribute("data-instance") !== input.instance
        ) {
          return
        }
        const k = describeKey(e, env)
        if (k.composing || k.alt || k.ctrl || k.meta) return
        const logical = toLogicalKey(k, {
          dir: env.locale.dir(),
          orientation: "both",
          platform: env.platform,
        })
        if (logical !== "NEXT" && logical !== "PREV") return
        e.preventDefault()
        send({ type: "NAVIGATE", move: logical === "NEXT" ? "next" : "previous" })
      },
      onFocusOut: (event: unknown) => {
        const e = event as FocusEvent
        const root = e.currentTarget as Element | null
        if (!root?.contains(e.relatedTarget as Node | null)) send({ type: "BLUR" })
      },
    }),
    label: (): PartProps => ({
      ...scopeAttrs(sc, radioPartName(naming, "label"), input.instance),
      id: ids.label,
      ...groupState,
    }),
    description: (): PartProps => ({
      ...scopeAttrs(sc, radioPartName(naming, "description"), input.instance),
      id: ids.description,
      ...groupState,
    }),
    errorMessage: (): PartProps => ({
      ...scopeAttrs(sc, radioPartName(naming, "error-message"), input.instance),
      id: ids.errorMessage,
      ...groupState,
    }),
    item: (key: CollectionKey, own: { disabled: boolean }): PartProps => ({
      ...scopeAttrs(sc, radioPartName(naming, "item"), input.instance),
      ...itemState(key, isDisabled(key, own.disabled)),
    }),
    itemControl: (key: CollectionKey, s: RadioItemState): PartProps => {
      const disabled = isDisabled(key, s.itemDisabled)
      const highlighted = input.highlightedKey === key
      // Server render (items not registered): the checked item, else the first rendered.
      // A disabled group has no radio tab stop (the root is, with focusableWhenDisabled).
      const tabindex = input.disabled
        ? -1
        : input.pending
          ? key === (input.pendingStop ?? input.value)
            ? 0
            : -1
          : key === stop
            ? 0
            : -1
      return {
        ...buttonLikeProps(
          {
            role: "radio",
            tag: s.tag,
            disabled,
            focusableWhenDisabled: input.focusableWhenDisabled,
            type: "button",
          },
          env,
        ),
        ...scopeAttrs(sc, naming.control, input.instance),
        id: ids.item(key),
        role: "radio",
        "aria-checked": String(checked(key)),
        // Only rendered parts are referenced; a labelable control is named natively.
        "aria-labelledby": !s.labelable && s.labelRendered ? ids.itemLabel(key) : undefined,
        "aria-describedby": s.descriptionRendered ? ids.itemDescription(key) : undefined,
        tabindex,
        ...itemState(key, disabled),
        "data-highlighted": dataFlag(highlighted),
        ...focusAttrs(s.focused, s.modality),
        "data-pressed": dataFlag(s.pressed),
        "data-hover": dataFlag(s.hovered),
        onFocus: () => send({ type: "FOCUS", key, modality: env.modality.modality() }),
        // The id is the part's: item labels, the roving focus and the group resolve it.
        [CRITICAL]: ["aria-checked", "role", "!id"],
      }
    },
    itemIndicator: (key: CollectionKey, own: { disabled: boolean }): PartProps => ({
      ...scopeAttrs(sc, radioPartName(naming, "item-indicator"), input.instance),
      "aria-hidden": "true",
      ...itemState(key, isDisabled(key, own.disabled)),
    }),
    itemLabel: (key: CollectionKey, own: { disabled: boolean; labelable: boolean }): PartProps => ({
      ...scopeAttrs(sc, radioPartName(naming, "item-label"), input.instance),
      id: ids.itemLabel(key),
      htmlFor: own.labelable ? ids.item(key) : undefined,
      ...itemState(key, isDisabled(key, own.disabled)),
    }),
    itemDescription: (key: CollectionKey, own: { disabled: boolean }): PartProps => ({
      ...scopeAttrs(sc, radioPartName(naming, "item-description"), input.instance),
      id: ids.itemDescription(key),
      ...itemState(key, isDisabled(key, own.disabled)),
    }),
    /** The item's native radio: shared name, its value; checked as a property. */
    hiddenInput: (key: CollectionKey, own: { disabled: boolean }): PartProps => ({
      ...scopeAttrs(sc, radioPartName(naming, "hidden-input"), input.instance),
      type: "radio",
      id: ids.hiddenInput(key),
      "aria-hidden": "true",
      // Named by the visible radio, for checkers that flag an unlabelled input anyway (WAVE,
      // reka-ui#3014); assistive technology never reaches it.
      "aria-labelledby": ids.item(key),
      tabIndex: -1,
      name: input.name ?? ids.name,
      value: key,
      form: input.form,
      required: input.required || undefined,
      disabled: isDisabled(key, own.disabled) || undefined,
      // The server HTML submits the value before hydration; the property follows it after.
      defaultChecked: checked(key),
      style: hiddenFormInputStyle,
    }),
  }
}
