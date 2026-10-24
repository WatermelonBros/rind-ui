import {
  type AccordionEvent,
  type AccordionItemState,
  accordionConnect,
  accordionMachine,
  type ChangeDetails,
  type ClosedContent,
  type CollapsibleEvent,
  type PartProps as CorePartProps,
  describeKey,
  focusSafely,
  type HeadingLevel,
  type ItemKey,
  itemKey,
  openKeysOf,
  resolveHeadingLevel,
  type TriggerKeyEvent,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  useId,
  type VNodeChild,
  watch,
} from "vue"
import {
  type CollapsibleDecoration,
  CollapsibleKey,
  type CollapsibleState,
  useCollapsibleService,
} from "../collapsible/collapsible"
import { changeEmitter } from "../emit-change"
import { Heading, useHeadingContextLevel } from "../heading/heading"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare const process: { env: { NODE_ENV?: string } }

/** The default header level outside any `Heading.Level` (spec "Heading Structure"). */
const DEFAULT_HEADER_LEVEL = 3

interface RootCtx {
  readonly instance: () => string
  readonly send: (event: AccordionEvent) => void
  readonly openKeys: () => readonly string[]
  readonly api: () => ReturnType<typeof accordionConnect>
  readonly disabled: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly closedContent: () => ClosedContent
  readonly level: () => HeadingLevel
  readonly triggers: Map<ItemKey, { value: Element | null }>
}
const AccordionKey: InjectionKey<RootCtx> = Symbol("rind-ui.accordion")
function useAccordion(part: string): RootCtx {
  const ctx = inject(AccordionKey, null)
  if (!ctx) throw new Error(`Accordion.${part} must be inside Accordion.Root`)
  return ctx
}
const ItemStateKey: InjectionKey<() => AccordionItemState> = Symbol("rind-ui.accordion-item")

export interface AccordionState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

const Root = defineComponent({
  name: "AccordionRoot",
  inheritAttrs: false,
  props: {
    /** Controlled open items (`v-model`). */
    modelValue: { type: Array as PropType<readonly string[]>, default: undefined },
    defaultValue: { type: Array as PropType<readonly string[]>, default: undefined },
    /** Several items open at once. */
    multiple: Boolean,
    /** Single mode: the open item can be closed (default true). Ignored when `multiple`. */
    collapsible: { type: Boolean, default: true },
    disabled: Boolean,
    /** Disabled triggers stay focusable (`aria-disabled`). */
    focusableWhenDisabled: Boolean,
    /** Arrow keys, Home and End move between triggers (off by default, as in APG 2026). */
    keyboardNavigation: Boolean,
    orientation: { type: String as PropType<"vertical" | "horizontal">, default: "vertical" },
    dir: String as PropType<"ltr" | "rtl">,
    /** The headers' level; default: the surrounding `Heading.Level`'s, else 3. */
    headingLevel: Number as PropType<HeadingLevel>,
    /** What closed content becomes; an item can override it. */
    closedContent: { type: String as PropType<ClosedContent>, default: "until-found" },
    /** Overrides the region rule for open panels. */
    contentRole: String as PropType<"region" | "none">,
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: readonly string[], _details: ChangeDetails<AccordionEvent>) => true,
    "update:modelValue": (_value: readonly string[]) => true,
  },
  slots: Object as SlotsType<{ default?: (state: AccordionState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const locale = useLocale(
      () => undefined,
      () => props.dir,
    )
    const instance = useRootId(() => props.id)
    const triggers = new Map<ItemKey, { value: Element | null }>()
    const onValueChange = changeEmitter<readonly string[], AccordionEvent>(
      (v, d) => emit("valueChange", v, d),
      (v) => emit("update:modelValue", v),
    )
    const { view, send } = useMachine(accordionMachine, () => ({
      value: props.modelValue,
      defaultValue: props.defaultValue,
      onValueChange,
      multiple: props.multiple,
      collapsible: props.collapsible,
      disabled: props.disabled,
      keyboardNavigation: props.keyboardNavigation,
      // Document order of the triggers, whatever the mount order or closed-content mode.
      triggerOrder: (items: readonly ItemKey[]) =>
        [...items].sort((a, b) => {
          const x = triggers.get(a)?.value
          const y = triggers.get(b)?.value
          if (!x || !y) return 0
          return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        }),
      focusTrigger: (item: ItemKey) => {
        const el = triggers.get(item)?.value
        if (el instanceof HTMLElement) void focusSafely(el, env)
      },
    }))
    const context = useHeadingContextLevel()
    const level = computed(() =>
      resolveHeadingLevel(props.headingLevel, context.value ?? DEFAULT_HEADER_LEVEL),
    )
    const openKeys = computed(() => openKeysOf(view.value.values.value ?? [], props.multiple))
    const api = computed(() =>
      accordionConnect(
        {
          instance: instance(),
          orientation: props.orientation,
          dir: locale.value.dir,
          platform: env.platform,
          disabled: props.disabled,
          multiple: props.multiple,
          collapsible: props.collapsible,
          keyboardNavigation: props.keyboardNavigation,
          itemCount: view.value.context.items.size,
          contentRole: props.contentRole,
        },
        send,
      ),
    )
    provide(AccordionKey, {
      instance,
      send,
      openKeys: () => openKeys.value,
      api: () => api.value,
      disabled: () => props.disabled,
      focusableWhenDisabled: () => props.focusableWhenDisabled,
      closedContent: () => props.closedContent,
      level: () => level.value,
      triggers,
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.({ value: openKeys.value, disabled: props.disabled }),
        props.asChild,
      )
  },
})

/** Collapsible's TOGGLE / OPEN / CLOSE proposals become the accordion's item events. */
function itemEvent(item: ItemKey, event: CollapsibleEvent): AccordionEvent {
  switch (event.type) {
    case "TOGGLE":
      return { type: "ITEM.TOGGLE", item, modality: event.modality }
    case "OPEN":
      return { type: "ITEM.OPEN", item, reason: event.reason }
    case "CLOSE":
      return { type: "ITEM.CLOSE", item, reason: event.reason }
    default: {
      const never: never = event
      return never
    }
  }
}

const Item = defineComponent({
  name: "AccordionItem",
  inheritAttrs: false,
  props: {
    /** A non-empty string, unique within the accordion. */
    value: { type: String, required: true },
    disabled: Boolean,
    closedContent: String as PropType<ClosedContent>,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: CollapsibleState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const root = useAccordion("Item")
    const env = useEnvironment()
    const key = () => itemKey(props.value)
    const disabled = () => props.disabled || root.disabled()
    const open = () => root.openKeys().includes(key())
    const generated = useId()
    const state = (): AccordionItemState => ({ item: key(), open: open(), disabled: disabled() })
    // Registered on mount and whenever its key or flags change; unregistered on unmount.
    onMounted(() =>
      watch(
        () => [key(), disabled(), !disabled() || root.focusableWhenDisabled()] as const,
        ([item, isDisabled, focusable], old) => {
          if (old && old[0] !== item) root.send({ type: "ITEM.UNREGISTER", item: old[0] })
          root.send({ type: "ITEM.REGISTER", item, disabled: isDisabled, focusable })
        },
        { immediate: true },
      ),
    )
    onBeforeUnmount(() => root.send({ type: "ITEM.UNREGISTER", item: key() }))
    const decoration: CollapsibleDecoration = {
      trigger: () => {
        const t = root.api().trigger(state())
        const onKeyDown = t["onKeyDown"] as (e: TriggerKeyEvent) => void // set by connect
        return {
          ...t,
          onKeyDown: (e: KeyboardEvent) =>
            onKeyDown({
              ...describeKey(e, env),
              onTrigger: e.target === e.currentTarget,
              preventDefault: () => e.preventDefault(),
            }),
        } satisfies CorePartProps
      },
      content: (triggerId) => root.api().content(state(), triggerId),
      indicator: () => root.api().indicator(),
      // A heading inside a panel is one level below its header.
      wrapContent: (c) =>
        h(Heading.Level, { level: Math.min(root.level() + 1, 6) as HeadingLevel }, () => c),
    }
    const ctx = useCollapsibleService({
      scope: "accordion",
      instance: root.instance,
      idBase: () => generated,
      label: "Accordion",
      decoration,
      props: () => ({
        open: open(),
        defaultOpen: undefined,
        // A proposal is always one of the collapsible's own events (never a system event).
        onOpenChange: (_open: boolean, details: ChangeDetails<CollapsibleEvent>) =>
          root.send(itemEvent(key(), details.event as CollapsibleEvent)),
        disabled: disabled(),
        focusableWhenDisabled: root.focusableWhenDisabled(),
        closedContent: props.closedContent ?? root.closedContent(),
      }),
    })
    onMounted(() => root.triggers.set(key(), ctx.triggerEl))
    onBeforeUnmount(() => root.triggers.delete(key()))
    provide(ItemStateKey, state)
    provide(CollapsibleKey, ctx)
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(root.api().item(state())), attrs),
        slots.default?.({ open: open(), disabled: disabled() }),
        props.asChild,
      )
  },
})

const Header = defineComponent({
  name: "AccordionHeader",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{ default?: (state: CollapsibleState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const root = useAccordion("Header")
    const state = inject(ItemStateKey, null)
    if (!state) throw new Error("Accordion.Header must be inside Accordion.Item")
    const el = shallowRef<Element | null>(null)
    const tag = shallowRef<string | null>(null)
    // APG: the button is the heading's only element (base-ui#3632).
    const check = () => {
      const node = el.value
      tag.value = node?.tagName.toLowerCase() ?? null
      if (process.env.NODE_ENV === "production" || !node) return
      const others = Array.from(node.children).filter(
        (c) => c.getAttribute("data-part") !== "trigger",
      )
      if (others.length > 0) {
        console.warn(
          `[rind-ui] accordion: the header of item "${state().item}" contains elements besides its trigger; the trigger must be the heading's only element`,
        )
      }
    }
    onMounted(check)
    onUpdated(check)
    return () => {
      const s = state()
      const level = root.level()
      return renderPart(
        `h${level}`,
        mergeProps(
          {
            ...normalizeProps(root.api().header(s, level, tag.value ?? `h${level}`)),
            ref: refTo(el),
          },
          attrs,
        ),
        slots.default?.({ open: s.open, disabled: s.disabled }),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `accordion.parts.ts` re-exports them (and the Collapsible's) as the `Accordion` namespace. */
export { Header, Item, Root }
