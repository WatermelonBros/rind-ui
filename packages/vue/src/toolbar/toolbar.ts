import {
  announcerCapability,
  type CompositeHost,
  createListCollection,
  layoutCapability,
  type SeparatorOrientation,
  toolbarConnect,
  toolbarIds,
  toolbarMachine,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  useId,
  type VNodeChild,
} from "vue"
import { Button } from "../button/button"
import { CompositeHostKey, useCompositeHost, useHostItem } from "../composite-host"
import { Link } from "../link/link"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { SeparatorHostKey } from "../separator/separator"
import { useCollectionItems } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

/** The toolbar's parts read its connect through the host (groups re-provide it). */
type ToolbarHost = CompositeHost & { readonly api: ReturnType<typeof toolbarConnect> }
function useToolbar(part: string): ToolbarHost {
  const host = useCompositeHost()
  if (!host || !("api" in host)) throw new Error(`Toolbar.${part} must be inside Toolbar.Root`)
  return host as ToolbarHost // the toolbar's own host object (the only one with `api`)
}

/** What the Root exposes (a template ref on it). */
export interface ToolbarActions {
  /** Focuses the toolbar's tab stop (for an application shortcut such as Alt+F10). */
  focus(): void
}

export interface ToolbarState {
  readonly orientation: "horizontal" | "vertical"
  readonly disabled: boolean
}

const Root = defineComponent({
  name: "ToolbarRoot",
  inheritAttrs: false,
  props: {
    orientation: { type: String as PropType<"horizontal" | "vertical">, default: "horizontal" },
    /** Arrow moves wrap at both ends (default true). */
    loop: { type: Boolean, default: true },
    disabled: Boolean,
    /** Disabled controls stay focusable and reachable by arrows (default true). */
    focusableWhenDisabled: { type: Boolean, default: true },
    id: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: ToolbarState) => VNodeChild }>,
  setup(props, { attrs, slots, expose }) {
    const env = useEnvironment(announcerCapability, layoutCapability)
    const instance = useRootId(() => props.id)
    const ids = computed(() => toolbarIds(instance()))
    const { collection: registered, registry } = useCollectionItems()
    const collection = () => registered.value ?? EMPTY
    const { view, send } = useMachine(
      toolbarMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids.value,
        loop: props.loop,
        // Each control registers as skipped when it is not focusable while disabled.
        focusableWhenDisabled: false,
        orientation: props.orientation,
        disabled: props.disabled,
      }),
      env,
    )
    const api = computed(() =>
      toolbarConnect(
        {
          instance: instance(),
          collection: collection(),
          highlightedKey: view.value.context.highlightedKey,
          focusWithin: view.value.matches("focused"),
          pending: registered.value === null,
          orientation: props.orientation,
          disabled: props.disabled,
          focusableWhenDisabled: props.focusableWhenDisabled,
        },
        send,
        env,
      ),
    )
    expose({ focus: () => send({ type: "FOCUS_TOOLBAR" }) } satisfies ToolbarActions)
    // Render order (the server tab stop): reset on every render of the root, before its children.
    let first: string | null = null
    // Getters: the controls read the toolbar's current props in their own renders.
    const host: ToolbarHost = {
      kind: "toolbar",
      get orientation() {
        return props.orientation
      },
      get disabled() {
        return props.disabled
      },
      get focusableWhenDisabled() {
        return props.focusableWhenDisabled
      },
      register: registry.register,
      itemProps: (item) => api.value.control(item),
      claimFirst: (id) => {
        first ??= id
        return first === id
      },
      get api() {
        return api.value
      },
    }
    provide(CompositeHostKey, host)
    provide(
      SeparatorHostKey,
      computed(() => ({
        context: "toolbar" as const,
        defaultOrientation: (props.orientation === "horizontal"
          ? "vertical"
          : "horizontal") as SeparatorOrientation,
      })),
    )
    const el = shallowRef<Element | null>(null)
    // Development: a toolbar needs a name (aria-label or aria-labelledby).
    const check = () => {
      const node = el.value
      if (process.env.NODE_ENV === "production" || !node) return
      if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] toolbar: #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    }
    onMounted(check)
    onUpdated(check)
    return () => {
      first = null
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(api.value.root()), ref: refTo(el) }, attrs),
        slots.default?.({ orientation: props.orientation, disabled: props.disabled }),
        props.asChild,
      )
    }
  },
})

/**
 * A control's roving wiring: its element id is its key; disabled from itself, its group or
 * the toolbar; skipped by arrows when not focusable while disabled. Call in setup.
 */
function useControl(
  part: string,
  own: () => {
    readonly id?: string | undefined
    readonly disabled: boolean
    readonly focusable: boolean | undefined
  },
) {
  const host = useToolbar(part)
  const generated = useId()
  const el = shallowRef<Element | null>(null)
  const id = () => own().id ?? `toolbar-control-${generated.replace(/:/g, "")}`
  const disabled = () => host.disabled || own().disabled
  const keepsFocus = () => own().focusable ?? host.focusableWhenDisabled
  useHostItem(host, () => ({ id: id(), skip: disabled() && !keepsFocus() }), el)
  return {
    host,
    el,
    id,
    disabled,
    keepsFocus,
    /** Call during render: claims the server tab stop in render order. */
    roving: () => host.itemProps({ id: id(), disabled: disabled(), first: host.claimFirst(id()) }),
  }
}

const controlProps = {
  id: String,
  disabled: Boolean,
  /** Overrides the toolbar's `focusableWhenDisabled` for this control. */
  focusableWhenDisabled: { type: Boolean, default: undefined },
} as const

const ToolbarButton = defineComponent({
  name: "ToolbarButton",
  inheritAttrs: false,
  props: { ...controlProps, ...asChildProp },
  setup(props, { attrs, slots }) {
    const c = useControl("Button", () => ({
      id: props.id,
      disabled: props.disabled,
      focusable: props.focusableWhenDisabled,
    }))
    return () =>
      h(
        Button,
        {
          ...mergeProps(
            {
              ...normalizeProps({ ...c.roving(), ...c.host.api.part("button", c.id()) }),
              ref: refTo(c.el),
            },
            attrs,
          ),
          id: c.id(),
          disabled: c.disabled(),
          focusableWhenDisabled: c.keepsFocus(),
          asChild: props.asChild,
        },
        slots,
      )
  },
})

const ToolbarLink = defineComponent({
  name: "ToolbarLink",
  inheritAttrs: false,
  props: { ...controlProps, ...asChildProp },
  setup(props, { attrs, slots }) {
    const c = useControl("Link", () => ({
      id: props.id,
      disabled: props.disabled,
      focusable: props.focusableWhenDisabled,
    }))
    return () =>
      h(
        Link,
        {
          ...mergeProps(
            {
              ...normalizeProps({ ...c.roving(), ...c.host.api.part("link", c.id()) }),
              // Space activates a link once without scrolling the page (Enter stays native).
              onKeydown: (e: KeyboardEvent) => {
                if (e.key !== " " || e.defaultPrevented || e.target !== e.currentTarget) return
                e.preventDefault()
                if (!e.repeat) (e.currentTarget as HTMLElement).click()
              },
              ref: refTo(c.el),
            },
            attrs,
          ),
          id: c.id(),
          disabled: c.disabled(),
          focusableWhenDisabled: c.keepsFocus(),
          asChild: props.asChild,
        },
        slots,
      )
  },
})

export interface ToolbarItemState {
  readonly disabled: boolean
}

const TEXT_TAGS = new Set(["input", "textarea"])

/** A control rendered by its slot's single element (a Menu trigger, a checkbox, a text input). */
const ToolbarItem = defineComponent({
  name: "ToolbarItem",
  inheritAttrs: false,
  props: controlProps,
  slots: Object as SlotsType<{ default?: (state: ToolbarItemState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const c = useControl("Item", () => ({
      id: props.id,
      disabled: props.disabled,
      focusable: props.focusableWhenDisabled,
    }))
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = c.el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const children = slots.default?.({ disabled: c.disabled() })
      const tag = renderedTag("button", children, true, measured.value)
      const disabledProps = !c.disabled()
        ? {}
        : c.keepsFocus()
          ? // Focusable while disabled: announced, and a text field takes no input (base-ui#5366).
            { "aria-disabled": "true", ...(TEXT_TAGS.has(tag) ? { readonly: true } : {}) }
          : { disabled: true }
      const merged = mergeProps(
        {
          ...normalizeProps({ ...c.roving(), ...c.host.api.part("item", c.id()) }),
          ...disabledProps,
          id: c.id(),
          ref: refTo(c.el),
        },
        attrs,
      )
      return renderPart("button", merged, children, true)
    }
  },
})

export interface ToolbarGroupState {
  readonly disabled: boolean
}

const ToolbarGroup = defineComponent({
  name: "ToolbarGroup",
  inheritAttrs: false,
  props: {
    /** Disables every control inside the group. */
    disabled: Boolean,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: ToolbarGroupState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const host = useToolbar("Group")
    const groupDisabled = () => host.disabled || props.disabled
    // The same host, disabled for the controls inside (hosted composites included).
    const inner: ToolbarHost = Object.create(host, {
      disabled: { get: groupDisabled, enumerable: true },
    })
    provide(CompositeHostKey, inner)
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(host.api.group(groupDisabled())), attrs),
        slots.default?.({ disabled: groupDisabled() }),
        props.asChild,
      )
  },
})

const ToolbarSeparator = defineComponent({
  name: "ToolbarSeparator",
  inheritAttrs: false,
  props: {
    /** Default: perpendicular to the toolbar. */
    orientation: String as PropType<SeparatorOrientation>,
    ...asChildProp,
  },
  slots: Object as SlotsType<{
    default?: (state: { readonly orientation: SeparatorOrientation }) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const host = useToolbar("Separator")
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const children = slots.default
      const own = normalizeProps(
        host.api.separator({
          orientation: props.orientation,
          tag: props.asChild ? (measured.value ?? "div") : "div",
        }),
      )
      const orientation = own["data-orientation"] as SeparatorOrientation // set by separatorProps
      return renderPart(
        "div",
        mergeProps({ ...own, ref: refTo(el) }, attrs),
        children?.({ orientation }),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `toolbar.parts.ts` re-exports them as the `Toolbar` namespace. */
export {
  Root,
  ToolbarButton as Button,
  ToolbarGroup as Group,
  ToolbarItem as Item,
  ToolbarLink as Link,
  ToolbarSeparator as Separator,
}
