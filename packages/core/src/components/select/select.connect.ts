// Select parts (design §2, §3, §5): the `combobox` trigger (button-like, named by the label,
// never by its value), the label, the value text rendered from collection data, the
// popup's positioner and content, and the listbox parts under `data-scope="select"` with
// Tab on the list. The hidden input is the form's (no hidden <select>, design §4).

import { focusAttrs } from "../../a11y/focus"
import type { CompositeEnv } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import { isSelected, type SelectionValue, selectedKeys } from "../../collection/selection"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import { describeKey } from "../../dom/keyboard"
import type { LayerMeta } from "../../dom/layer-stack"
import type { LinkEnv } from "../../dom/link"
import {
  contentPlacementProps,
  type PlacementState,
  positionerProps,
} from "../../dom/position/connect"
import { listboxParts } from "../listbox/listbox.parts"
import { buttonLikeProps } from "../shared/button-like"
import type { SelectCloseReason, SelectEvent } from "./select.machine"
import { selectIds } from "./select.machine"

export type SelectPart =
  | "label"
  | "trigger"
  | "value-text"
  | "indicator"
  | "description"
  | "positioner"
  | "content"
  | "hidden-input"
  | "hidden-value"

export interface SelectConnectInput {
  readonly instance: string
  readonly open: boolean
  readonly collection: Collection<unknown>
  readonly selection: SelectionValue
  readonly multiple: boolean
  readonly highlightedKey: CollectionKey | null
  readonly highlightSource: string | null
  readonly typingAhead: () => boolean
  readonly placement: PlacementState
  readonly closeReason: SelectCloseReason | null
  readonly modal: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly invalid: boolean
  readonly autofilled: boolean
  readonly focusableWhenDisabled?: boolean | undefined
  /** Last known texts of selected keys (an option filtered out or not loaded yet). */
  readonly texts: ReadonlyMap<CollectionKey, string>
  readonly placeholder?: string | undefined
  /** Joins several selected texts ("Apple, Pear, and Plum"). */
  readonly listFormat: (texts: readonly string[]) => string
  /** Mounted parts: the ARIA references exist only then. */
  readonly mounted: {
    readonly label: boolean
    readonly description: boolean
    readonly list: boolean
    readonly empty: boolean
    readonly itemDescription: (key: CollectionKey) => boolean
  }
  readonly meta?: LayerMeta | undefined
  readonly dir?: "ltr" | "rtl" | undefined
  readonly manual?: boolean | undefined
  /** The list has focus inside (its focus attributes). */
  readonly listFocused: boolean
  readonly modality: Modality
}

/** The trigger's own state. */
export interface SelectTriggerState {
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  /** The consumer named the trigger itself. */
  readonly label?: string | undefined
  readonly labelledBy?: string | undefined
  readonly describedBy?: string | undefined
}

// Sound: without an href the link branch, the only reader of the link env, is never taken.
const NO_LINK = {} as LinkEnv

const join = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(" ") || undefined

/** The selected texts in collection order (a key out of the items keeps its last text). */
export function selectedTexts(
  collection: Collection<unknown>,
  selection: SelectionValue,
  texts: ReadonlyMap<CollectionKey, string>,
): string[] {
  const keys = [...selectedKeys(collection, selection)]
  const order = (k: CollectionKey) => collection.get(k)?.index ?? Number.MAX_SAFE_INTEGER
  return keys
    .sort((a, b) => order(a) - order(b))
    .map((k) => collection.get(k)?.textValue ?? texts.get(k) ?? "")
}

export function selectConnect(
  input: SelectConnectInput,
  send: (event: SelectEvent) => void,
  env: CompositeEnv,
) {
  const { instance } = input
  const ids = selectIds(instance)
  const dataState = input.open ? "open" : "closed"
  const flags = {
    "data-disabled": dataFlag(input.disabled),
    "data-readonly": dataFlag(input.readOnly),
    "data-required": dataFlag(input.required),
    "data-invalid": dataFlag(input.invalid),
  }
  const texts = selectedTexts(input.collection, input.selection, input.texts)
  const placeholder = texts.length === 0
  const scope = (part: SelectPart) => scopeAttrs("select", part, instance)
  const listbox = listboxParts(
    {
      scope: "select",
      instance,
      collection: input.collection,
      context: {
        highlightedKey: input.highlightedKey,
        highlightSource: input.highlightSource as never, // the collection's own source union
      },
      selection: input.selection,
      selectionMode: input.multiple ? "multiple" : "single",
      selectionBehavior: "toggle",
      orientation: "vertical",
      disabled: input.disabled,
      focusableWhenDisabled: input.focusableWhenDisabled,
      typingAhead: input.typingAhead,
      actions: false,
      focused: input.listFocused,
      modality: input.modality,
      mounted: {
        label: input.mounted.label,
        empty: input.mounted.empty,
        description: input.mounted.itemDescription,
      },
      // The listbox's own FOCUS/ACTION never apply to a select's popup.
      send: (e) => {
        if (e.type !== "FOCUS" && e.type !== "ACTION") send(e)
      },
    },
    env,
  )
  return {
    open: input.open,
    placeholder,
    texts,
    listbox,
    label: (): PartProps => ({
      ...scope("label"),
      id: ids.label,
      ...flags,
      // A pointer press focuses the trigger and never opens it (label-interaction).
      onPointerDown: (event: unknown) => {
        const e = event as PointerEvent
        if (e.button !== 0) return
        // The trigger takes focus on the press, not the label (a span is not focusable).
        e.preventDefault()
        send({ type: "LABEL_PRESS" })
      },
      // Assistive technology activates with a bare click (no pointer down before it).
      onClick: (event: unknown) => {
        if ((event as MouseEvent).detail === 0) send({ type: "LABEL_PRESS" })
      },
    }),
    trigger: (s: SelectTriggerState): PartProps => {
      const named = s.label !== undefined || s.labelledBy !== undefined
      return {
        ...scope("trigger"),
        ...buttonLikeProps(
          {
            role: "button",
            tag: s.tag,
            disabled: input.disabled,
            focusableWhenDisabled: input.focusableWhenDisabled === true,
          },
          NO_LINK,
        ),
        id: ids.trigger,
        role: "combobox",
        "aria-expanded": String(input.open),
        "aria-controls": input.mounted.list ? ids.list : undefined,
        "aria-labelledby": named ? s.labelledBy : input.mounted.label ? ids.label : undefined,
        "aria-label": s.label,
        "aria-describedby": join(
          s.describedBy,
          input.mounted.description ? ids.description : undefined,
        ),
        "aria-required": input.required ? "true" : undefined,
        "aria-invalid": input.invalid ? "true" : undefined,
        "data-state": dataState,
        "data-placeholder": dataFlag(placeholder),
        "data-autofill": dataFlag(input.autofilled),
        "data-pressed": dataFlag(s.pressed),
        ...focusAttrs(s.focused, s.modality),
        ...flags,
        [CRITICAL]: ["aria-expanded", "role"],
        onKeyDown: (event: unknown) => {
          const e = event as KeyboardEvent
          // An IME composition (also keyCode 229 and a composition in progress) owns its keys.
          if (describeKey(e, env).composing) return
          if (e.target !== e.currentTarget || input.open) return
          if (input.disabled || input.readOnly) return
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (e.ctrlKey || e.metaKey) return
            e.preventDefault()
            send({ type: "TRIGGER_KEY", key: e.key === "ArrowUp" && !e.altKey ? "last" : "first" })
            return
          }
          const printable = [...e.key].length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
          // Space opens unless a search is in progress (it joins it).
          if (!printable || (e.key === " " && !input.typingAhead())) return
          e.preventDefault()
          send({
            type: "TYPEAHEAD",
            char: e.key,
            composing: false,
            modifiers: { ctrl: false, meta: false, alt: false },
          })
        },
      }
    },
    valueText: (): PartProps => ({
      ...scope("value-text"),
      id: ids.valueText,
      "data-placeholder": dataFlag(placeholder),
    }),
    /** What the value text shows: the joined texts, else the placeholder. */
    valueTextContent: (): string =>
      placeholder
        ? (input.placeholder ?? "")
        : input.multiple
          ? input.listFormat(texts)
          : (texts[0] ?? ""),
    indicator: (): PartProps => ({
      ...scope("indicator"),
      "aria-hidden": "true",
      "data-state": dataState,
    }),
    description: (): PartProps => ({ ...scope("description"), id: ids.description, ...flags }),
    positioner: (): PartProps => ({
      ...scope("positioner"),
      ...positionerProps(
        input.placement,
        { positioner: ids.positioner, anchor: ids.trigger },
        { dir: input.dir, manual: input.manual === true },
      ),
      "data-state": dataState,
    }),
    content: (): PartProps => {
      const meta = input.meta
      return {
        ...scope("content"),
        ...contentPlacementProps(input.placement),
        id: ids.content,
        "data-state": dataState,
        "data-modal": dataFlag(input.modal),
        "data-close-reason": !input.open ? (input.closeReason ?? undefined) : undefined,
        ...(meta
          ? {
              "data-nested": dataFlag(meta.nested),
              "data-has-nested": dataFlag(meta.hasNested),
              style: {
                ...(input.placement.placed ? {} : { "animation-name": "none" }),
                "--layer-index": String(meta.index),
              },
            }
          : {}),
      }
    },
    /**
     * The list: the listbox part, named by the label, else the trigger's consumer
     * `aria-label` (copied), else its `aria-labelledby` — never the trigger, whose name
     * computation returns the value. Tab closes the popup; the browser's Tab goes on.
     */
    list: (trigger: { label?: string | undefined; labelledBy?: string | undefined }): PartProps => {
      const naming = input.mounted.label
        ? {}
        : trigger.label !== undefined
          ? { "aria-label": trigger.label }
          : { "aria-labelledby": trigger.labelledBy }
      const own = listbox.list(naming)
      const keyDown = own["onKeyDown"] as ((e: unknown) => void) | undefined
      return {
        ...own,
        id: ids.list,
        ...naming,
        tabindex: -1,
        onKeyDown: (event: unknown) => {
          const e = event as KeyboardEvent
          if (e.key === "Tab" && !describeKey(e, env).composing) {
            send({ type: "TAB_KEY", shift: e.shiftKey })
            return
          }
          keyDown?.(event)
        },
      }
    },
    isSelected: (key: CollectionKey) => isSelected(input.collection, input.selection, key),
    hiddenInput: (s: {
      name?: string | undefined
      form?: string | undefined
      autoComplete?: string | undefined
    }): PartProps => {
      const keys = [...selectedKeys(input.collection, input.selection)]
      return {
        ...scope("hidden-input"),
        id: ids.hiddenInput,
        "aria-hidden": "true",
        tabindex: -1,
        // Multiple: the values ride on hidden inputs; this one carries the constraint only.
        name: input.multiple ? undefined : s.name,
        form: s.form,
        autocomplete: s.autoComplete,
        // Required means "a key is selected": the "" key is a value, though the input's
        // value is empty, so the constraint applies only while nothing is selected.
        required: (input.required && keys.length === 0) || undefined,
        disabled: input.disabled || undefined,
        style: hiddenFormInputStyle,
        // A pre-filled value for the server render; the capability syncs it after.
        defaultValue: input.multiple ? (keys.length > 0 ? "x" : "") : (keys[0] ?? ""),
      }
    },
    /** Multiple: one hidden carrier per selected key (the form's values). */
    hiddenValue: (
      key: CollectionKey,
      s: { name?: string | undefined; form?: string | undefined },
    ): PartProps => ({
      ...scope("hidden-value"),
      type: "hidden",
      name: s.name,
      form: s.form,
      value: key,
    }),
    pressTrigger: (modality: Modality) => send({ type: "TRIGGER_PRESS", modality }),
  }
}
