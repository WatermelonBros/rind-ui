// Combobox parts (combobox + combobox-pattern specs): the input owns the keyboard and keeps
// focus; the list and items are the reusable listbox parts under scope "combobox", with
// their own tab stop and keyboard removed (active descendant through the input).

import { focusAttrs } from "../../a11y/focus"
import type { CompositeEnv } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import type { LoadingStatus } from "../../collection/machine"
import { isSelected, type SelectionValue } from "../../collection/selection"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import { contentPlacementProps, positionerProps } from "../../dom/position/connect"
import { type Chip, inputChipsConnect } from "../input-chips/input-chips"
import type { ListboxEvent } from "../listbox/listbox.machine"
import { listboxParts } from "../listbox/listbox.parts"
import type { ComboboxContext, ComboboxEvent } from "./combobox.machine"
import { comboboxIds } from "./combobox.machine"
import type { ComboboxMessages } from "./combobox.messages"

export interface ComboboxConnectView {
  readonly instance: string
  readonly open: boolean
  /** The listbox is shown (open and not in the empty state). */
  readonly exposed: boolean
  /** Open, no options, not loading or stale: the Empty part shows. */
  readonly empty: boolean
  /** The popup is rendered (open, or playing its exit). */
  readonly present: boolean
  readonly results: Collection<unknown>
  readonly context: ComboboxContext
  readonly selection: SelectionValue
  readonly selectionMode: "single" | "multiple" | "none"
  readonly inputValue: string
  readonly hasValue: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly invalid: boolean
  readonly required: boolean
  /** The form name of the selected keys (one hidden entry per key). */
  readonly name?: string | undefined
  /** The form name of the visible text. */
  readonly inputName?: string | undefined
  readonly form?: string | undefined
  /** The selected keys, for the hidden inputs. */
  readonly keys: readonly string[]
  /** Multiple: the chips of the selection (input-chips). */
  readonly chips: readonly Chip[]
  readonly autoComplete: "list" | "both"
  readonly loading?: LoadingStatus | undefined
  readonly modality: Modality
  readonly dir: "ltr" | "rtl"
  readonly messages: ComboboxMessages
  readonly mounted: { readonly label: boolean; readonly empty: boolean }
  readonly send: (event: ComboboxEvent) => void
}

type NativeKey = KeyboardEvent

export type ComboboxConnectEnv = CompositeEnv & {
  readonly dom: { getById(id: string): Element | null }
}

export function comboboxConnect(v: ComboboxConnectView, env: ComboboxConnectEnv) {
  const ids = comboboxIds(v.instance)
  const { send, context: c } = v
  const dataState = v.open ? "open" : "closed"
  // The input and trigger say what aria-expanded says: closed in the empty state.
  const exposedState = v.exposed ? "open" : "closed"
  const composing = () => c.composing
  // Composite events become the combobox's: a press is a choice, nothing else selects.
  const list = listboxParts(
    {
      scope: "combobox",
      instance: v.instance,
      collection: v.results,
      context: c,
      selection: v.selection,
      selectionMode: v.selectionMode,
      selectionBehavior: "toggle",
      orientation: "vertical",
      strategy: "active-descendant",
      disabled: v.disabled,
      loading: v.loading,
      typingAhead: () => false,
      actions: false,
      focused: false,
      modality: v.modality,
      mounted: { label: v.mounted.label, empty: v.mounted.empty, description: () => false },
      send: (e: ListboxEvent) => {
        // Presses on a closing popup choose nothing (Results While Closing).
        if (!v.open) return
        if (e.type === "SELECT") send({ type: "ITEM.CHOOSE", key: e.key, modality: e.modality })
        else if (e.type === "POINTER_MOVE") send(e)
      },
    },
    env,
  )
  const lagging = c.typingLag !== null && c.highlightSource === "typing"
  const shownText = c.completion ?? v.inputValue
  const common = (part: string): PartProps => ({
    ...scopeAttrs("combobox", part, v.instance),
    "data-state": dataState,
    "data-disabled": dataFlag(v.disabled),
    "data-readonly": dataFlag(v.readOnly),
    "data-invalid": dataFlag(v.invalid),
  })
  const focusInput = (modality: Modality) => {
    if (modality === "touch") return
    // Sound: the id is the Input part's, rendered as an <input>.
    const input = env.dom.getById(ids.input) as HTMLElement | null
    input?.focus({ preventScroll: true })
  }
  // A mouse press on the component's own surfaces never takes focus from the input.
  const keepFocus = (event: unknown) => {
    const e = event as MouseEvent
    if (e.button === 0) e.preventDefault()
  }

  const chips = inputChipsConnect(
    {
      scope: "combobox",
      instance: v.instance,
      chips: v.chips,
      context: c,
      dir: v.dir,
      messages: v.messages,
      inputId: ids.input,
      controlId: ids.control,
      send,
      blurHost: () => send({ type: "INPUT.BLUR" }),
    },
    env,
  )
  // Focus moving to a chip, a chip remove button or the trigger stays inside (input-chips).
  const insideControl = (target: unknown) =>
    env.dom.getById(ids.control)?.contains(target as Node | null) === true && target !== null

  return {
    ids,
    chipsSummary: chips.summaryText,
    chips: chips.chips,
    chip: chips.chip,
    chipRemove: chips.chipRemove,
    chipsSummaryNode: chips.summary,
    /** The completion's selected range in the input, applied after render. */
    completionRange:
      c.completion !== null ? ([v.inputValue.length, c.completion.length] as const) : null,
    root: (): PartProps => ({
      ...common("root"),
      "data-focus": dataFlag(c.focused),
      "data-empty-value": dataFlag(!v.hasValue),
    }),
    label: (): PartProps => ({
      ...common("label"),
      id: ids.label,
      htmlFor: ids.input,
    }),
    control: (): PartProps => ({
      ...common("control"),
      id: ids.control,
      "data-focus": dataFlag(c.focused),
      "data-empty-value": dataFlag(!v.hasValue),
    }),
    input: (): PartProps => ({
      ...common("input"),
      "data-state": exposedState,
      ...focusAttrs(c.focused, v.modality),
      id: ids.input,
      role: "combobox",
      type: "text",
      value: shownText,
      disabled: v.disabled || undefined,
      readOnly: v.readOnly || undefined,
      autoComplete: "off",
      autoCorrect: "off",
      autoCapitalize: "none",
      spellCheck: "false",
      "aria-autocomplete": v.autoComplete,
      "aria-expanded": String(v.exposed),
      "aria-controls": v.present ? ids.list : undefined,
      "aria-labelledby": v.mounted.label ? ids.label : undefined,
      "aria-describedby": chips.describedBy,
      "aria-invalid": v.invalid ? "true" : undefined,
      "aria-required": v.required ? "true" : undefined,
      name: v.inputName,
      form: v.inputName !== undefined ? v.form : undefined,
      "aria-activedescendant":
        v.exposed && !lagging && c.highlightedKey !== null && v.results.has(c.highlightedKey)
          ? ids.item(c.highlightedKey)
          : undefined,
      [CRITICAL]: ["aria-expanded", "aria-activedescendant"],
      onChange: (event: unknown) => {
        const e = event as { target: HTMLInputElement; nativeEvent?: InputEvent }
        const el = e.target
        const native = (e.nativeEvent ?? event) as InputEvent
        // The completion's suffix is not typed text: the typed part is what precedes it.
        send({
          type: "INPUT.CHANGE",
          text: el.value,
          inputType: native.inputType ?? "insertText",
          composing: native.isComposing === true || composing(),
          caretAtEnd: el.selectionStart === el.value.length,
        })
      },
      onCompositionStart: () => send({ type: "COMPOSITION.START" }),
      onCompositionEnd: (event: unknown) => {
        const e = event as CompositionEvent
        send({ type: "COMPOSITION.END", text: (e.target as HTMLInputElement).value })
      },
      onFocus: (event: unknown) => {
        const el = (event as FocusEvent).currentTarget as Element
        send({
          type: "INPUT.FOCUS",
          modality: env.modality.modality(),
          cause: env.modality.focusCause(el),
        })
      },
      onBlur: (event: unknown) => {
        if (!insideControl((event as FocusEvent).relatedTarget)) send({ type: "INPUT.BLUR" })
      },

      onKeyDown: (event: unknown) => {
        const e = event as NativeKey
        const ime = e.isComposing || composing() || e.keyCode === 229
        if (!ime && v.selectionMode === "multiple") {
          const el = e.currentTarget as HTMLInputElement
          const atStart = el.selectionStart === 0 && el.selectionEnd === 0
          if (chips.inputKeyDown(e, el.value, atStart)) return
        }
        switch (e.key) {
          case "ArrowDown":
          case "ArrowUp":
            if (ime || v.disabled) return
            send({
              type: "ARROW",
              key: e.key === "ArrowDown" ? "NEXT" : "PREV",
              alt: e.altKey,
              composing: false,
            })
            e.preventDefault()
            return
          case "Enter":
            if (ime) return
            // Prevented only when it chooses: otherwise the form submits with the same Enter.
            if (v.open && c.highlightedKey !== null && v.results.has(c.highlightedKey))
              e.preventDefault()
            send({ type: "ENTER", composing: false })
            return
          case "Escape": {
            if (ime) return
            const acts = c.completion !== null || v.open || c.dirty
            send({ type: "ESCAPE", composing: false })
            if (acts) e.preventDefault()
            return
          }
          case "Tab":
            if (!ime) send({ type: "TAB", composing: false })
            return
          case "ArrowLeft":
          case "ArrowRight":
          case "Home":
          case "End":
            if (
              !ime &&
              (c.highlightedKey !== null || c.completion !== null || c.armedChip !== null)
            )
              send({ type: "CARET" })
            return
        }
      },
    }),
    trigger: (): PartProps => ({
      ...common("trigger"),
      "data-state": exposedState,
      id: ids.trigger,
      type: "button",
      tabindex: -1,
      disabled: v.disabled || undefined,
      "aria-label": v.messages.triggerLabel,
      "aria-expanded": String(v.exposed),
      "aria-controls": v.present ? ids.list : undefined,
      "aria-haspopup": "listbox",
      [CRITICAL]: ["aria-expanded"],
      onMouseDown: keepFocus,
    }),
    /**
     * Presses, through the adapter's press interaction with `labelActivation: "focus"`: a
     * click a label forwards focuses the input and opens nothing (combobox "Label
     * Activation Focuses The Input").
     */
    pressInput: (modality: Modality) => send({ type: "INPUT.PRESS", modality }),
    pressTrigger: (modality: Modality) => {
      send({ type: "TRIGGER.PRESS", modality })
      focusInput(modality)
    },
    clearTrigger: (): PartProps => ({
      ...common("clear-trigger"),
      id: ids.clear,
      type: "button",
      tabindex: -1,
      disabled: v.disabled || v.readOnly || undefined,
      "aria-label": v.messages.clearLabel,
      "data-visible": dataFlag(v.inputValue !== "" || v.hasValue),
      hidden: v.inputValue === "" && !v.hasValue ? true : undefined,
      onMouseDown: keepFocus,
      onClick: () => {
        const modality = env.modality.modality()
        send({ type: "CLEAR.PRESS", modality })
        focusInput(modality)
      },
    }),
    positioner: (): PartProps => ({
      ...common("positioner"),
      ...positionerProps(
        c.placement,
        { positioner: ids.positioner, anchor: ids.control },
        { dir: v.dir },
      ),
      "data-empty": dataFlag(v.empty),
      "data-loading": dataFlag(v.loading === "loading" || v.loading === "loading-more"),
      // Without an Empty part the whole surface hides in the empty state.
      hidden: v.empty && !v.mounted.empty ? true : undefined,
    }),
    popup: (): PartProps => ({
      ...common("popup"),
      ...contentPlacementProps(c.placement),
      id: ids.popup,
      "data-empty": dataFlag(v.empty),
      "data-loading": dataFlag(v.loading === "loading" || v.loading === "loading-more"),
      onMouseDown: keepFocus,
    }),
    list: (): PartProps => {
      const {
        onKeyDown: _k,
        onFocusIn: _f,
        onFocusOut: _o,
        tabindex: _t,
        "aria-activedescendant": _a,
        ...own
      } = list.list(v.mounted.label ? {} : { "aria-label": v.messages.listboxLabel })
      return {
        ...own,
        "aria-label": v.mounted.label ? undefined : v.messages.listboxLabel,
        "aria-labelledby": v.mounted.label ? ids.label : undefined,
        "aria-describedby": undefined,
        onPointerLeave: (event: unknown) => {
          if ((event as PointerEvent).pointerType !== "touch") send({ type: "LIST.POINTER_LEAVE" })
        },
        // The empty state hides the listbox (it is not exposed), never unmounts it.
        hidden: v.present && !v.exposed ? true : undefined,
      }
    },
    item: (key: CollectionKey): PartProps => {
      const own = list.item(key)
      return {
        ...own,
        "data-state": isSelected(v.results, v.selection, key) ? "checked" : "unchecked",
        // Roving focus never applies: the input keeps focus.
        onFocus: undefined,
      }
    },
    itemText: list.itemText,
    itemIndicator: (key: CollectionKey): PartProps => ({
      ...list.itemIndicator(key),
      "data-state": isSelected(v.results, v.selection, key) ? "checked" : "unchecked",
    }),
    section: list.section,
    sectionLabel: list.sectionLabel,
    separator: list.separator,
    empty: (): PartProps => ({
      ...common("empty"),
      id: ids.empty,
      hidden: v.empty ? undefined : true,
    }),
    loadMore: list.loadMore,
    /**
     * The constraint input (hidden-form-input): no name, empty exactly when nothing is
     * selected, so `required` is validated natively next to the Control.
     */
    hiddenInput: (): PartProps => ({
      ...scopeAttrs("combobox", "hidden-input", v.instance),
      type: "text",
      "aria-hidden": "true",
      tabIndex: -1,
      autoComplete: v.name === undefined ? "off" : undefined,
      required: v.required || undefined,
      disabled: v.disabled || undefined,
      form: v.form,
      style: hiddenFormInputStyle,
      // Its value is written as a property by the form capability, never rendered.
      defaultValue: v.keys.join(","),
    }),
    /** One submitted entry per selected key (none without a name). */
    carriers: (): readonly PartProps[] =>
      v.name === undefined
        ? []
        : v.keys.map((key) => ({
            type: "hidden",
            name: v.name,
            value: key,
            form: v.form,
            disabled: v.disabled || undefined,
          })),
  }
}

export type ComboboxApi = ReturnType<typeof comboboxConnect>
