/** @jsxImportSource solid-js */
// Select: Root (service, hidden form input), Label, Trigger, ValueText, Indicator,
// Description, Portal, Positioner, Content and the listbox parts bound to this host.
// Wiring only: the machine owns opening, value and highlight; the core parts own every
// attribute.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  domPositioning,
  focusSafely,
  getLayerStack,
  hiddenFormInput,
  type LayerMeta,
  layoutCapability,
  mergeFieldProps,
  type SelectOpenChangeDetails,
  type SelectValue,
  type Service,
  selectConnect,
  selectIds,
  selectionOf,
  selectLayerId,
  selectMachine,
  selectPositioning,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  type Accessor,
  createComputed,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldBindingPeek, useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { keepStyle } from "../keep-style"
import { LayerProvider, useParentLayer } from "../layer-context"
import { afterMount } from "../lifecycle"
import type { ListboxItemData } from "../listbox/listbox"
import { createListboxParts, type ListboxHost, type ListboxItemsProps } from "../listbox/parts"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare const process: { env: { NODE_ENV?: string } }

const fromData = (items: readonly ListboxItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])

/** `onValueChange`'s details: why the value changed. */
export interface SelectValueChangeDetails {
  readonly reason: "select" | "typeahead" | "reset" | "autofill"
}

const VALUE_REASON: Record<string, SelectValueChangeDetails["reason"]> = {
  SELECT: "select",
  TYPEAHEAD: "typeahead",
  "FORM.RESET": "reset",
  "FORM.AUTOFILL": "autofill",
}

/** What `actionsRef` exposes. */
export interface SelectActions {
  open(): void
  close(): void
}

type Common = {
  /** The base the parts' ids derive from. Default: generated. */
  readonly id?: string | undefined
  /** The select's parts (Label, Trigger, Positioner, …). */
  readonly children?: JSX.Element
  /** Data items: the value text needs no option mounted (a closed select mounts none). */
  readonly items?: readonly ListboxItemData[] | undefined
  /** A collection built by the consumer (virtualized lists). */
  readonly collection?: Collection<unknown> | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: SelectOpenChangeDetails) => void) | undefined
  /** Default true. */
  readonly modal?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** A disabled trigger stays focusable (`aria-disabled`), and disabled options stay navigable. */
  readonly focusableWhenDisabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  readonly name?: string | undefined
  readonly form?: string | undefined
  readonly autoComplete?: string | undefined
  /** Shown while nothing is selected. */
  readonly placeholder?: string | undefined
  /** Default false (a native select does not wrap). */
  readonly loop?: boolean | undefined
  readonly typeaheadTimeout?: number | undefined
  readonly positioning?: Parameters<typeof selectPositioning>[0]["positioning"]
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** Receives `open()` and `close()` once, to drive the select imperatively. */
  readonly actionsRef?: ((actions: SelectActions) => void) | undefined
}

export type SelectRootProps = Common &
  (
    | {
        readonly multiple?: false | undefined
        readonly value?: string | null | undefined
        readonly defaultValue?: string | null | undefined
        readonly onValueChange?:
          | ((value: string | null, details: SelectValueChangeDetails) => void)
          | undefined
      }
    | {
        readonly multiple: true
        readonly value?: readonly string[] | undefined
        readonly defaultValue?: readonly string[] | undefined
        readonly onValueChange?:
          | ((value: readonly string[], details: SelectValueChangeDetails) => void)
          | undefined
      }
  )

interface Mounted {
  readonly label: boolean
  readonly description: boolean
  readonly list: boolean
  readonly empty: boolean
  readonly descriptions: ReadonlySet<CollectionKey>
}

interface Naming {
  readonly label?: string | undefined
  readonly labelledBy?: string | undefined
}

interface Ctx {
  readonly service: Service<typeof selectMachine>
  readonly view: Accessor<ReturnType<Service<typeof selectMachine>["view"]>>
  readonly instance: Accessor<string>
  readonly collection: Accessor<Collection<unknown>>
  readonly registry: ReturnType<typeof useCollectionItems>["registry"] | null
  readonly multiple: Accessor<boolean>
  readonly modal: Accessor<boolean>
  readonly disabled: Accessor<boolean>
  readonly readOnly: Accessor<boolean>
  readonly required: Accessor<boolean>
  readonly invalid: Accessor<boolean>
  readonly placeholder: Accessor<string | undefined>
  readonly keepMounted: Accessor<boolean>
  readonly focusableWhenDisabled: Accessor<boolean>
  readonly typeaheadTimeout: Accessor<number>
  readonly positioning: Accessor<Common["positioning"]>
  readonly trigger: Accessor<HTMLElement | null>
  readonly setTrigger: (el: HTMLElement | null) => void
  readonly setLabel: (el: HTMLElement | null) => void
  readonly hidden: Accessor<HTMLInputElement | null>
  readonly setHidden: (el: HTMLInputElement | null) => void
  readonly mounted: Accessor<Mounted>
  readonly setMounted: (part: "label" | "description" | "list" | "empty", on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  /** The trigger's consumer naming (the list copies `aria-label`). */
  readonly naming: Accessor<Naming>
  readonly setNaming: (naming: Naming) => void
  readonly meta: Accessor<LayerMeta | undefined>
  readonly name: Accessor<string | undefined>
  readonly form: Accessor<string | undefined>
  readonly autoComplete: Accessor<string | undefined>
}

const SelectContext = createContext<Ctx>()
function useSelect(part: string): Ctx {
  const ctx = useContext(SelectContext)
  if (!ctx) throw new Error(`Select.${part} must be inside Select.Root`)
  return ctx
}

const listFormatter = (locale: string) => {
  const f = new Intl.ListFormat(locale, { style: "long", type: "conjunction" })
  return (texts: readonly string[]) => f.format(texts)
}

/** The connect output of a part (read in a computation). */
function useApi(
  ctx: Ctx,
  extra: Accessor<{ dir?: "ltr" | "rtl" | undefined; listFocused?: boolean }> = () => ({}),
) {
  const env = useEnvironment()
  const modality = useModality(env.modality, () => extra().listFocused === true)
  return createMemo(() => {
    const view = ctx.view()
    const m = ctx.mounted()
    const e = extra()
    return selectConnect(
      {
        instance: ctx.instance(),
        open: view.matches("open"),
        collection: ctx.collection(),
        selection: selectionOf(view.values.value),
        multiple: ctx.multiple(),
        highlightedKey: view.context.highlightedKey,
        highlightSource: view.context.highlightSource,
        typingAhead: () => {
          const t = ctx.service.getSnapshot().context.typeahead
          return t.buffer !== "" && env.clock.now() - t.at <= ctx.typeaheadTimeout()
        },
        placement: view.context.placement,
        closeReason: view.context.closeReason,
        modal: ctx.modal(),
        disabled: ctx.disabled(),
        readOnly: ctx.readOnly(),
        required: ctx.required(),
        invalid: ctx.invalid(),
        autofilled: view.context.autofilled,
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        texts: view.context.texts,
        placeholder: ctx.placeholder(),
        listFormat: listFormatter(env.locale.locale()),
        mounted: {
          label: m.label,
          description: m.description,
          list: m.list,
          empty: m.empty,
          itemDescription: (key) => m.descriptions.has(key),
        },
        meta: ctx.meta(),
        manual: selectPositioning({ positioning: ctx.positioning() }).mode === "manual",
        listFocused: e.listFocused === true,
        modality: modality(),
        ...(e.dir ? { dir: e.dir } : {}),
      },
      ctx.service.send,
      env,
    )
  })
}

function Root(all: SelectRootProps) {
  // Read through accessors: the selection variants share no static shape.
  const p = all as Record<string, unknown> & Common
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(() => p.id)
  const parent = useParentLayer()
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const multiple = () => p["multiple"] === true
  const field = createMemo(() =>
    mergeFieldProps(
      {
        role: "combobox",
        labelable: true,
        disabled: p.disabled,
        readOnly: p.readOnly,
        required: p.required,
        invalid: p.invalid,
        ...(p.name === undefined ? {} : { name: p.name }),
      },
      enclosing?.() ?? null,
    ),
  )
  // A native <fieldset disabled> around the trigger, not only rind's Fieldset (radix#2417).
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const disabled = () => field().disabled || fieldsetDisabled() || fieldsetDom()
  const { collection: registered, registry } = useCollectionItems()
  const data = createMemo(() => (p.items ? fromData(p.items) : null))
  const collection = createMemo(() => p.collection ?? data() ?? registered() ?? EMPTY)
  const ids = createMemo(() => {
    const s = selectIds(instance())
    return { list: s.list, item: s.item }
  })
  const [trigger, setTrigger] = createSignal<HTMLElement | null>(null)
  const [label, setLabel] = createSignal<HTMLElement | null>(null)
  const [hidden, setHidden] = createSignal<HTMLInputElement | null>(null)
  const formInput = hiddenFormInput({ input: hidden, control: trigger }, env)
  const machineEnv = { ...env, position: domPositioning(env) }
  // A user change dispatches input + change from the hidden input after it commits.
  let userChange = false
  const { view, service, send } = useMachine(
    selectMachine,
    () => ({
      collection: collection(),
      ids: ids(),
      strategy: "roving" as const,
      selectionMode: multiple() ? ("multiple" as const) : ("single" as const),
      selectionBehavior: "toggle" as const,
      loop: p.loop ?? false,
      focusableWhenDisabled: p.focusableWhenDisabled ?? false,
      typeaheadTimeout: p.typeaheadTimeout ?? 1000,
      ...("value" in all ? { value: p["value"] as SelectValue } : {}),
      defaultValue: (p["defaultValue"] as SelectValue | undefined) ?? (multiple() ? [] : null),
      onValueChange: (v: SelectValue, details: { event: { type: string } }) => {
        const reason = VALUE_REASON[details.event.type] ?? "select"
        if (reason !== "reset") userChange = true
        ;(p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined)?.(v, { reason })
      },
      ...("open" in all ? { open: p.open } : {}),
      defaultOpen: p.defaultOpen,
      onOpenChange: (o: boolean, d: SelectOpenChangeDetails) => p.onOpenChange?.(o, d),
      modal: p.modal ?? true,
      disabled: disabled(),
      readOnly: field().readOnly,
      positioning: p.positioning,
      root: instance(),
      parent: parent(),
      getTrigger: () => untrack(trigger),
      getLabel: () => untrack(label),
    }),
    machineEnv,
  )
  p.actionsRef?.({ open: () => send({ type: "OPEN" }), close: () => send({ type: "CLOSE" }) })
  const [mounted, setMountedState] = createSignal<Mounted>({
    label: false,
    description: false,
    list: false,
    empty: false,
    descriptions: new Set(),
  })
  const setMounted = (part: "label" | "description" | "list" | "empty", on: boolean) =>
    setMountedState((m) => (m[part] === on ? m : { ...m, [part]: on }))
  const mountDescription = (key: CollectionKey, on: boolean) =>
    setMountedState((m) => {
      if (m.descriptions.has(key) === on) return m
      const next = new Set(m.descriptions)
      if (on) next.add(key)
      else next.delete(key)
      return { ...m, descriptions: next }
    })
  const [naming, setNaming] = createSignal<Naming>(
    {},
    { equals: (a, b) => a.label === b.label && a.labelledBy === b.labelledBy },
  )
  // The stack's metadata for this layer, followed while open.
  const [meta, setMeta] = createSignal<LayerMeta | undefined>(undefined)
  const isOpen = createMemo(() => view().matches("open"))
  createEffect(() => {
    const node = trigger()
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    onCleanup(watch.stop)
  })
  afterMount(() => {
    createEffect(() => {
      setMeta(undefined)
      if (!isOpen()) return
      const node = env.dom.getRootNode()
      const stack = getLayerStack("body" in node ? node : node.ownerDocument)
      const read = () => setMeta(stack.get(selectLayerId(untrack(instance)))?.meta())
      read()
      onCleanup(stack.subscribe(read))
    })
  })
  const ctx: Ctx = {
    service,
    view,
    instance,
    collection,
    registry: p.collection || p.items ? null : registry,
    multiple,
    modal: () => p.modal ?? true,
    disabled,
    readOnly: () => field().readOnly,
    required: () => field().required,
    invalid: () => field().invalid,
    placeholder: () => p.placeholder,
    keepMounted: () => p.keepMounted === true,
    focusableWhenDisabled: () => p.focusableWhenDisabled ?? false,
    typeaheadTimeout: () => p.typeaheadTimeout ?? 1000,
    positioning: () => p.positioning,
    trigger,
    setTrigger,
    setLabel,
    hidden,
    setHidden,
    mounted,
    setMounted,
    mountDescription,
    naming,
    setNaming,
    meta,
    name: () => field().name,
    form: () => p.form,
    autoComplete: () => p.autoComplete,
  }
  const consumeUserChange = () => {
    const dispatch = userChange
    userChange = false
    return dispatch
  }
  return (
    <SelectContext.Provider value={ctx}>
      {p.children}
      <HiddenInputs formInput={formInput} consumeUserChange={consumeUserChange} />
    </SelectContext.Provider>
  )
}

/** The form's view of the value: one key (single) or the constraint plus value carriers. */
function HiddenInputs(props: {
  readonly formInput: ReturnType<typeof hiddenFormInput>
  readonly consumeUserChange: () => boolean
}) {
  const ctx = useSelect("Root")
  const api = useApi(ctx)
  const list = createMemo(() => {
    const keys = selectionOf(ctx.view().values.value)
    return keys === "all" ? [] : [...keys]
  })
  const mirror = () => ({
    value: ctx.multiple() ? (list().length > 0 ? "x" : "") : (list()[0] ?? ""),
  })
  afterMount(() => {
    // After every change: the input shows the value; a user change also fires input + change.
    createEffect(() => {
      ctx.hidden()
      const mirrored = mirror()
      props.formInput.sync(mirrored, { dispatch: props.consumeUserChange() })
    })
    onCleanup(
      props.formInput.track({
        onReset: () => ctx.service.send({ type: "FORM.RESET" }),
        current: () => untrack(mirror),
        onNativeInput: (input) => {
          ctx.service.send({ type: "FORM.AUTOFILL", text: input.value })
          // Re-sync either way: an unmatched text (or a multiple select) leaves the machine as it
          // was, and the input must not keep what the browser wrote (select spec "Browser Autofill").
          return false
        },
      }),
    )
  })
  const hiddenProps = createMemo(() =>
    normalizeProps(
      api().hiddenInput({ name: ctx.name(), form: ctx.form(), autoComplete: ctx.autoComplete() }),
    ),
  )
  return (
    <>
      <input {...hiddenProps()} ref={ctx.setHidden} />
      <Show when={ctx.multiple() && ctx.name()}>
        <For each={list()}>
          {(k) => (
            <input
              {...normalizeProps(api().hiddenValue(k, { name: ctx.name(), form: ctx.form() }))}
            />
          )}
        </For>
      </Show>
    </>
  )
}

type Own<A, S = undefined> = Omit<A, "children"> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

function Label(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSelect("Label")
  const api = useApi(ctx)
  createEffect(() => {
    ctx.setMounted("label", true)
    onCleanup(() => ctx.setMounted("label", false))
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().label()),
        ref: (node: Element) => ctx.setLabel(node as HTMLElement),
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export interface SelectTriggerState {
  readonly open: boolean
  readonly placeholder: boolean
}

export type SelectTriggerProps = Own<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  SelectTriggerState
>

function Trigger(props: SelectTriggerProps) {
  const [local, rest] = splitProps(props, [
    "render",
    "children",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
  ])
  const ctx = useSelect("Trigger")
  const api = useApi(ctx)
  const env = useEnvironment()
  const open = () => ctx.view().matches("open")
  // The modality tracker needs a subscriber while the trigger is mounted.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  createComputed(() =>
    ctx.setNaming({ label: local["aria-label"], labelledBy: local["aria-labelledby"] }),
  )
  const binding = useFieldControl()
  const controlId = createMemo(() => selectIds(ctx.instance()).trigger)
  afterMount(() => {
    if (!binding) return
    createEffect(() => {
      const id = controlId()
      onCleanup(
        untrack(() =>
          binding().register(
            {
              id,
              labelable: true,
              focus: (m) => {
                const node = ctx.trigger()
                if (node) void focusSafely(node, env, "programmatic", m)
              },
              validityElement: () => ctx.hidden(),
              value: () => ctx.service.view().values.value ?? null,
            },
            id,
          ),
        ),
      )
    })
  })
  // Each change and each close (a commit) reported to the Field once.
  const value = createMemo(() => JSON.stringify(ctx.view().values.value ?? null))
  afterMount(() => {
    let reported = untrack(value)
    createEffect(() => {
      const v = value()
      if (reported === v) return
      reported = v
      untrack(() =>
        binding?.().report({ type: "change", value: JSON.parse(v), user: true, composing: false }),
      )
    })
    let wasOpen = untrack(open)
    createEffect(() => {
      const o = open()
      if (wasOpen && !o) untrack(() => binding?.().report({ type: "commit" }))
      wasOpen = o
    })
  })
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") untrack(api).pressTrigger(e.modality)
    },
    disabled: () => ctx.disabled(),
    // A label's forwarded click focuses the trigger and never opens the popup.
    labelActivation: "focus",
  })
  const [el, setEl] = createSignal<Element | null>(null)
  // Development: a trigger needs a name (it is never named by its value). Checked once, a
  // frame after mount: the Label registers on mount and the trigger's aria-labelledby follows.
  afterMount(() => {
    if (process.env.NODE_ENV === "production") return
    const frame = env.scheduler.requestAnimationFrame(() => {
      const node = el()
      if (!node) return
      const named =
        node.hasAttribute("aria-label") ||
        node.hasAttribute("aria-labelledby") ||
        node.closest("label") !== null ||
        ((node as HTMLButtonElement).labels?.length ?? 0) > 0
      if (!named)
        console.warn(
          `[rind-ui] select #${node.id}: the trigger has no accessible name; render Select.Label or pass aria-label`,
        )
    })
    onCleanup(() => env.scheduler.cancelAnimationFrame(frame))
  })
  const tag = useRenderedTag(
    () => "button",
    () => local.render,
    el,
  )
  const state = reactive<SelectTriggerState>(() => ({
    open: open(),
    placeholder: api().placeholder,
  }))
  const merged = createMemo(() => {
    const own = normalizeProps(
      api().trigger({
        tag: tag(),
        focused: focused(),
        modality: modality(),
        pressed: press.pressed(),
        label: local["aria-label"],
        labelledBy: local["aria-labelledby"],
        describedBy: local["aria-describedby"],
      }),
    )
    const b = binding?.()
    const fieldAria = b
      ? mergeFieldProps(
          // Sound: the connect writes the trigger's id list as a string (or leaves it out).
          {
            role: "combobox",
            labelable: true,
            describedBy: own["aria-describedby"] as string | undefined,
          },
          b,
        )
      : null
    // Space continuing a search must not press the trigger (the trigger's handler acts first).
    const { onKeyDown: pressKeyDown, ...pressProps } = press.props as Record<
      string,
      ((e: KeyboardEvent) => void) | undefined
    >
    return mergeProps(
      {
        ...joinHandlers(own, pressProps, {
          onKeyDown: (e: KeyboardEvent) => {
            if (!e.defaultPrevented) pressKeyDown?.(e)
          },
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ...(fieldAria
          ? {
              "aria-describedby": fieldAria["aria-describedby"],
              "aria-required": own["aria-required"] ?? fieldAria["aria-required"],
            }
          : {}),
        ref: (node: Element) => {
          setEl(node)
          ctx.setTrigger(node as HTMLElement)
        },
      },
      rest,
    )
  })
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type SelectValueTextProps = Omit<Own<JSX.HTMLAttributes<HTMLSpanElement>>, "children"> & {
  /** Render the selected items yourself (an icon next to the text). */
  readonly children?: JSX.Element | ((selected: readonly string[]) => JSX.Element)
}

function ValueText(props: SelectValueTextProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSelect("ValueText")
  const api = useApi(ctx)
  const selected = createMemo(() => {
    const keys = selectionOf(ctx.view().values.value)
    return keys === "all" ? [] : [...keys]
  })
  const text = createMemo(() => api().valueTextContent())
  // A new node per value: WebKit re-reads a replaced node, not an updated one (zag#3099).
  const node = createMemo(() => {
    const t = text()
    return untrack(() => <span>{t}</span>)
  })
  const content = () => {
    const c = local.children
    if (typeof c === "function") return (c as (s: readonly string[]) => JSX.Element)(selected())
    return c ?? node()
  }
  const merged = createMemo(() => mergeProps(normalizeProps(api().valueText()), rest))
  return renderPart(local.render, merged, undefined, content, (p) => (
    <span {...p}>{content()}</span>
  ))
}

function Indicator(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSelect("Indicator")
  const api = useApi(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(api().indicator()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function Description(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSelect("Description")
  const api = useApi(ctx)
  createEffect(() => {
    ctx.setMounted("description", true)
    onCleanup(() => ctx.setMounted("description", false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(api().description()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The trigger's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: Ctx) {
  const [dir, setDir] = createSignal<"ltr" | "rtl" | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      if (!ctx.view().matches("open")) return
      const found = ctx.trigger()?.closest("[dir]")?.getAttribute("dir")
      setDir(found === "rtl" ? "rtl" : "ltr")
    })
  })
  return dir
}

function Positioner(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSelect("Positioner")
  const dir = useTriggerDir(ctx)
  const api = useApi(ctx, () => (dir() ? { dir: dir() } : {}))
  const open = () => ctx.view().matches("open")
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(open, node, { keepMounted: ctx.keepMounted, subtree: () => true })
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().positioner()), hidden: !open() && ctx.keepMounted(), ref: setNode },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  const children = () => local.children
  return (
    <Show when={presence.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

function Content(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSelect("Content")
  const api = useApi(ctx)
  const open = () => ctx.view().matches("open")
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(open, node, { keepMounted: ctx.keepMounted })
  const exiting = () => !open() && presence.state() === "exiting"
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().content()),
        hidden: !open() && !exiting() && ctx.keepMounted(),
        ...(exiting() ? { inert: true } : {}),
        ref: setNode,
      },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  const children = () => (
    <LayerProvider layer={selectLayerId(ctx.instance())} kind="listbox">
      {local.children}
    </LayerProvider>
  )
  return (
    <Show when={presence.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

function Portal(props: PortalProps) {
  const ctx = useSelect("Portal")
  return <PortalPart logicalParent={ctx.trigger} {...props} />
}

const HostContext = createContext<ListboxHost>()
function useSelectHost(part: string): ListboxHost {
  const host = useContext(HostContext)
  if (!host) throw new Error(`Select.${part} must be inside Select.List`)
  return host
}

/** Provides the listbox host to the parts below (the List and its items). */
function ListHost(props: { readonly children?: JSX.Element }) {
  const ctx = useSelect("List")
  // A Field's label names the list when the select renders no label of its own.
  const fieldLabel = useFieldBindingPeek()
  const [listFocused, setListFocused] = createSignal(false)
  const api = useApi(ctx, () => ({ listFocused: listFocused() }))
  // The list registers itself (aria-controls exists only while it is mounted).
  createEffect(() => {
    ctx.setMounted("list", true)
    onCleanup(() => ctx.setMounted("list", false))
  })
  const parts = createMemo(() => {
    const a = api()
    return {
      ...a.listbox,
      list: () => ({
        ...a.list({
          ...ctx.naming(),
          labelledBy: ctx.naming().labelledBy ?? fieldLabel?.().ids.label,
        }),
        onFocusIn: () => setListFocused(true),
        onFocusOut: () => setListFocused(false),
      }),
    }
  })
  const host: ListboxHost = {
    name: "Select",
    // Sound: the list override adds the focus handlers to the list part's props.
    parts: parts as unknown as ListboxHost["parts"],
    collection: ctx.collection,
    registry: ctx.registry,
    mount: (part, on) => ctx.setMounted(part, on),
    mountDescription: ctx.mountDescription,
    requestLoadMore: () => {},
  }
  return <HostContext.Provider value={host}>{props.children}</HostContext.Provider>
}

const listParts = createListboxParts(useSelectHost)

/** The list: it provides the host to its items. */
function List(props: Parameters<typeof listParts.List>[0]) {
  return (
    <ListHost>
      <listParts.List {...props} />
    </ListHost>
  )
}

const {
  Item,
  ItemText,
  ItemDescription,
  ItemIndicator,
  Section,
  Separator,
  Empty,
  LoadMore,
  Items,
} = listParts

export type { ListboxItemsProps as SelectItemsProps }

/** The parts, by name: `select.parts.ts` re-exports them as the `Select` namespace. */
export {
  Content,
  Description,
  Empty,
  Indicator,
  Item,
  ItemDescription,
  ItemIndicator,
  Items,
  ItemText,
  Label,
  List,
  LoadMore,
  Portal,
  Positioner,
  Root,
  Section,
  Separator,
  Trigger,
  ValueText,
}
