"use client"

import {
  announcerCapability,
  type ChangeDetails,
  createListCollection,
  type FormInputCapability,
  hiddenFormInput,
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
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { declaredItems, serverStop } from "../declared-items"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"
import { useSelectionIndicator } from "../use-selection-indicator"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

interface Ctx {
  readonly instance: string
  readonly api: ReturnType<typeof segmentedControlConnect>
  readonly send: (event: RadioGroupEvent) => void
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly collection: ReturnType<typeof useCollectionItems>["collection"]
  readonly parts: ReturnType<typeof usePartRegistry<"label">>
  readonly ids: ReturnType<typeof segmentedControlIds>
  readonly value: string | null
  readonly disabled: boolean
  /** A user change waiting for its commit: that segment's input dispatches input + change. */
  readonly pending: { current: string | null }
}
const ControlContext = createContext<Ctx | null>(null)
function useControl(part: string): Ctx {
  const ctx = useContext(ControlContext)
  if (!ctx) throw new Error(`SegmentedControl.${part} must be inside SegmentedControl.Root`)
  return ctx
}

export interface SegmentedControlState {
  readonly value: string | null
  readonly disabled: boolean
}

export type SegmentedControlRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue"
> & {
  /** The control's parts: its label, items and indicator. */
  readonly children?: ReactNode
  readonly value?: string | null
  readonly defaultValue?: string | null
  readonly onValueChange?: (value: string | null, details: ChangeDetails<RadioGroupEvent>) => void
  /** `aria-orientation`, `data-orientation` and the indicator only: every arrow key moves. */
  readonly orientation?: "horizontal" | "vertical"
  readonly disabled?: boolean
  readonly focusableWhenDisabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
  /** Default: derived from the root id. */
  readonly name?: string
  readonly form?: string
  readonly render?: RenderProp<SegmentedControlState>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  disabled = false,
  focusableWhenDisabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  render,
  id,
  ref,
  children,
  ...rest
}: SegmentedControlRootProps) {
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(id)
  const ids = useMemo(() => segmentedControlIds(instance), [instance])
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = useState(false)
  const groupDisabled = disabled || fieldsetContext || fieldsetDom
  const { collection: registered, registry } = useCollectionItems()
  const collection = registered ?? EMPTY
  const pending = useRef<string | null>(null)
  const { view, send } = useMachine(
    radioGroupMachine,
    {
      collection,
      strategy: "roving",
      ids,
      loop: true,
      selectionMode: "single",
      focusableWhenDisabled,
      value,
      defaultValue,
      // A user change (an arrow or a press) is dispatched on that segment's input after commit.
      onValueChange: (next, details) => {
        if (details.reason === "NAVIGATE" || details.reason === "PRESS") pending.current = next
        onValueChange?.(next, details)
      },
      disabled: groupDisabled,
      readOnly,
    },
    env,
  )
  const current = view.values.value ?? null
  // The Label is expected unless aria-label names the control: the server HTML then
  // already labels the root (base-ui#5597), and the dev warning sees it on first mount.
  const parts = usePartRegistry<"label">({
    scope: "segmented-control",
    root: instance,
    ...(rest["aria-label"] === undefined ? { expected: ["label"] as const } : {}),
  })
  const labelRendered = useRenderedId(parts, "label")
  const api = segmentedControlConnect(
    {
      instance,
      collection,
      value: current,
      highlightedKey: view.context.highlightedKey,
      highlightSource: view.context.highlightSource,
      pending: registered === null,
      pendingStop: serverStop(declaredItems(children, Item), current === null ? [] : [current]),
      orientation,
      disabled: groupDisabled,
      focusableWhenDisabled,
      readOnly,
      required,
      invalid,
      name,
      form,
      labelRendered,
      ariaLabel: rest["aria-label"],
      indicator: view.context.indicator,
    },
    send,
    env,
  )
  const el = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const node = el.current
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    return watch.stop
  }, [])
  // A form reset is answered once, by the control (every segment's input re-syncs).
  useEffect(() => {
    const node = el.current
    if (!node) return
    const doc = node.ownerDocument
    const onReset = (e: Event) => {
      if (e.defaultPrevented) return
      const input = node.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
      if (input && e.target === input.form) send({ type: "RESET" })
    }
    doc.addEventListener("reset", onReset)
    return () => doc.removeEventListener("reset", onReset)
  }, [send])
  // After the segments' effects: a proposal the parent refused never dispatches later.
  useIsoLayoutEffect(() => {
    if (pending.current !== null && pending.current !== current) pending.current = null
  })
  // Development: a radiogroup needs a name (Label, aria-label or aria-labelledby).
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    if (!node.getAttribute("aria-labelledby") && !node.getAttribute("aria-label")) {
      console.warn(
        `[rind-ui] segmented-control: #${node.id} has no accessible name; render SegmentedControl.Label or pass aria-label`,
      )
    }
  })
  const ctx: Ctx = {
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
  }
  const props = mergeProps({ ...normalizeProps(api.root()), ref: composeRefs(el, ref) }, rest)
  return (
    <ControlContext value={ctx}>
      {renderPart("div", { ...props, children }, render, {
        value: current,
        disabled: groupDisabled,
      })}
    </ControlContext>
  )
}

type PartProps<
  T extends keyof React.JSX.IntrinsicElements,
  S = undefined,
> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<S>
}

function Label({ render, ...rest }: PartProps<"span">) {
  const ctx = useControl("Label")
  useRegisterPart(ctx.parts, "label", ctx.ids.label)
  const props = mergeProps(normalizeProps(ctx.api.label()), rest)
  // Not a <label>: a radiogroup is not labelable.
  return renderPart("span", props, render, undefined)
}

export interface SegmentState {
  readonly checked: boolean
  readonly disabled: boolean
}

export type SegmentedControlItemProps = Omit<PartProps<"button", SegmentState>, "value"> & {
  /** The segment's value: what the control's value and the form submit. */
  readonly value: string
  /** Disables this segment: it cannot be checked. */
  readonly disabled?: boolean
  /** The text for the collection (defaults to the segment's text content). */
  readonly textValue?: string
}

function Item({
  value,
  disabled = false,
  textValue,
  render,
  ref,
  ...rest
}: SegmentedControlItemProps) {
  const ctx = useControl("Item")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const key = toKey(value)
  const el = useRef<HTMLElement | null>(null)
  useRegisterItem(ctx.registry, { key: value, textValue, disabled }, el)
  const tag = useRenderedTag("button", render, el)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const isDisabled = () => ctx.disabled || disabled
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PRESS", key, modality: e.modality })
    },
    disabled: isDisabled,
  })
  const hover = useHover({ env, send: () => {}, disabled: isDisabled })
  const inputEl = useRef<HTMLInputElement | null>(null)
  const checked = ctx.value === key
  const formInput: FormInputCapability = useMemo(
    () => hiddenFormInput({ input: () => inputEl.current, control: () => el.current }, env),
    [env],
  )
  // After every commit: the input mirrors the value; the newly checked one, after a user
  // change, dispatches input + change (programmatic changes stay silent).
  const latest = useRef(checked)
  latest.current = checked
  const { pending } = ctx
  useIsoLayoutEffect(() => {
    const dispatch = checked && pending.current === key
    formInput.sync({ checked }, { dispatch })
    if (dispatch) pending.current = null
  })
  useEffect(
    () =>
      formInput.track({
        onReset: () => {},
        current: () => ({ checked: latest.current }),
        // The control answers the reset once; each input only re-syncs.
        resetsWithForm: false,
      }),
    [formInput],
  )
  // Development: a segment needs a name (text content or aria-label).
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    const named =
      (node.textContent ?? "").trim() !== "" ||
      node.getAttribute("aria-label") ||
      node.getAttribute("aria-labelledby")
    if (!named) {
      console.warn(
        `[rind-ui] segmented-control: the item "${value}" has no text and no aria-label; an icon-only segment needs aria-label`,
      )
    }
  })
  const own = normalizeProps(
    ctx.api.item(key, {
      tag,
      focused,
      modality,
      pressed: press.pressed,
      hovered: hover.hovered,
      itemDisabled: disabled,
    }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(
        own,
        {
          // Enter submits the form (implicit submission); it never selects.
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
            implicitSubmit(inputEl.current?.form ?? null)
          },
        },
        press.props,
        hover.props,
        { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
      ),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return (
    <>
      {renderPart("button", props, render, { checked, disabled: isDisabled() })}
      {/* A sibling of the segment, never inside it (reka-ui#1597). */}
      <input {...normalizeProps(ctx.api.hiddenInput(key, { disabled }))} ref={inputEl} />
    </>
  )
}

export type SegmentedControlIndicatorProps = PartProps<"span", { readonly visible: boolean }>

function Indicator({ render, ref, ...rest }: SegmentedControlIndicatorProps) {
  const ctx = useControl("Indicator")
  const el = useRef<HTMLElement | null>(null)
  const { send, instance } = ctx
  useSelectionIndicator({
    el,
    selectedId: ctx.value === null ? null : ctx.ids.item(toKey(ctx.value)),
    itemSelector: `[data-part="item"][data-instance="${instance}"]`,
    collection: ctx.collection,
    onMeasure: (box, cause) => send({ type: "INDICATOR.MEASURE", box, cause }),
  })
  const props = mergeProps(
    { ...normalizeProps(ctx.api.indicator()), ref: composeRefs(el, ref) },
    rest,
  )
  return renderPart("span", props, render, { visible: props["data-state"] === "visible" })
}

/** The parts, by name: `segmented-control.parts.ts` re-exports them as the `SegmentedControl` namespace. */
export { Indicator, Item, Label, Root }
