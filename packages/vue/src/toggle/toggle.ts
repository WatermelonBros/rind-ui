import {
  accessibleNameOf,
  blurEvent,
  type ChangeDetails,
  checkStableName,
  focusEvent,
  type ToggleEvent,
  toggleConnect,
  toggleMachine,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { changeEmitter } from "../emit-change"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { elementOf, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

declare const process: { env: { NODE_ENV?: string } }

export interface ToggleState {
  readonly pressed: boolean
  readonly disabled: boolean
}

type Api = ReturnType<typeof toggleConnect>
const ToggleKey: InjectionKey<{ api: () => Api; state: () => ToggleState }> =
  Symbol("rind-ui.toggle")

const Root = defineComponent({
  name: "ToggleRoot",
  inheritAttrs: false,
  props: {
    /** Controlled pressed state (`v-model:pressed`). */
    pressed: { type: Boolean, default: undefined },
    /** Uncontrolled initial state. Default: false. */
    defaultPressed: { type: Boolean, default: undefined },
    disabled: Boolean,
    /** Stays in the tab order while disabled (`aria-disabled`), e.g. for a tooltip. */
    focusableWhenDisabled: Boolean,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** Every activation proposes the opposite value; `details.cancel()` vetoes it. */
    pressedChange: (_pressed: boolean, _details: ChangeDetails<ToggleEvent>) => true,
    "update:pressed": (_pressed: boolean) => true,
  },
  slots: Object as SlotsType<{ default?: (state: ToggleState) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const onPressedChange = changeEmitter<boolean, ToggleEvent>(
      (v, d) => emit("pressedChange", v, d),
      (v) => emit("update:pressed", v),
    )
    const { view, send } = useMachine(toggleMachine, () => ({
      pressed: props.pressed,
      defaultPressed: props.defaultPressed,
      onPressedChange,
    }))
    // A rind-ui Fieldset's injection reaches teleported parts; the DOM tracker native fieldsets.
    const fieldsetContext = useFieldsetDisabled()
    const fieldsetDom = shallowRef(false)
    const disabled = computed(() => props.disabled || fieldsetContext.value || fieldsetDom.value)
    const on = computed(() => view.value.matches("on"))
    let named: { name: string; on: boolean } | undefined
    const checkName = () => {
      if (process.env.NODE_ENV === "production" || !el.value) return
      if (named?.on === on.value) return
      const current = { name: accessibleNameOf(el.value), on: on.value }
      checkStableName(named, current)
      named = current
    }
    onMounted(() => {
      // The modality tracker must see the pointerdown that comes before focus.
      const offModality = env.modality.subscribe(() => {})
      const node = el.value
      const watcher = node ? watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d)) : null
      if (watcher) fieldsetDom.value = watcher.disabled
      measured.value = node?.tagName.toLowerCase() ?? null
      checkName()
      onBeforeUnmount(() => {
        offModality()
        watcher?.stop()
      })
    })
    onUpdated(() => {
      measured.value = el.value?.tagName.toLowerCase() ?? null
      checkName()
    })
    const press = usePress({
      env,
      // Only the activation toggles; disabled sends nothing (no guard in the machine).
      send: (e) => {
        // A PressEvent's `type` is the PressEventType union; this one is checked to be "PRESS".
        if (e.type === "PRESS") send(e as Extract<typeof e, { type: "PRESS" }>)
      },
      disabled: () => disabled.value,
    })
    const hover = useHover({ env, send: () => {}, disabled: () => disabled.value })
    const focused = computed(() => view.value.context.focused)
    const modality = useModality(env.modality, () => focused.value)
    const state = computed<ToggleState>(() => ({ pressed: on.value, disabled: disabled.value }))
    const api = (tag: string) =>
      toggleConnect(
        {
          instance: instance(),
          tag,
          on: on.value,
          disabled: disabled.value,
          focusableWhenDisabled: props.focusableWhenDisabled,
          focused: focused.value,
          modality: modality.value,
          pressed: press.pressed.value,
          hovered: hover.hovered.value,
        },
        env,
      )
    // The tag of the last render: parts below read the connect output reactively through it.
    let tag = "button"
    provide(ToggleKey, { api: () => api(tag), state: () => state.value })
    return () => {
      const children = slots.default?.(state.value)
      tag = renderedTag("button", children, props.asChild, measured.value)
      const own = joinHandlers(normalizeProps(api(tag).root()), press.props, hover.props, {
        onFocusin: (e: FocusEvent) => send(focusEvent(e.currentTarget as Element, env.modality)),
        onFocusout: () => send(blurEvent(env.modality)),
      })
      const props_ = mergeProps(
        {
          ...own,
          ...(props.id === undefined ? {} : { id: props.id }),
          ref: (node: unknown) => (el.value = elementOf(node)),
        },
        attrs,
      )
      return renderPart("button", props_, children, props.asChild)
    }
  },
})

const Indicator = defineComponent({
  name: "ToggleIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    default?: (state: ToggleState) => VNodeChild
    /** Rendered while the toggle is off (the default slot while it is on). */
    fallback?: (state: ToggleState) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const ctx = inject(ToggleKey, null)
    if (!ctx) throw new Error("Toggle.Indicator must be inside Toggle.Root")
    return () => {
      const state = ctx.state()
      const merged = mergeProps(normalizeProps(ctx.api().indicator()), attrs)
      const children = state.pressed ? slots.default?.(state) : slots.fallback?.(state)
      return renderPart("span", merged, children, props.asChild)
    }
  },
})

/** The parts, by name: `toggle.parts.ts` re-exports them as the `Toggle` namespace. */
export { Indicator, Root }
