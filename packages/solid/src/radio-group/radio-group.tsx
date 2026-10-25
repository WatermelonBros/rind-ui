/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  focusSafely,
  hiddenFormInput,
  type ItemRegistry,
  implicitSubmit,
  isImeKey,
  layoutCapability,
  mergeFieldProps,
  type RadioGroupEvent,
  type RadioNaming,
  radioGroupConnect,
  radioGroupIds,
  radioGroupMachine,
  radioPartName,
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
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useCompositeHost, useHostItem } from "../composite-host"
import { useFieldControl } from "../field/context"
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

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

type GroupPart = "label" | "description" | "error-message"

interface Ctx {
  readonly api: (pendingStop?: string | null) => ReturnType<typeof radioGroupConnect>
  readonly send: (event: RadioGroupEvent) => void
  readonly registry: ItemRegistry
  readonly parts: PartRegistry<GroupPart>
  readonly ids: Accessor<ReturnType<typeof radioGroupIds>>
  readonly value: Accessor<string | null>
  readonly disabled: Accessor<boolean>
  readonly inField: boolean
  readonly invalid: Accessor<boolean>
  /** A user change waiting for its commit: that item's input dispatches input + change. */
  readonly pending: { current: string | null }
  readonly focusableWhenDisabled: Accessor<boolean>
  /** Hosted by a Toolbar: Enter checks (APG toolbar) and never submits. */
  readonly hosted: boolean
  readonly stop: ReturnType<typeof declaredStop>
}
const GroupContext = createContext<Ctx>()
/**
 * Internal (not exported from the package): set by a component that renders a Radio Group as
 * its part (Color Picker's swatch group): the host's scope and part names.
 */
export const RadioGroupNamingContext = createContext<RadioNaming | null>(null)
function useGroup(part: string): Ctx {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error(`RadioGroup.${part} must be inside RadioGroup.Root`)
  return ctx
}

interface ItemCtx {
  readonly key: Accessor<CollectionKey>
  readonly disabled: Accessor<boolean>
  readonly controlTag: Accessor<string>
  readonly setControlTag: (tag: string) => void
  readonly labelRendered: Accessor<boolean>
  readonly setLabelRendered: (on: boolean) => void
  readonly descriptionRendered: Accessor<boolean>
  readonly setDescriptionRendered: (on: boolean) => void
  readonly inputEl: Accessor<HTMLInputElement | null>
  readonly controlEl: Accessor<Element | null>
  readonly setControlEl: (el: Element | null) => void
  /** This item's view of the server tab stop (read once, in document order). */
  readonly pendingStop: string | null
}
const ItemContext = createContext<ItemCtx>()
function useItem(part: string): ItemCtx {
  const ctx = useContext(ItemContext)
  if (!ctx) throw new Error(`RadioGroup.${part} must be inside RadioGroup.Item`)
  return ctx
}

export interface RadioGroupState {
  readonly value: string | null
  readonly disabled: boolean
}
export interface RadioItemState {
  readonly checked: boolean
  readonly disabled: boolean
}

export type RadioGroupRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "id"
> & {
  /** Controlled value. */
  readonly value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((value: string | null, details: ChangeDetails<RadioGroupEvent>) => void)
    | undefined
  /** Only `aria-orientation` and `data-orientation`: every arrow key moves. */
  readonly orientation?: "vertical" | "horizontal" | undefined
  /** Disables every radio. */
  readonly disabled?: boolean | undefined
  /** A disabled group stays discoverable: the root is one tab stop. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Navigable, never changes. */
  readonly readOnly?: boolean | undefined
  /** Valid with one radio checked. */
  readonly required?: boolean | undefined
  /** Marks the group invalid; shows the ErrorMessage. */
  readonly invalid?: boolean | undefined
  /** Default: derived from the root id (two groups never form one browser group). */
  readonly name?: string | undefined
  /** The id of the form the hidden inputs belong to. */
  readonly form?: string | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<RadioGroupState> | undefined
  readonly children?: JSX.Element | ((state: RadioGroupState) => JSX.Element)
}

function Root(props: RadioGroupRootProps) {
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
  const naming = useContext(RadioGroupNamingContext)
  const ids = createMemo(() =>
    naming ? radioGroupIds(instance(), naming) : radioGroupIds(instance()),
  )
  // The parts the effects below look up, under a host's names when the group is its part.
  const hiddenPart = naming ? radioPartName(naming, "hidden-input") : "hidden-input"
  const controlPart = naming?.control ?? "item-control"
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  // Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
  const host = useCompositeHost()
  const focusableWhenDisabled = () =>
    local.focusableWhenDisabled ?? host?.focusableWhenDisabled ?? false
  const ariaLabel = () => local["aria-label"]
  const field = createMemo(() =>
    mergeFieldProps(
      {
        role: "radiogroup",
        labelable: false,
        disabled:
          local.disabled === true || fieldsetContext() || fieldsetDom() || host?.disabled === true,
        readOnly: local.readOnly === true,
        required: local.required === true,
        invalid: local.invalid === true,
        name: local.name,
        ariaLabel: ariaLabel(),
      },
      binding?.() ?? null,
    ),
  )
  const { collection: registered, registry } = useCollectionItems()
  const collection = () => registered() ?? EMPTY
  const pending = { current: null as string | null }
  // The reason of the latest accepted change, for the Field: only a user's clears its
  // external (server) errors (base-ui#1745); a parent's value or a reset does not.
  let lastReason: string | null = null
  const { view, send } = useMachine(
    radioGroupMachine,
    () => ({
      collection: collection(),
      strategy: "roving" as const,
      ids: ids(),
      loop: true,
      selectionMode: "single" as const,
      focusableWhenDisabled: focusableWhenDisabled(),
      value: local.value,
      defaultValue: local.defaultValue,
      // A user change (an arrow or a press) is dispatched on that item's input after commit.
      onValueChange: (next: string | null, details: ChangeDetails<RadioGroupEvent>) => {
        lastReason = details.reason
        if (details.reason === "NAVIGATE" || details.reason === "PRESS") pending.current = next
        local.onValueChange?.(next, details)
      },
      disabled: field().disabled,
      readOnly: field().readOnly,
    }),
    env,
  )
  const current = (): string | null => view().values.value ?? null
  // The Label is expected unless something else names the group: the server HTML then
  // already labels the root (base-ui#5597).
  const parts = usePartRegistry<GroupPart>({
    scope: "radio-group",
    root: instance(),
    ...(ariaLabel() === undefined && binding === null ? { expected: ["label"] as const } : {}),
  })
  const rendered = {
    label: useRenderedId(parts, "label"),
    description: useRenderedId(parts, "description"),
    errorMessage: useRenderedId(parts, "error-message"),
  }
  const api = (pendingStop: string | null = null) =>
    radioGroupConnect(
      {
        instance: instance(),
        ...(naming ? { naming } : {}),
        collection: collection(),
        value: current(),
        highlightedKey: view().context.highlightedKey,
        highlightSource: view().context.highlightSource,
        pending: registered() === null,
        pendingStop,
        orientation: local.orientation ?? "vertical",
        disabled: field().disabled,
        focusableWhenDisabled: focusableWhenDisabled(),
        readOnly: field().readOnly,
        required: field().required || field()["aria-required"] === "true",
        invalid: field().invalid,
        name: field().name,
        form: local.form,
        rendered: {
          label: rendered.label(),
          description: rendered.description(),
          errorMessage: rendered.errorMessage(),
        },
        ...(binding ? { field: binding().ids } : {}),
        ariaLabel: ariaLabel(),
        hosted: host !== null,
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
    // A form reset is answered once, by the group (every item's input re-syncs).
    const doc = node.ownerDocument
    const onReset = (e: Event) => {
      if (e.defaultPrevented) return
      const input = node.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`)
      if (input && e.target === input.form) send({ type: "RESET" })
    }
    doc.addEventListener("reset", onReset)
    onCleanup(() => {
      w.stop()
      doc.removeEventListener("reset", onReset)
    })
    // field-control: the group registers once as one (non-labelable) control.
    if (binding) {
      const radios = () =>
        Array.from(
          el()?.querySelectorAll<HTMLElement>(
            `[data-part="${controlPart}"][data-instance="${instance()}"]`,
          ) ?? [],
        )
      const off = untrack(() =>
        binding().register(
          {
            id: instance(),
            labelable: false,
            // The checked radio, else the first enabled one (react-spectrum#3883).
            focus: (modality) => {
              const all = radios()
              const target =
                all.find((r) => r.getAttribute("aria-checked") === "true") ??
                all.find(
                  (r) => r.getAttribute("aria-disabled") !== "true" && !r.hasAttribute("disabled"),
                )
              if (target) void focusSafely(target, env, "programmatic", modality)
            },
            validityElement: () =>
              el()?.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`) ?? null,
            value: () => untrack(current),
          },
          instance(),
        ),
      )
      onCleanup(off)
    }
    let reported = untrack(current)
    createEffect(() => {
      const now = current()
      if (reported === now) return
      reported = now
      const user = lastReason === "NAVIGATE" || lastReason === "PRESS"
      lastReason = null
      untrack(() => {
        binding?.().report({ type: "change", value: now, user, composing: false })
        binding?.().report({ type: "commit" })
      })
    })
    // After the items' updates: a proposal the parent refused never dispatches later.
    createEffect(() => {
      const now = current()
      if (pending.current !== null && pending.current !== now) pending.current = null
    })
    // Development: a radiogroup needs a name. Checked after the update a Label's or a Field's
    // registration causes, not on the first mount.
    if (process.env.NODE_ENV !== "production") {
      createEffect(() => {
        rendered.label()
        ariaLabel()
        queueMicrotask(() => {
          if (!node.isConnected) return
          if (!node.getAttribute("aria-labelledby") && !node.getAttribute("aria-label")) {
            console.warn(
              `[rind-ui] radio-group: #${node.id} has no accessible name; render RadioGroup.Label or pass aria-label`,
            )
          }
        })
      })
    }
  })
  const state = reactive<RadioGroupState>(() => ({
    value: current(),
    disabled: field().disabled,
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps({ ...api().root(), ...binding?.().data }),
        ...(ariaLabel() === undefined ? {} : { "aria-label": ariaLabel() }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <GroupContext.Provider
      value={{
        api,
        send,
        registry,
        parts,
        ids,
        value: current,
        disabled: () => field().disabled,
        inField: binding !== null,
        invalid: () => field().invalid,
        pending,
        focusableWhenDisabled,
        hosted: host !== null,
        stop: declaredStop(),
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </GroupContext.Provider>
  )
}

type PartProps<A, S = undefined> = Omit<A, "children"> & {
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

/** Not a <label>: a radiogroup is not labelable. */
function Label(props: PartProps<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("Label")
  useRegisterPart(ctx.parts, "label", () => ctx.ids().label)
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().label()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function Description(props: PartProps<JSX.HTMLAttributes<HTMLParagraphElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("Description")
  useRegisterPart(ctx.parts, "description", () => ctx.ids().description)
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().description()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => <p {...p}>{children()}</p>)
}

function ErrorMessage(props: PartProps<JSX.HTMLAttributes<HTMLParagraphElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("ErrorMessage")
  // Inside a Field the Field's ErrorMessage is the one; shown only while invalid.
  const shown = () => !ctx.inField && ctx.invalid()
  useRegisterPart(ctx.parts, "error-message", () => (shown() ? ctx.ids().errorMessage : undefined))
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().errorMessage()), rest))
  const children = () => local.children
  return (
    <Show when={shown()}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <p {...p}>{children()}</p>
      ))}
    </Show>
  )
}

type ItemPartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<RadioItemState> | undefined
  readonly children?: JSX.Element | ((state: RadioItemState) => JSX.Element)
}

export type RadioGroupItemProps = ItemPartProps<Omit<JSX.HTMLAttributes<HTMLDivElement>, "id">> & {
  /** The item's value: what the group's value and the form submit. */
  readonly value: string
  /** Disables this radio only. */
  readonly disabled?: boolean | undefined
  /** The text for the collection (defaults to the item's text content). */
  readonly textValue?: string | undefined
}

function Item(props: RadioGroupItemProps) {
  const [local, rest] = splitProps(props, ["value", "disabled", "textValue", "render", "children"])
  const ctx = useGroup("Item")
  const env = useEnvironment()
  const key = (): CollectionKey => toKey(local.value)
  const [el, setEl] = createSignal<Element | null>(null)
  useRegisterItem(
    ctx.registry,
    () => ({ key: local.value, textValue: local.textValue, disabled: local.disabled === true }),
    el,
  )
  const [controlTag, setControlTag] = createSignal("button")
  const [labelRendered, setLabelRendered] = createSignal(false)
  const [descriptionRendered, setDescriptionRendered] = createSignal(false)
  const [inputEl, setInputEl] = createSignal<HTMLInputElement | null>(null)
  const [controlEl, setControlEl] = createSignal<Element | null>(null)
  const checked = () => ctx.value() === key()
  const ownDisabled = () => local.disabled === true
  const formInput = hiddenFormInput(
    { input: () => inputEl(), control: () => controlEl() as HTMLElement | null },
    env,
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
    onCleanup(
      formInput.track({
        onReset: () => {},
        current: () => ({ checked: untrack(checked) }),
        // The group answers the reset once; each input only re-syncs.
        resetsWithForm: false,
      }),
    )
  })
  const item: ItemCtx = {
    key,
    disabled: ownDisabled,
    controlTag,
    setControlTag,
    labelRendered,
    setLabelRendered,
    descriptionRendered,
    setDescriptionRendered,
    inputEl,
    controlEl,
    setControlEl,
    pendingStop: ctx.stop(
      local.value,
      ctx.disabled() || ownDisabled(),
      ctx.value() === null ? [] : [ctx.value() as string],
    ),
  }
  const state = reactive<RadioItemState>(() => ({
    checked: checked(),
    disabled: ctx.disabled() || ownDisabled(),
  }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(ctx.api().item(key(), { disabled: ownDisabled() })), ref: setEl },
      rest,
    ),
  )
  const children = (): JSX.Element => (
    <>
      {resolveChildren(local.children, state)}
      {/* A sibling of the control, never inside it (reka-ui#1597). */}
      <input
        {...normalizeProps(ctx.api().hiddenInput(key(), { disabled: ownDisabled() }))}
        ref={setInputEl}
      />
    </>
  )
  return (
    <ItemContext.Provider value={item}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ItemContext.Provider>
  )
}

function ItemControl(props: ItemPartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("ItemControl")
  const item = useItem("ItemControl")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() => createEffect(() => item.setControlTag(el()?.tagName.toLowerCase() ?? "button")))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const disabled = () => ctx.disabled() || item.disabled()
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PRESS", key: item.key(), modality: e.modality })
    },
    disabled,
  })
  const hover = useHover({ env, send: () => {}, disabled })
  // Hosted: the radio is also one of the host's controls (navigation and tab stop).
  const host = useCompositeHost()
  const hostKey = () => ctx.ids().item(item.key())
  useHostItem(
    host,
    // The toolbar has no typeahead: the value is enough to name the registration.
    () => ({
      id: hostKey(),
      skip: disabled() && !ctx.focusableWhenDisabled(),
      textValue: item.key(),
    }),
    el,
  )
  const own = createMemo(() => {
    const tag = item.controlTag()
    return normalizeProps(
      ctx.api(item.pendingStop).itemControl(item.key(), {
        tag,
        focused: focused(),
        modality: modality(),
        pressed: press.pressed(),
        hovered: hover.hovered(),
        itemDisabled: item.disabled(),
        labelable: tag === "button" || tag === "input",
        labelRendered: item.labelRendered(),
        descriptionRendered: item.descriptionRendered(),
      }),
    )
  })
  const hostProps = () =>
    host
      ? normalizeProps(
          host.itemProps({
            id: hostKey(),
            disabled: disabled(),
            first: host.claimFirst(hostKey()),
          }),
        )
      : {}
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          own(),
          hostProps(),
          {
            // Enter submits the form (implicit submission) and never checks; hosted by a
            // toolbar, Enter checks like Space (APG toolbar example) and never submits.
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
              if (!ctx.hosted) {
                implicitSubmit(item.inputEl()?.form ?? null)
                return
              }
              e.preventDefault()
              if (!disabled() && !e.repeat)
                ctx.send({ type: "PRESS", key: item.key(), modality: "keyboard" })
            },
          },
          press.props,
          hover.props,
          { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
        ),
        ref: (node: Element) => {
          setEl(node)
          item.setControlEl(node)
        },
      },
      rest,
    ),
  )
  const state = reactive<RadioItemState>(() => ({
    checked: ctx.value() === item.key(),
    disabled: disabled(),
  }))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** Mounted only while checked. */
function ItemIndicator(props: ItemPartProps<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("ItemIndicator")
  const item = useItem("ItemIndicator")
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(ctx.api().itemIndicator(item.key(), { disabled: item.disabled() })),
      rest,
    ),
  )
  const state = reactive<RadioItemState>(() => ({ checked: true, disabled: item.disabled() }))
  const children = () => resolveChildren(local.children, state)
  return (
    <Show when={ctx.value() === item.key()}>
      {renderPart(local.render, merged, state, children, (p) => (
        <span {...p}>{children()}</span>
      ))}
    </Show>
  )
}

function ItemLabel(props: ItemPartProps<JSX.LabelHTMLAttributes<HTMLLabelElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("ItemLabel")
  const item = useItem("ItemLabel")
  afterMount(() => {
    item.setLabelRendered(true)
    onCleanup(() => item.setLabelRendered(false))
  })
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(
        ctx.api().itemLabel(item.key(), {
          disabled: item.disabled(),
          labelable: item.controlTag() === "button" || item.controlTag() === "input",
        }),
      ),
      rest,
    ),
  )
  const state = reactive<RadioItemState>(() => ({
    checked: ctx.value() === item.key(),
    disabled: item.disabled(),
  }))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: `for` names the Control
    <label {...p}>{children()}</label>
  ))
}

function ItemDescription(props: ItemPartProps<JSX.HTMLAttributes<HTMLParagraphElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useGroup("ItemDescription")
  const item = useItem("ItemDescription")
  afterMount(() => {
    item.setDescriptionRendered(true)
    onCleanup(() => item.setDescriptionRendered(false))
  })
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(ctx.api().itemDescription(item.key(), { disabled: item.disabled() })),
      rest,
    ),
  )
  const state = reactive<RadioItemState>(() => ({
    checked: ctx.value() === item.key(),
    disabled: item.disabled(),
  }))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <p {...p}>{children()}</p>)
}

/** The parts, by name: `radio-group.parts.ts` re-exports them as the `RadioGroup` namespace. */
export {
  Description,
  ErrorMessage,
  Item,
  ItemControl,
  ItemDescription,
  ItemIndicator,
  ItemLabel,
  Label,
  Root,
}
