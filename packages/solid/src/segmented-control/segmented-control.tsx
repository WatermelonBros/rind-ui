/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type ChangeDetails,
  createListCollection,
  hiddenFormInput,
  type ItemRegistry,
  implicitSubmit,
  isImeKey,
  layoutCapability,
  type RadioGroupEvent,
  radioGroupMachine,
  segmentedControlConnect,
  segmentedControlIds,
  toKey,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { declaredStop, useCollectionItems, useRegisterItem } from "../use-collection-items"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useSelectionIndicator } from "../use-selection-indicator"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

interface Ctx {
  readonly instance: Accessor<string>
  readonly api: (pendingStop?: string | null) => ReturnType<typeof segmentedControlConnect>
  readonly send: (event: RadioGroupEvent) => void
  readonly registry: ItemRegistry
  readonly collection: () => unknown
  readonly parts: PartRegistry<"label">
  readonly ids: Accessor<ReturnType<typeof segmentedControlIds>>
  readonly value: Accessor<string | null>
  readonly disabled: Accessor<boolean>
  /** A user change waiting for its commit: that segment's input dispatches input + change. */
  readonly pending: { current: string | null }
  readonly stop: ReturnType<typeof declaredStop>
}
const ControlContext = createContext<Ctx>()
function useControl(part: string): Ctx {
  const ctx = useContext(ControlContext)
  if (!ctx) throw new Error(`SegmentedControl.${part} must be inside SegmentedControl.Root`)
  return ctx
}

export interface SegmentedControlState {
  readonly value: string | null
  readonly disabled: boolean
}
export interface SegmentState {
  readonly checked: boolean
  readonly disabled: boolean
}

export type SegmentedControlRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "id"
> & {
  /** Controlled value. */
  readonly value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((value: string | null, details: ChangeDetails<RadioGroupEvent>) => void)
    | undefined
  /** `aria-orientation`, `data-orientation` and the indicator only: every arrow key moves. */
  readonly orientation?: "horizontal" | "vertical" | undefined
  readonly disabled?: boolean | undefined
  readonly focusableWhenDisabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  /** Default: derived from the root id. */
  readonly name?: string | undefined
  readonly form?: string | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<SegmentedControlState> | undefined
  readonly children?: JSX.Element | ((state: SegmentedControlState) => JSX.Element)
}

function Root(props: SegmentedControlRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "orientation",
    "disabled",
    "focusableWhenDisabled",
    "readOnly",
    "required",
    "invalid",
    "name",
    "form",
    "id",
    "render",
    "children",
    "aria-label",
  ])
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(() => local.id)
  const ids = createMemo(() => segmentedControlIds(instance()))
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const groupDisabled = () => local.disabled === true || fieldsetContext() || fieldsetDom()
  const { collection: registered, registry } = useCollectionItems()
  const collection = () => registered() ?? EMPTY
  const pending = { current: null as string | null }
  const { view, send } = useMachine(
    radioGroupMachine,
    () => ({
      collection: collection(),
      strategy: "roving" as const,
      ids: ids(),
      loop: true,
      selectionMode: "single" as const,
      focusableWhenDisabled: local.focusableWhenDisabled,
      value: local.value,
      defaultValue: local.defaultValue,
      // A user change (an arrow or a press) is dispatched on that segment's input after update.
      onValueChange: (next: string | null, details: ChangeDetails<RadioGroupEvent>) => {
        if (details.reason === "NAVIGATE" || details.reason === "PRESS") pending.current = next
        local.onValueChange?.(next, details)
      },
      disabled: groupDisabled(),
      readOnly: local.readOnly,
    }),
    env,
  )
  const current = (): string | null => view().values.value ?? null
  // The Label is expected unless aria-label names the control: the server HTML then already
  // labels the root (base-ui#5597).
  const parts = usePartRegistry<"label">({
    scope: "segmented-control",
    root: instance(),
    ...(local["aria-label"] === undefined ? { expected: ["label"] as const } : {}),
  })
  const labelRendered = useRenderedId(parts, "label")
  const api = (pendingStop: string | null = null) =>
    segmentedControlConnect(
      {
        instance: instance(),
        collection: collection(),
        value: current(),
        highlightedKey: view().context.highlightedKey,
        highlightSource: view().context.highlightSource,
        pending: registered() === null,
        pendingStop,
        orientation: local.orientation ?? "horizontal",
        disabled: groupDisabled(),
        focusableWhenDisabled: local.focusableWhenDisabled === true,
        readOnly: local.readOnly === true,
        required: local.required === true,
        invalid: local.invalid === true,
        name: local.name,
        form: local.form,
        labelRendered: labelRendered(),
        ariaLabel: local["aria-label"],
        indicator: view().context.indicator,
      },
      send,
      env,
    )
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() => {
    const node = el()
    if (!node) return
    const w = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(w.disabled)
    // A form reset is answered once, by the control (every segment's input re-syncs).
    const doc = node.ownerDocument
    const onReset = (e: Event) => {
      if (e.defaultPrevented) return
      const input = node.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
      if (input && e.target === input.form) send({ type: "RESET" })
    }
    doc.addEventListener("reset", onReset)
    onCleanup(() => {
      w.stop()
      doc.removeEventListener("reset", onReset)
    })
    // After the segments' updates: a proposal the parent refused never dispatches later.
    createEffect(() => {
      const now = current()
      if (pending.current !== null && pending.current !== now) pending.current = null
    })
    // Development: a radiogroup needs a name (Label, aria-label or aria-labelledby).
    if (process.env.NODE_ENV !== "production") {
      createEffect(() => {
        labelRendered()
        local["aria-label"]
        queueMicrotask(() => {
          if (!node.isConnected) return
          if (!node.getAttribute("aria-labelledby") && !node.getAttribute("aria-label")) {
            console.warn(
              `[rind-ui] segmented-control: #${node.id} has no accessible name; render SegmentedControl.Label or pass aria-label`,
            )
          }
        })
      })
    }
  })
  const state = reactive<SegmentedControlState>(() => ({
    value: current(),
    disabled: groupDisabled(),
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        ...(local["aria-label"] === undefined ? {} : { "aria-label": local["aria-label"] }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <ControlContext.Provider
      value={{
        instance,
        api,
        send,
        registry,
        collection: registered,
        parts,
        ids,
        value: current,
        disabled: groupDisabled,
        pending,
        stop: declaredStop(),
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ControlContext.Provider>
  )
}

export type SegmentedControlLabelProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

/** Not a <label>: a radiogroup is not labelable. */
function Label(props: SegmentedControlLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useControl("Label")
  useRegisterPart(ctx.parts, "label", () => ctx.ids().label)
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().label()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type SegmentedControlItemProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "value"
> & {
  /** The segment's value: what the control's value and the form submit. */
  readonly value: string
  /** Disables this segment: it cannot be checked. */
  readonly disabled?: boolean | undefined
  /** The text for the collection (defaults to the segment's text content). */
  readonly textValue?: string | undefined
  readonly render?: RenderProp<SegmentState> | undefined
  readonly children?: JSX.Element | ((state: SegmentState) => JSX.Element)
}

function Item(props: SegmentedControlItemProps) {
  const [local, rest] = splitProps(props, ["value", "disabled", "textValue", "render", "children"])
  const ctx = useControl("Item")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const key = () => toKey(local.value)
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = () => (local.render ? (el()?.tagName.toLowerCase() ?? "button") : "button")
  const ownDisabled = () => local.disabled === true
  useRegisterItem(
    ctx.registry,
    () => ({ key: local.value, textValue: local.textValue, disabled: ownDisabled() }),
    el,
  )
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const isDisabled = () => ctx.disabled() || ownDisabled()
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PRESS", key: key(), modality: e.modality })
    },
    disabled: isDisabled,
  })
  const hover = useHover({ env, send: () => {}, disabled: isDisabled })
  const [inputEl, setInputEl] = createSignal<HTMLInputElement | null>(null)
  const checked = () => ctx.value() === key()
  const formInput = hiddenFormInput(
    { input: () => inputEl(), control: () => el() as HTMLElement | null },
    env,
  )
  // Read once, in document order: this segment's view of the server tab stop.
  const pendingStop = ctx.stop(
    local.value,
    isDisabled(),
    ctx.value() === null ? [] : [ctx.value() as string],
  )
  afterMount(() => {
    // The input mirrors the value; the newly checked one, after a user change, dispatches
    // input + change (programmatic changes stay silent).
    createEffect(() => {
      inputEl()
      const isChecked = checked()
      const dispatch = isChecked && ctx.pending.current === key()
      formInput.sync({ checked: isChecked }, { dispatch })
      if (dispatch) ctx.pending.current = null
    })
    // Development: a segment needs a name (text content or aria-label).
    const node = el()
    if (process.env.NODE_ENV !== "production" && node) {
      const named =
        (node.textContent ?? "").trim() !== "" ||
        node.getAttribute("aria-label") ||
        node.getAttribute("aria-labelledby")
      if (!named) {
        console.warn(
          `[rind-ui] segmented-control: the item "${local.value}" has no text and no aria-label; an icon-only segment needs aria-label`,
        )
      }
    }
    onCleanup(
      formInput.track({
        onReset: () => {},
        current: () => ({ checked: untrack(checked) }),
        // The control answers the reset once; each input only re-syncs.
        resetsWithForm: false,
      }),
    )
  })
  const state = reactive<SegmentState>(() => ({ checked: checked(), disabled: isDisabled() }))
  const own = createMemo(() =>
    normalizeProps(
      ctx.api(pendingStop).item(key(), {
        tag: tag(),
        focused: focused(),
        modality: modality(),
        pressed: press.pressed(),
        hovered: hover.hovered(),
        itemDisabled: ownDisabled(),
      }),
    ),
  )
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          own(),
          {
            // Enter submits the form (implicit submission); it never selects.
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
              implicitSubmit(inputEl()?.form ?? null)
            },
          },
          press.props,
          hover.props,
          { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <>
      {renderPart(local.render, merged, state, children, (p) => (
        <button {...p}>{children()}</button>
      ))}
      {/* A sibling of the segment, never inside it (reka-ui#1597). */}
      <input
        {...normalizeProps(ctx.api().hiddenInput(key(), { disabled: ownDisabled() }))}
        ref={setInputEl}
      />
    </>
  )
}

export type SegmentedControlIndicatorProps = Omit<
  JSX.HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  readonly render?: RenderProp<{ readonly visible: boolean }> | undefined
  readonly children?: JSX.Element | ((state: { readonly visible: boolean }) => JSX.Element)
}

function Indicator(props: SegmentedControlIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useControl("Indicator")
  const [el, setEl] = createSignal<Element | null>(null)
  useSelectionIndicator({
    el,
    selectedId: () => {
      const value = ctx.value()
      return value === null ? null : ctx.ids().item(toKey(value))
    },
    itemSelector: `[data-part="item"][data-instance="${untrack(ctx.instance)}"]`,
    collection: ctx.collection,
    onMeasure: (box, cause) => ctx.send({ type: "INDICATOR.MEASURE", box, cause }),
  })
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().indicator()), ref: setEl }, rest),
  )
  const state = reactive(() => ({ visible: merged()["data-state"] === "visible" }))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <span {...p}>{children()}</span>)
}

/** The parts, by name: `segmented-control.parts.ts` re-exports them as the `SegmentedControl` namespace. */
export { Indicator, Item, Label, Root }
