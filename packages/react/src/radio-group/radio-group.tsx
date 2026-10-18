import {
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  type FormInputCapability,
  focusSafely,
  hiddenFormInput,
  implicitSubmit,
  isImeKey,
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
import { useCompositeHost, useHostItem } from "../composite-host"
import { declaredItems, serverStop } from "../declared-items"
import { useFieldControl } from "../field/field"
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

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

type GroupPart = "label" | "description" | "error-message"

interface Ctx {
  readonly instance: string
  readonly api: ReturnType<typeof radioGroupConnect>
  readonly send: (event: RadioGroupEvent) => void
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly parts: ReturnType<typeof usePartRegistry<GroupPart>>
  readonly ids: ReturnType<typeof radioGroupIds>
  readonly value: string | null
  readonly highlightedKey: string | null
  readonly highlightSource: string | null
  readonly disabled: boolean
  readonly inField: boolean
  readonly invalid: boolean
  /** A user change waiting for its commit: that item's input dispatches input + change. */
  readonly pending: { current: string | null }
  readonly focusableWhenDisabled: boolean
  /** Hosted by a Toolbar: Enter checks (APG toolbar) and never submits. */
  readonly hosted: boolean
}
const GroupContext = createContext<Ctx | null>(null)
/**
 * Internal (not exported from the package): set by a component that renders a Radio Group as
 * its part (Color Picker's swatch group): the host's scope and part names.
 */
export const RadioGroupNaming = createContext<RadioNaming | null>(null)
function useGroup(part: string): Ctx {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error(`RadioGroup.${part} must be inside RadioGroup.Root`)
  return ctx
}

interface ItemCtx {
  readonly key: CollectionKey
  readonly disabled: boolean
  readonly controlTag: string
  readonly setControlTag: (tag: string) => void
  readonly labelRendered: boolean
  readonly setLabelRendered: (on: boolean) => void
  readonly descriptionRendered: boolean
  readonly setDescriptionRendered: (on: boolean) => void
  readonly inputEl: { current: HTMLInputElement | null }
  readonly controlEl: { current: HTMLElement | null }
}
const ItemContext = createContext<ItemCtx | null>(null)
function useItem(part: string): ItemCtx {
  const ctx = useContext(ItemContext)
  if (!ctx) throw new Error(`RadioGroup.${part} must be inside RadioGroup.Item`)
  return ctx
}

export interface RadioGroupState {
  readonly value: string | null
  readonly disabled: boolean
}

export type RadioGroupRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue"
> & {
  /** The group's parts (Label, Items, Description, ErrorMessage). */
  readonly children?: ReactNode
  readonly value?: string | null
  readonly defaultValue?: string | null
  readonly onValueChange?: (value: string | null, details: ChangeDetails<RadioGroupEvent>) => void
  /** Only `aria-orientation` and `data-orientation`: every arrow key moves. */
  readonly orientation?: "vertical" | "horizontal"
  /** Disables every radio. */
  readonly disabled?: boolean
  /** A disabled group stays discoverable: the root is one tab stop. */
  readonly focusableWhenDisabled?: boolean
  /** Navigable, never changes. */
  readonly readOnly?: boolean
  /** Valid with one radio checked. */
  readonly required?: boolean
  /** Marks the group invalid; shows the ErrorMessage. */
  readonly invalid?: boolean
  /** Default: derived from the root id (two groups never form one browser group). */
  readonly name?: string
  /** The id of the form the hidden inputs belong to. */
  readonly form?: string
  /** Another element or a render function receiving the props and the group's state. */
  readonly render?: RenderProp<RadioGroupState>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  orientation = "vertical",
  disabled = false,
  focusableWhenDisabled: ownFocusable,
  readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  render,
  id,
  ref,
  children,
  "aria-label": ariaLabel,
  ...rest
}: RadioGroupRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const naming = useContext(RadioGroupNaming)
  const ids = useMemo(
    () => (naming ? radioGroupIds(instance, naming) : radioGroupIds(instance)),
    [instance, naming],
  )
  // The parts the effects below look up, under a host's names when the group is its part.
  const hiddenPart = naming ? radioPartName(naming, "hidden-input") : "hidden-input"
  const controlPart = naming?.control ?? "item-control"
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = useState(false)
  // Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
  const host = useCompositeHost()
  const focusableWhenDisabled = ownFocusable ?? host?.focusableWhenDisabled ?? false
  const field = mergeFieldProps(
    {
      role: "radiogroup",
      labelable: false,
      disabled: disabled || fieldsetContext || fieldsetDom || host?.disabled === true,
      readOnly,
      required,
      invalid,
      name,
      ariaLabel,
    },
    binding,
  )
  const { collection: registered, registry } = useCollectionItems()
  const collection = registered ?? EMPTY
  const pending = useRef<string | null>(null)
  // The reason of the latest accepted change, for the Field: only a user's clears its
  // external (server) errors (base-ui#1745); a parent's value or a reset does not.
  const lastReason = useRef<string | null>(null)
  const { view, send } = useMachine(radioGroupMachine, {
    collection,
    strategy: "roving",
    ids,
    loop: true,
    selectionMode: "single",
    focusableWhenDisabled,
    value,
    defaultValue,
    // A user change (an arrow or a press) is dispatched on that item's input after commit.
    onValueChange: (next, details) => {
      lastReason.current = details.reason
      if (details.reason === "NAVIGATE" || details.reason === "PRESS") pending.current = next
      onValueChange?.(next, details)
    },
    disabled: field.disabled,
    readOnly: field.readOnly,
  })
  const current = view.values.value ?? null
  // The Label is expected unless something else names the group: the server HTML then
  // already labels the root (base-ui#5597).
  const parts = usePartRegistry<GroupPart>({
    scope: "radio-group",
    root: instance,
    ...(ariaLabel === undefined && binding === null ? { expected: ["label"] as const } : {}),
  })
  const rendered = {
    label: useRenderedId(parts, "label"),
    description: useRenderedId(parts, "description"),
    errorMessage: useRenderedId(parts, "error-message"),
  }
  const api = radioGroupConnect(
    {
      instance,
      ...(naming ? { naming } : {}),
      collection,
      value: current,
      highlightedKey: view.context.highlightedKey,
      highlightSource: view.context.highlightSource,
      pending: registered === null,
      pendingStop: serverStop(declaredItems(children, Item), current === null ? [] : [current]),
      orientation,
      disabled: field.disabled,
      focusableWhenDisabled,
      readOnly: field.readOnly,
      required: field.required || field["aria-required"] === "true",
      invalid: field.invalid,
      name: field.name,
      form,
      rendered,
      ...(binding ? { field: binding.ids } : {}),
      ariaLabel,
      hosted: host !== null,
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
  // A form reset is answered once, by the group (every item's input re-syncs).
  useEffect(() => {
    const node = el.current
    if (!node) return
    const doc = node.ownerDocument
    const onReset = (e: Event) => {
      if (e.defaultPrevented) return
      const input = node.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`)
      if (input && e.target === input.form) send({ type: "RESET" })
    }
    doc.addEventListener("reset", onReset)
    return () => doc.removeEventListener("reset", onReset)
  }, [send, hiddenPart])
  // After the items' effects: a proposal the parent refused never dispatches later.
  useIsoLayoutEffect(() => {
    if (pending.current !== null && pending.current !== current) pending.current = null
  })
  // Development: a radiogroup needs a name (Label, aria-label, or a Field's Label). Checked after
  // the re-render a Label's or a Field's registration causes, not on the first commit.
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    queueMicrotask(() => {
      if (!node.isConnected) return
      if (!node.getAttribute("aria-labelledby") && !node.getAttribute("aria-label")) {
        console.warn(
          `[rind-ui] radio-group: #${node.id} has no accessible name; render RadioGroup.Label or pass aria-label`,
        )
      }
    })
  })
  // field-control: the group registers once as one (non-labelable) control.
  const register = binding?.register
  const latest = useRef(current)
  latest.current = current
  useIsoLayoutEffect(() => {
    if (!register) return
    const radios = () =>
      Array.from(
        el.current?.querySelectorAll<HTMLElement>(
          `[data-part="${controlPart}"][data-instance="${instance}"]`,
        ) ?? [],
      )
    return register(
      {
        id: instance,
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
          el.current?.querySelector<HTMLInputElement>(`[data-part="${hiddenPart}"]`) ?? null,
        value: () => latest.current,
      },
      instance,
    )
  }, [register, instance, env, hiddenPart, controlPart])
  const reported = useRef(current)
  const report = binding?.report
  useEffect(() => {
    if (reported.current === current) return
    reported.current = current
    const user = lastReason.current === "NAVIGATE" || lastReason.current === "PRESS"
    lastReason.current = null
    report?.({ type: "change", value: current, user, composing: false })
    report?.({ type: "commit" })
  }, [current, report])
  const ctx: Ctx = {
    instance,
    api,
    send,
    registry,
    parts,
    ids,
    value: current,
    highlightedKey: view.context.highlightedKey,
    highlightSource: view.context.highlightSource,
    disabled: field.disabled,
    inField: binding !== null,
    invalid: field.invalid,
    pending,
    focusableWhenDisabled,
    hosted: host !== null,
  }
  const props = mergeProps(
    {
      ...normalizeProps({ ...api.root(), ...binding?.data }),
      ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return (
    <GroupContext value={ctx}>
      {renderPart("div", { ...props, children }, render, {
        value: current,
        disabled: field.disabled,
      })}
    </GroupContext>
  )
}

type PartProps<
  T extends keyof React.JSX.IntrinsicElements,
  S = undefined,
> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<S>
}

function Label({ render, ...rest }: PartProps<"span">) {
  const ctx = useGroup("Label")
  useRegisterPart(ctx.parts, "label", ctx.ids.label)
  const props = mergeProps(normalizeProps(ctx.api.label()), rest)
  // Not a <label>: a radiogroup is not labelable.
  return renderPart("span", props, render, undefined)
}

function Description({ render, ...rest }: PartProps<"p">) {
  const ctx = useGroup("Description")
  useRegisterPart(ctx.parts, "description", ctx.ids.description)
  const props = mergeProps(normalizeProps(ctx.api.description()), rest)
  return renderPart("p", props, render, undefined)
}

function ErrorMessage({ render, ...rest }: PartProps<"p">) {
  const ctx = useGroup("ErrorMessage")
  // Inside a Field the Field's ErrorMessage is the one; shown only while invalid.
  const shown = !ctx.inField && ctx.invalid
  useRegisterPart(ctx.parts, "error-message", shown ? ctx.ids.errorMessage : undefined)
  const props = mergeProps(normalizeProps(ctx.api.errorMessage()), rest)
  if (!shown) return null
  return renderPart("p", props, render, undefined)
}

export interface RadioItemState {
  readonly checked: boolean
  readonly disabled: boolean
}

export type RadioGroupItemProps = PartProps<"div", RadioItemState> & {
  /** The item's value: what the group's value and the form submit. */
  readonly value: string
  /** Disables this radio only. */
  readonly disabled?: boolean
  /** The text for the collection (defaults to the item's text content). */
  readonly textValue?: string
}

function Item({
  value,
  disabled = false,
  textValue,
  render,
  ref,
  children,
  ...rest
}: RadioGroupItemProps) {
  const ctx = useGroup("Item")
  const env = useEnvironment()
  const key = toKey(value)
  const el = useRef<HTMLElement | null>(null)
  useRegisterItem(ctx.registry, { key: value, textValue, disabled }, el)
  const [controlTag, setControlTag] = useState("button")
  const [labelRendered, setLabelRendered] = useState(false)
  const [descriptionRendered, setDescriptionRendered] = useState(false)
  const inputEl = useRef<HTMLInputElement | null>(null)
  const controlEl = useRef<HTMLElement | null>(null)
  const checked = ctx.value === key
  const formInput: FormInputCapability = useMemo(
    () => hiddenFormInput({ input: () => inputEl.current, control: () => controlEl.current }, env),
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
        // The group answers the reset once; each input only re-syncs.
        resetsWithForm: false,
      }),
    [formInput],
  )
  const itemCtx: ItemCtx = {
    key,
    disabled,
    controlTag,
    setControlTag,
    labelRendered,
    setLabelRendered,
    descriptionRendered,
    setDescriptionRendered,
    inputEl,
    controlEl,
  }
  const props = mergeProps(
    { ...normalizeProps(ctx.api.item(key, { disabled })), ref: composeRefs(el, ref) },
    rest,
  )
  return (
    <ItemContext value={itemCtx}>
      {renderPart(
        "div",
        {
          ...props,
          children: (
            <>
              {children}
              {/* A sibling of the control, never inside it (reka-ui#1597). */}
              <input {...normalizeProps(ctx.api.hiddenInput(key, { disabled }))} ref={inputEl} />
            </>
          ),
        },
        render,
        { checked, disabled: ctx.disabled || disabled },
      )}
    </ItemContext>
  )
}

function ItemControl({ render, ref, ...rest }: PartProps<"button", RadioItemState>) {
  const ctx = useGroup("ItemControl")
  const item = useItem("ItemControl")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const { setControlTag } = item
  useIsoLayoutEffect(() => setControlTag(tag), [tag, setControlTag])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const disabled = () => ctx.disabled || item.disabled
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PRESS", key: item.key, modality: e.modality })
    },
    disabled,
  })
  const hover = useHover({ env, send: () => {}, disabled })
  const labelable = tag === "button" || tag === "input"
  // Hosted: the radio is also one of the host's controls (navigation and tab stop).
  const host = useCompositeHost()
  const hostKey = ctx.ids.item(item.key)
  useHostItem(
    host,
    // The toolbar has no typeahead: the value is enough to name the registration.
    { id: hostKey, skip: disabled() && !ctx.focusableWhenDisabled, textValue: item.key },
    el,
  )
  const hostProps = host
    ? normalizeProps(
        host.itemProps({ id: hostKey, disabled: disabled(), first: host.claimFirst(hostKey) }),
      )
    : {}
  const own = normalizeProps(
    ctx.api.itemControl(item.key, {
      tag,
      focused,
      modality,
      pressed: press.pressed,
      hovered: hover.hovered,
      itemDisabled: item.disabled,
      labelable,
      labelRendered: item.labelRendered,
      descriptionRendered: item.descriptionRendered,
    }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(
        own,
        hostProps,
        {
          // Enter submits the form (implicit submission) and never checks; hosted by a
          // toolbar, Enter checks like Space (APG toolbar example) and never submits.
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
            if (!ctx.hosted) {
              implicitSubmit(item.inputEl.current?.form ?? null)
              return
            }
            e.preventDefault()
            if (!disabled() && !e.repeat) {
              ctx.send({ type: "PRESS", key: item.key, modality: "keyboard" })
            }
          },
        },
        press.props,
        hover.props,
        { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
      ),
      ref: composeRefs(composeRefs(el, item.controlEl), ref),
    },
    rest,
  )
  return renderPart("button", props, render, {
    checked: ctx.value === item.key,
    disabled: disabled(),
  })
}

function ItemIndicator({ render, ...rest }: PartProps<"span", RadioItemState>) {
  const ctx = useGroup("ItemIndicator")
  const item = useItem("ItemIndicator")
  const checked = ctx.value === item.key
  const props = mergeProps(
    normalizeProps(ctx.api.itemIndicator(item.key, { disabled: item.disabled })),
    rest,
  )
  // Mounted only while checked.
  if (!checked) return null
  return renderPart("span", props, render, { checked, disabled: item.disabled })
}

function ItemLabel({ render, ...rest }: PartProps<"label", RadioItemState>) {
  const ctx = useGroup("ItemLabel")
  const item = useItem("ItemLabel")
  const { setLabelRendered } = item
  useIsoLayoutEffect(() => {
    setLabelRendered(true)
    return () => setLabelRendered(false)
  }, [setLabelRendered])
  const labelable = item.controlTag === "button" || item.controlTag === "input"
  const props = mergeProps(
    normalizeProps(ctx.api.itemLabel(item.key, { disabled: item.disabled, labelable })),
    rest,
  )
  return renderPart("label", props, render, {
    checked: ctx.value === item.key,
    disabled: item.disabled,
  })
}

function ItemDescription({ render, ...rest }: PartProps<"p", RadioItemState>) {
  const ctx = useGroup("ItemDescription")
  const item = useItem("ItemDescription")
  const { setDescriptionRendered } = item
  useIsoLayoutEffect(() => {
    setDescriptionRendered(true)
    return () => setDescriptionRendered(false)
  }, [setDescriptionRendered])
  const props = mergeProps(
    normalizeProps(ctx.api.itemDescription(item.key, { disabled: item.disabled })),
    rest,
  )
  return renderPart("p", props, render, {
    checked: ctx.value === item.key,
    disabled: item.disabled,
  })
}

export const RadioGroup = {
  Root,
  Label,
  Description,
  ErrorMessage,
  Item,
  ItemControl,
  ItemIndicator,
  ItemLabel,
  ItemDescription,
}
