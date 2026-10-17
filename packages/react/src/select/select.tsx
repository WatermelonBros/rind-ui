// Select: Root (service, hidden form input), Label, Trigger, ValueText, Indicator,
// Description, Portal, Positioner, Content and the listbox parts bound to this host.
// Wiring only: the machine owns opening, value and highlight; the core parts own every
// attribute.

import {
  type Collection,
  type CollectionKey,
  createListCollection,
  domPositioning,
  focusSafely,
  getLayerStack,
  hiddenFormInput,
  type LayerMeta,
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
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type Ref,
  type RefObject,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useFieldBindingPeek, useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { LayerProvider, useParentLayer } from "../layer-context"
import type { ListboxItemData } from "../listbox/listbox"
import { createListboxParts, type ListboxHost } from "../listbox/parts"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
  readonly id?: string
  readonly children?: ReactNode
  /** Data items: the value text needs no option mounted (a closed select mounts none). */
  readonly items?: readonly ListboxItemData[]
  /** A collection built by the consumer (virtualized lists). */
  readonly collection?: Collection<unknown>
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean, details: SelectOpenChangeDetails) => void
  /** Default true. */
  readonly modal?: boolean
  readonly disabled?: boolean
  readonly focusableWhenDisabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
  readonly name?: string
  readonly form?: string
  readonly autoComplete?: string
  /** Shown while nothing is selected. */
  readonly placeholder?: string
  /** Default false (a native select does not wrap). */
  readonly loop?: boolean
  readonly typeaheadTimeout?: number
  readonly positioning?: Parameters<typeof selectPositioning>[0]["positioning"]
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean
  readonly actionsRef?: Ref<SelectActions>
}

export type SelectRootProps = Common &
  (
    | {
        readonly multiple?: false
        readonly value?: string | null
        readonly defaultValue?: string | null
        readonly onValueChange?: (value: string | null, details: SelectValueChangeDetails) => void
      }
    | {
        readonly multiple: true
        readonly value?: readonly string[]
        readonly defaultValue?: readonly string[]
        readonly onValueChange?: (
          value: readonly string[],
          details: SelectValueChangeDetails,
        ) => void
      }
  )

interface Mounted {
  readonly label: boolean
  readonly description: boolean
  readonly list: boolean
  readonly empty: boolean
  readonly descriptions: ReadonlySet<CollectionKey>
}

interface Ctx {
  readonly service: Service<typeof selectMachine>
  readonly instance: string
  readonly collection: Collection<unknown>
  readonly registry: ReturnType<typeof useCollectionItems>["registry"] | null
  readonly multiple: boolean
  readonly modal: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly invalid: boolean
  readonly placeholder?: string | undefined
  readonly keepMounted: boolean
  readonly focusableWhenDisabled: boolean
  readonly typeaheadTimeout: number
  readonly positioning: Common["positioning"]
  readonly triggerRef: RefObject<HTMLElement | null>
  readonly labelRef: RefObject<HTMLElement | null>
  readonly hiddenRef: RefObject<HTMLInputElement | null>
  readonly mounted: Mounted
  readonly setMounted: (part: "label" | "description" | "list" | "empty", on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  /** The trigger's consumer naming (the list copies `aria-label`). */
  readonly triggerNaming: RefObject<{ label?: string | undefined; labelledBy?: string | undefined }>
  readonly name?: string | undefined
  readonly form?: string | undefined
  readonly autoComplete?: string | undefined
}

const SelectContext = createContext<Ctx | null>(null)
function useSelect(part: string): Ctx {
  const ctx = useContext(SelectContext)
  if (!ctx) throw new Error(`Select.${part} must be inside Select.Root`)
  return ctx
}

/** The stack's metadata for this layer, followed while open. */
function useMeta(instance: string, open: boolean): LayerMeta | undefined {
  const env = useEnvironment()
  const [meta, setMeta] = useState<LayerMeta | undefined>(undefined)
  useEffect(() => {
    if (!open || typeof document === "undefined") return setMeta(undefined)
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => setMeta(stack.get(selectLayerId(instance))?.meta())
    read()
    return stack.subscribe(read)
  }, [instance, env, open])
  return meta
}

const listFormatter = (locale: string) => {
  const f = new Intl.ListFormat(locale, { style: "long", type: "conjunction" })
  return (texts: readonly string[]) => f.format(texts)
}

function useApi(ctx: Ctx, extra: { dir?: "ltr" | "rtl"; listFocused?: boolean } = {}) {
  const env = useEnvironment()
  const view = useSelector(ctx.service, (v) => v)
  const open = view.matches("open")
  const meta = useMeta(ctx.instance, open)
  const modality = useModality(env.modality, extra.listFocused === true)
  const api = selectConnect(
    {
      instance: ctx.instance,
      open,
      collection: ctx.collection,
      selection: selectionOf(view.values.value),
      multiple: ctx.multiple,
      highlightedKey: view.context.highlightedKey,
      highlightSource: view.context.highlightSource,
      typingAhead: () => {
        const t = ctx.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= ctx.typeaheadTimeout
      },
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      modal: ctx.modal,
      disabled: ctx.disabled,
      readOnly: ctx.readOnly,
      required: ctx.required,
      invalid: ctx.invalid,
      autofilled: view.context.autofilled,
      focusableWhenDisabled: ctx.focusableWhenDisabled,
      texts: view.context.texts,
      placeholder: ctx.placeholder,
      listFormat: listFormatter(env.locale.locale()),
      mounted: {
        label: ctx.mounted.label,
        description: ctx.mounted.description,
        list: ctx.mounted.list,
        empty: ctx.mounted.empty,
        itemDescription: (key) => ctx.mounted.descriptions.has(key),
      },
      meta,
      manual: selectPositioning({ positioning: ctx.positioning }).mode === "manual",
      listFocused: extra.listFocused === true,
      modality,
      ...(extra.dir ? { dir: extra.dir } : {}),
    },
    ctx.service.send,
    env,
  )
  return { api, open, view }
}

function Root(all: SelectRootProps) {
  const {
    id,
    items,
    collection: given,
    children,
    multiple = false,
    modal = true,
    keepMounted = false,
    focusableWhenDisabled = false,
    loop = false,
    typeaheadTimeout = 1000,
    placeholder,
    positioning,
    actionsRef,
    name,
    form,
    autoComplete,
  } = all
  const p = all as Record<string, unknown>
  const env = useEnvironment()
  const instance = useRootId(id)
  const parent = useParentLayer()
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const field = mergeFieldProps(
    {
      role: "combobox",
      labelable: true,
      disabled: all.disabled,
      readOnly: all.readOnly,
      required: all.required,
      invalid: all.invalid,
      ...(name === undefined ? {} : { name }),
    },
    enclosing,
  )
  const disabled = field.disabled || fieldsetDisabled
  const { collection: registered, registry } = useCollectionItems()
  const data = useMemo(() => (items ? fromData(items) : null), [items])
  const collection = given ?? data ?? registered ?? EMPTY
  const ids = useMemo(() => {
    const s = selectIds(instance)
    return { list: s.list, item: s.item }
  }, [instance])
  const triggerRef = useRef<HTMLElement | null>(null)
  const labelRef = useRef<HTMLElement | null>(null)
  const hiddenRef = useRef<HTMLInputElement | null>(null)
  const [formInput] = useState(() =>
    hiddenFormInput({ input: () => hiddenRef.current, control: () => triggerRef.current }, env),
  )
  const machineEnv = useMemo(() => ({ ...env, position: domPositioning(env) }), [env])
  const latest = useRef({
    onValueChange: p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined,
    onOpenChange: all.onOpenChange,
  })
  latest.current = {
    onValueChange: p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined,
    onOpenChange: all.onOpenChange,
  }
  // A user change dispatches input + change from the hidden input after it commits.
  const userChange = useRef(false)
  const { service, send } = useMachine(
    selectMachine,
    {
      collection,
      ids,
      strategy: "roving",
      selectionMode: multiple ? "multiple" : "single",
      selectionBehavior: "toggle",
      loop,
      focusableWhenDisabled,
      typeaheadTimeout,
      ...("value" in all ? { value: p["value"] as SelectValue } : {}),
      defaultValue: (p["defaultValue"] as SelectValue | undefined) ?? (multiple ? [] : null),
      onValueChange: (v, details) => {
        const reason = VALUE_REASON[details.event.type] ?? "select"
        if (reason !== "reset") userChange.current = true
        latest.current.onValueChange?.(v, { reason })
      },
      ...("open" in all ? { open: all.open } : {}),
      defaultOpen: all.defaultOpen,
      onOpenChange: (o, d) => latest.current.onOpenChange?.(o, d),
      modal,
      disabled,
      readOnly: field.readOnly,
      positioning,
      root: instance,
      parent,
      getTrigger: () => triggerRef.current,
      getLabel: () => labelRef.current,
    },
    machineEnv,
  )
  useImperativeHandle(
    actionsRef,
    () => ({ open: () => send({ type: "OPEN" }), close: () => send({ type: "CLOSE" }) }),
    [send],
  )
  const [mounted, setMountedState] = useState<Mounted>({
    label: false,
    description: false,
    list: false,
    empty: false,
    descriptions: new Set(),
  })
  const [setMounted] = useState(
    () => (part: "label" | "description" | "list" | "empty", on: boolean) =>
      setMountedState((m) => (m[part] === on ? m : { ...m, [part]: on })),
  )
  const [mountDescription] = useState(
    () => (key: CollectionKey, on: boolean) =>
      setMountedState((m) => {
        if (m.descriptions.has(key) === on) return m
        const next = new Set(m.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        return { ...m, descriptions: next }
      }),
  )
  const triggerNaming = useRef<{ label?: string | undefined; labelledBy?: string | undefined }>({})
  const ctx: Ctx = {
    service,
    instance,
    collection,
    registry: given || data ? null : registry,
    multiple,
    modal,
    disabled,
    readOnly: field.readOnly,
    required: field.required,
    invalid: field.invalid,
    placeholder,
    keepMounted,
    focusableWhenDisabled,
    typeaheadTimeout,
    positioning,
    triggerRef,
    labelRef,
    hiddenRef,
    mounted,
    setMounted,
    mountDescription,
    triggerNaming,
    name: field.name,
    form,
    autoComplete,
  }
  return (
    <SelectContext value={ctx}>
      {children}
      <HiddenInputs formInput={formInput} userChange={userChange} />
    </SelectContext>
  )
}

/** The form's view of the value: one key (single) or the constraint plus value carriers. */
function HiddenInputs({
  formInput,
  userChange,
}: {
  formInput: ReturnType<typeof hiddenFormInput>
  userChange: RefObject<boolean>
}) {
  const ctx = useSelect("Root")
  const { api, view } = useApi(ctx)
  const { service } = ctx
  const keys = selectionOf(view.values.value)
  const list = keys === "all" ? [] : [...keys]
  const latest = useRef(list)
  latest.current = list
  const [mirror] = useState(() => () => ({
    value: ctx.multiple ? (latest.current.length > 0 ? "x" : "") : (latest.current[0] ?? ""),
  }))
  // After every commit: the input shows the value; a user change also fires input + change.
  useIsoLayoutEffect(() => {
    const dispatch = userChange.current
    userChange.current = false
    formInput.sync(mirror(), { dispatch })
  })
  useEffect(
    () =>
      formInput.track({
        onReset: () => service.send({ type: "FORM.RESET" }),
        current: mirror,
        onNativeInput: (input) => {
          service.send({ type: "FORM.AUTOFILL", text: input.value })
          return true
        },
      }),
    [formInput, service, mirror],
  )
  const props = api.hiddenInput({ name: ctx.name, form: ctx.form, autoComplete: ctx.autoComplete })
  return (
    <>
      <input {...normalizeProps(props)} ref={ctx.hiddenRef} />
      {ctx.multiple && ctx.name
        ? list.map((k) => (
            <input
              key={k}
              {...normalizeProps(api.hiddenValue(k, { name: ctx.name, form: ctx.form }))}
            />
          ))
        : null}
    </>
  )
}

type Own<T extends keyof React.JSX.IntrinsicElements, S = undefined> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<S>
}

function Label({ render, ref, ...rest }: Own<"span">) {
  const ctx = useSelect("Label")
  const { api } = useApi(ctx)
  const { setMounted } = ctx
  useIsoLayoutEffect(() => {
    setMounted("label", true)
    return () => setMounted("label", false)
  }, [setMounted])
  const props = mergeProps(
    { ...normalizeProps(api.label()), ref: composeRefs(ctx.labelRef, ref) },
    rest,
  )
  return renderPart("span", props, render, undefined)
}

export interface SelectTriggerState {
  readonly open: boolean
  readonly placeholder: boolean
}

function Trigger({
  render,
  ref,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  ...rest
}: Own<"button", SelectTriggerState>) {
  const ctx = useSelect("Trigger")
  const { api, open } = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  ctx.triggerNaming.current = { label, labelledBy }
  const binding = useFieldControl()
  const register = binding?.register
  const controlId = selectIds(ctx.instance).trigger
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: controlId,
        labelable: true,
        focus: (m) => {
          if (ctx.triggerRef.current)
            void focusSafely(ctx.triggerRef.current, env, "programmatic", m)
        },
        validityElement: () => ctx.hiddenRef.current,
        value: () => ctx.service.view().values.value ?? null,
      },
      controlId,
    )
  }, [register, controlId, env])
  // Each change and each close (a commit) reported to the Field once.
  const value = useSelector(ctx.service, (v) => JSON.stringify(v.values.value ?? null))
  const reported = useRef(value)
  const report = binding?.report
  useEffect(() => {
    if (reported.current === value) return
    reported.current = value
    report?.({ type: "change", value: JSON.parse(value), user: true, composing: false })
  }, [value, report])
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) report?.({ type: "commit" })
    wasOpen.current = open
  }, [open, report])
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") api.pressTrigger(e.modality)
    },
    disabled: () => ctx.disabled,
    // A label's forwarded click focuses the trigger and never opens the popup.
    labelActivation: "focus",
  })
  const el = useRef<HTMLElement | null>(null)
  // Development: a trigger needs a name (it is never named by its value).
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    const named =
      node.hasAttribute("aria-label") ||
      node.hasAttribute("aria-labelledby") ||
      node.closest("label") !== null
    if (!named)
      console.warn(
        `[rind-ui] select #${node.id}: the trigger has no accessible name; render Select.Label or pass aria-label`,
      )
  })
  const tag = useRenderedTag("button", render, el)
  const own = normalizeProps(
    api.trigger({ tag, focused, modality, pressed: press.pressed, label, labelledBy, describedBy }),
  )
  const fieldAria = binding ? mergeFieldProps({ role: "combobox", labelable: true }, binding) : null
  // Space continuing a search must not press the trigger (the trigger's handler acts first).
  const { onKeyDown: pressKeyDown, ...pressProps } = press.props
  const props = mergeProps(
    {
      ...joinHandlers(own, pressProps, {
        onKeyDown: (e: React.KeyboardEvent) => {
          if (!e.defaultPrevented) pressKeyDown(e)
        },
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ...(fieldAria
        ? {
            "aria-describedby": fieldAria["aria-describedby"] ?? own["aria-describedby"],
            "aria-required": own["aria-required"] ?? fieldAria["aria-required"],
          }
        : {}),
      ref: composeRefs(composeRefs(el, ctx.triggerRef), ref),
    },
    rest,
  )
  return renderPart("button", props, render, { open, placeholder: api.placeholder })
}

export interface SelectValueTextProps extends Omit<Own<"span">, "children"> {
  /** Render the selected items yourself (an icon next to the text). */
  readonly children?: ReactNode | ((selected: readonly string[]) => ReactNode)
}

function ValueText({ render, children, ...rest }: SelectValueTextProps) {
  const ctx = useSelect("ValueText")
  const { api, view } = useApi(ctx)
  const keys = selectionOf(view.values.value)
  const selected = keys === "all" ? [] : [...keys]
  const text = api.valueTextContent()
  // A new node per value: WebKit re-reads a replaced node, not an updated one (zag#3099).
  const content =
    typeof children === "function"
      ? children(selected)
      : (children ?? <span key={text}>{text}</span>)
  const props = mergeProps(normalizeProps(api.valueText()), { ...rest, children: content })
  return renderPart("span", props, render, undefined)
}

function Indicator({ render, ...rest }: Own<"span">) {
  const ctx = useSelect("Indicator")
  const { api } = useApi(ctx)
  return renderPart("span", mergeProps(normalizeProps(api.indicator()), rest), render, undefined)
}

function Description({ render, ...rest }: Own<"div">) {
  const ctx = useSelect("Description")
  const { api } = useApi(ctx)
  const { setMounted } = ctx
  useIsoLayoutEffect(() => {
    setMounted("description", true)
    return () => setMounted("description", false)
  }, [setMounted])
  return renderPart("div", mergeProps(normalizeProps(api.description()), rest), render, undefined)
}

function usePartPresence(ctx: Ctx, open: boolean, subtree = false) {
  const node = useRef<HTMLElement | null>(null)
  const presence = usePresence(open, node, { keepMounted: ctx.keepMounted, subtree })
  return { node, ...presence }
}

function useTriggerDir(ctx: Ctx, open: boolean) {
  const [dir, setDir] = useState<"ltr" | "rtl" | undefined>(undefined)
  useIsoLayoutEffect(() => {
    if (!open) return
    const found = ctx.triggerRef.current?.closest("[dir]")?.getAttribute("dir")
    setDir(found === "rtl" ? "rtl" : "ltr")
  }, [open, ctx.triggerRef])
  return dir
}

function Positioner({ render, ref, children, ...rest }: Own<"div">) {
  const ctx = useSelect("Positioner")
  const open = useSelector(ctx.service, (v) => v.matches("open"))
  const dir = useTriggerDir(ctx, open)
  const { api } = useApi(ctx, dir ? { dir } : {})
  const { node, mounted } = usePartPresence(ctx, open, true)
  if (!mounted) return null
  const props = mergeProps(
    {
      ...normalizeProps(api.positioner()),
      hidden: !open && ctx.keepMounted,
      ref: composeRefs(node, ref),
    },
    { ...rest, children },
  )
  return renderPart("div", props, render, undefined)
}

function Content({ render, ref, children, ...rest }: Own<"div">) {
  const ctx = useSelect("Content")
  const { api, open } = useApi(ctx)
  const { node, mounted, state } = usePartPresence(ctx, open)
  if (!mounted) return null
  const exiting = !open && state === "exiting"
  const props = mergeProps(
    {
      ...normalizeProps(api.content()),
      hidden: !open && !exiting && ctx.keepMounted,
      ...(exiting ? { inert: true } : {}),
      ref: composeRefs(node, ref),
    },
    {
      ...rest,
      children: (
        <LayerProvider layer={selectLayerId(ctx.instance)} kind="listbox">
          {children}
        </LayerProvider>
      ),
    },
  )
  return renderPart("div", props, render, undefined)
}

function Portal(props: PortalProps) {
  const ctx = useSelect("Portal")
  const logicalParent = () => ctx.triggerRef.current
  return <PortalPart logicalParent={logicalParent} {...props} />
}

/** The listbox parts, bound to this select (the list named as the trigger says). */
function useSelectHost(part: string): ListboxHost {
  const ctx = useSelect(part)
  // A Field's label names the list when the select renders no label of its own.
  const fieldLabel = useFieldBindingPeek()?.ids?.label
  const [listFocused, setListFocused] = useState(false)
  const { api } = useApi(ctx, { listFocused })
  const { setMounted, mountDescription } = ctx
  return {
    name: "Select",
    parts: {
      ...api.listbox,
      list: () => ({
        ...api.list({
          ...ctx.triggerNaming.current,
          labelledBy: ctx.triggerNaming.current.labelledBy ?? fieldLabel,
        }),
        onFocus: () => setListFocused(true),
        onBlur: () => setListFocused(false),
      }),
    },
    collection: ctx.collection,
    registry: ctx.registry,
    mount: (p, on) => setMounted(p, on),
    mountDescription,
    requestLoadMore: () => {},
    service: ctx.service as unknown as ListboxHost["service"],
    itemSignature: (raw, key) => {
      // Sound: this host's service is the select machine's.
      const v = raw as ReturnType<typeof ctx.service.view>
      const c = v.context
      const highlighted = c.highlightedKey === key
      return [
        highlighted,
        highlighted ? c.highlightSource : null,
        JSON.stringify(v.values.value),
        ctx.collection.get(key)?.index,
        ctx.collection.size,
      ].join("|")
    },
  }
}

const listParts = createListboxParts(useSelectHost)

/** The list: it registers itself (aria-controls exists only while it is mounted). */
function List(props: Parameters<typeof listParts.List>[0]) {
  const ctx = useSelect("List")
  const { setMounted } = ctx
  useIsoLayoutEffect(() => {
    setMounted("list", true)
    return () => setMounted("list", false)
  }, [setMounted])
  return <listParts.List {...props} />
}

export const Select = {
  ...listParts,
  Root,
  Label,
  Trigger,
  ValueText,
  Indicator,
  Description,
  Portal,
  Positioner,
  Content,
  List,
}
