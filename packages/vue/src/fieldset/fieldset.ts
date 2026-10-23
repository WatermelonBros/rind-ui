import {
  type FieldsetPart,
  type FieldsetScope,
  fieldsetConnect,
  labelInteraction,
  legendScope,
  partId,
  scopeDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onMounted,
  onUpdated,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { FieldsetScopeKey } from "./context"

interface PartsCtx {
  readonly instance: () => string
  readonly registry: PartRegistry<FieldsetPart>
  readonly disabled: () => boolean
  readonly invalid: () => boolean
  readonly scope: () => FieldsetScope
}
const PartsKey: InjectionKey<PartsCtx> = Symbol("rind-ui.fieldset")
function useParts(part: string): PartsCtx {
  const ctx = inject(PartsKey, null)
  if (!ctx) throw new Error(`Fieldset.${part} must be inside Fieldset.Root`)
  return ctx
}

export interface FieldsetState {
  readonly disabled: boolean
  readonly invalid: boolean
}
type Slots = SlotsType<{ default?: (state: FieldsetState) => VNodeChild }>

const Root = defineComponent({
  name: "FieldsetRoot",
  inheritAttrs: false,
  props: {
    /** Disables every control inside, native and rind-ui (teleported parts too). */
    disabled: Boolean,
    /** Shows the ErrorMessage; never passed to the controls inside. */
    invalid: Boolean,
    id: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const parent = inject(FieldsetScopeKey, null)
    const scope = computed<FieldsetScope>(() => ({
      disabled: props.disabled,
      parent: parent?.value ?? null,
    }))
    const disabled = computed(() => scopeDisabled(scope.value))
    const instance = useRootId(() => props.id)
    // No expected parts: a relation to a Description or ErrorMessage exists only once it is
    // rendered (ark#3707), so the server never points at a missing id.
    const registry = usePartRegistry<FieldsetPart>({ scope: "fieldset", root: instance() })
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    // The server assumes the default markup; after mount, the real first child decides.
    const nativeLegend = shallowRef(true)
    const check = () => {
      measured.value = el.value?.tagName.toLowerCase() ?? null
      const first = el.value?.firstElementChild
      nativeLegend.value =
        first?.tagName === "LEGEND" && first.getAttribute("data-part") === "legend"
    }
    onMounted(check)
    onUpdated(check)
    const ids = {
      legend: useRenderedId(registry, "legend"),
      description: useRenderedId(registry, "description"),
      "error-message": useRenderedId(registry, "error-message"),
    }
    provide(FieldsetScopeKey, scope)
    provide(PartsKey, {
      instance,
      registry,
      disabled: () => disabled.value,
      invalid: () => props.invalid,
      scope: () => scope.value,
    })
    return () => {
      const state = { disabled: disabled.value, invalid: props.invalid }
      const children = slots.default?.(state)
      const api = fieldsetConnect({
        instance: instance(),
        disabled: disabled.value,
        invalid: props.invalid,
        rootTag: renderedTag("fieldset", children, props.asChild, measured.value),
        nativeLegend: nativeLegend.value,
        ids: {
          legend: ids.legend.value,
          description: ids.description.value,
          "error-message": ids["error-message"].value,
        },
        describedBy: attrs["aria-describedby"] as string | undefined,
      })
      const { "aria-describedby": _, ...rest } = attrs
      const merged = mergeProps(
        {
          ...normalizeProps(api.root()),
          ...(props.id === undefined ? {} : { id: props.id }),
          ref: refTo(el),
        },
        rest,
      )
      return renderPart("fieldset", merged, children, props.asChild)
    }
  },
})

const apiOf = (ctx: PartsCtx) =>
  fieldsetConnect({
    instance: ctx.instance(),
    disabled: ctx.disabled(),
    invalid: ctx.invalid(),
    rootTag: "fieldset",
    nativeLegend: true,
    ids: {},
  })

const Legend = defineComponent({
  name: "FieldsetLegend",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useParts("Legend")
    const env = useEnvironment()
    const own = () => props.id ?? partId("fieldset", ctx.instance(), "legend")
    useRegisterPart(ctx.registry, "legend", own)
    const el = shallowRef<Element | null>(null)
    // HTML exempts only the fieldset's first <legend> child. The server assumes the default
    // markup (first); after mount the real position decides.
    const first = shallowRef(true)
    const check = () => {
      const node = el.value
      const legend = node?.parentElement
        ? Array.from(node.parentElement.children).find((c) => c.tagName === "LEGEND")
        : undefined
      first.value = node?.tagName === "LEGEND" && legend === node
    }
    onMounted(check)
    onUpdated(check)
    // HTML: controls in the first legend are exempt from this Fieldset's disabled state.
    provide(
      FieldsetScopeKey,
      computed(() => (first.value ? legendScope(ctx.scope()) : ctx.scope())),
    )
    // A legend activates nothing: only the label double-click selection guard.
    const { onMouseDown } = labelInteraction(env, {
      target: () => null,
      forwardsFocus: () => false,
    })
    return () =>
      renderPart(
        "legend",
        mergeProps(
          {
            ...normalizeProps(apiOf(ctx).legend(own())),
            onMousedown: onMouseDown,
            ref: refTo(el),
          },
          attrs,
        ),
        slots.default?.({ disabled: ctx.disabled(), invalid: ctx.invalid() }),
        props.asChild,
      )
  },
})

const Description = defineComponent({
  name: "FieldsetDescription",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useParts("Description")
    const own = () => props.id ?? partId("fieldset", ctx.instance(), "description")
    useRegisterPart(ctx.registry, "description", own)
    return () =>
      renderPart(
        "p",
        mergeProps(normalizeProps(apiOf(ctx).description(own())), attrs),
        slots.default?.({ disabled: ctx.disabled(), invalid: ctx.invalid() }),
        props.asChild,
      )
  },
})

/** Rendered while the Fieldset is invalid (or with `forceMount`). */
const ErrorMessageShown = defineComponent({
  name: "FieldsetErrorMessageShown",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useParts("ErrorMessage")
    const own = () => props.id ?? partId("fieldset", ctx.instance(), "error-message")
    useRegisterPart(ctx.registry, "error-message", own)
    return () =>
      renderPart(
        "p",
        mergeProps(normalizeProps(apiOf(ctx).errorMessage(own())), attrs),
        slots.default?.({ disabled: ctx.disabled(), invalid: ctx.invalid() }),
        props.asChild,
      )
  },
})

const ErrorMessage = defineComponent({
  name: "FieldsetErrorMessage",
  inheritAttrs: false,
  props: { forceMount: Boolean },
  setup(props, { attrs, slots }) {
    const ctx = useParts("ErrorMessage")
    return () => (ctx.invalid() || props.forceMount ? h(ErrorMessageShown, attrs, slots) : null)
  },
})

/** The parts, by name: `fieldset.parts.ts` re-exports them as the `Fieldset` namespace. */
export { Description, ErrorMessage, Legend, Root }
