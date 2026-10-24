import {
  announcerCapability,
  type ClipboardCopyDetails,
  type ClipboardCopyState,
  type ClipboardMessages,
  type ClipboardEvent as CopyEvent,
  clipboardCapability,
  clipboardConnect,
  clipboardInputCopy,
  clipboardMachine,
  clipboardMessages,
  type MessageOverrides,
  partId,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
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
  type VNodeChild,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useIcon, useLocale, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    clipboard: ClipboardMessages
  }
}

/** What every part's slot receives. */
export interface ClipboardRenderState {
  readonly copyState: ClipboardCopyState
  readonly value: string
}

interface Ctx {
  readonly api: () => ReturnType<typeof clipboardConnect>
  readonly send: (event: CopyEvent) => void
  readonly state: () => ClipboardRenderState
  readonly copyAnchor: { value: Element | null }
  readonly registry: PartRegistry<"label" | "input">
  readonly ids: () => { readonly label: string; readonly input: string }
}
const ClipboardKey: InjectionKey<Ctx> = Symbol("rind-ui.clipboard")
function useClipboard(part: string): Ctx {
  const ctx = inject(ClipboardKey, null)
  if (!ctx) throw new Error(`Clipboard.${part} must be inside Clipboard.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: ClipboardRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "ClipboardRoot",
  inheritAttrs: false,
  props: {
    /** What a press copies; read when the write starts. */
    value: { type: String, required: true },
    /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
    copyFeedbackDuration: Number,
    disabled: Boolean,
    /** With text in the Trigger, set `copy` to that text (label in name). */
    messages: Object as PropType<MessageOverrides<ClipboardMessages>>,
    /** Default: the provider's locale (the announcement's language). */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** Once per result, after the write settled (or the Input's own copy). */
    copy: (_details: ClipboardCopyDetails) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability, clipboardCapability)
    const messages = useMessages("clipboard", clipboardMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const registry = usePartRegistry<"label" | "input">({ scope: "clipboard", root: instance() })
    const copyAnchor = shallowRef<Element | null>(null)
    const { view, send } = useMachine(
      clipboardMachine,
      () => ({
        value: props.value,
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
        copyFeedbackDuration: props.copyFeedbackDuration,
        disabled: props.disabled,
        onCopy: (d: ClipboardCopyDetails) => emit("copy", d),
        getCopyAnchor: () => (copyAnchor.value instanceof HTMLElement ? copyAnchor.value : null),
      }),
      env,
    )
    const ids = () => ({
      label: partId("clipboard", instance(), "label"),
      input: partId("clipboard", instance(), "input"),
      trigger: partId("clipboard", instance(), "trigger"),
    })
    const labelId = useRenderedId(registry, "label")
    const inputId = useRenderedId(registry, "input")
    const state = (): ClipboardRenderState => ({ copyState: view.value.state, value: props.value })
    const api = computed(() =>
      clipboardConnect(
        {
          instance: instance(),
          state: view.value.state,
          value: props.value,
          disabled: props.disabled,
          messages: messages.value,
          ids: {
            label: labelId.value ?? ids().label,
            input: inputId.value ?? ids().input,
            trigger: ids().trigger,
          },
          rendered: { label: labelId.value !== undefined, input: inputId.value !== undefined },
        },
        env,
      ),
    )
    provide(ClipboardKey, { api: () => api.value, send, state, copyAnchor, registry, ids })
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
        slots.default?.(state()),
        props.asChild,
      )
  },
})

const Label = defineComponent({
  name: "ClipboardLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useClipboard("Label")
    const own = () => props.id ?? ctx.ids().label
    useRegisterPart(ctx.registry, "label", own)
    return () =>
      renderPart(
        "label",
        mergeProps({ ...normalizeProps(ctx.api().label()), id: own() }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Control = defineComponent({
  name: "ClipboardControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useClipboard("Control")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().control()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** Focus state with the modality it arrived by (keyboard focus shows the ring). Call in setup. */
function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  return { env, focused, modality }
}

const Input = defineComponent({
  name: "ClipboardInput",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  setup(props, { attrs }) {
    const ctx = useClipboard("Input")
    const own = () => props.id ?? ctx.ids().input
    useRegisterPart(ctx.registry, "input", own)
    const { env, focused, modality } = useFocus()
    // The pointer press that focuses the Input selects the whole value after its mouseup (which
    // would collapse a selection made on focus, in Safari and Chrome); later presses keep the
    // native selection.
    let selectOnUp = false
    const asInput = (t: EventTarget | null) => (t instanceof HTMLInputElement ? t : null)
    return () =>
      renderPart(
        "input",
        mergeProps(
          {
            ...joinHandlers(
              normalizeProps(ctx.api().input({ focused: focused.value, modality: modality.value })),
              {
                onPointerdown: (e: PointerEvent) => {
                  if (document.activeElement !== e.currentTarget) selectOnUp = true
                },
                onMouseup: (e: MouseEvent) => {
                  if (!selectOnUp) return
                  selectOnUp = false
                  e.preventDefault()
                  asInput(e.currentTarget)?.select()
                },
                onFocusin: (e: FocusEvent) => {
                  focused.value = true
                  if (env.modality.modality() !== "pointer" && env.modality.modality() !== "touch")
                    asInput(e.currentTarget)?.select()
                },
                onFocusout: () => {
                  focused.value = false
                  selectOnUp = false
                },
                onCopy: (e: Event) => {
                  const input = asInput(e.currentTarget)
                  if (!input) return
                  ctx.send(
                    clipboardInputCopy({
                      value: input.value,
                      selectionStart: input.selectionStart,
                      selectionEnd: input.selectionEnd,
                    }),
                  )
                },
              },
            ),
            id: own(),
          },
          attrs,
        ),
        undefined,
        props.asChild,
      )
  },
})

const Trigger = defineComponent({
  name: "ClipboardTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useClipboard("Trigger")
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.copyAnchor.value = el.value
    }
    const { focused, modality } = useFocus()
    return () => {
      const children = slots.default?.(ctx.state())
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const api = normalizeProps(
        ctx.api().trigger({ focused: focused.value, modality: modality.value, tag }),
      )
      // A consumer name replaces the default one, labelled-by included (spec "Trigger Name").
      if (attrs["aria-label"] !== undefined && attrs["aria-labelledby"] === undefined)
        api["aria-labelledby"] = undefined
      const native = tag === "button" || tag === "input"
      return renderPart(
        "button",
        mergeProps(
          {
            ...joinHandlers(api, {
              // The write starts in the click's task (WebKit's user-activation rule); an assistive
              // technology press is a bare click too.
              onClick: () => ctx.send({ type: "COPY" }),
              // A substituted non-button element: Enter and Space click it, as a button would.
              onKeydown: (e: KeyboardEvent) => {
                if (native || e.repeat) return
                if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
                if (e.key === " ") e.preventDefault()
              },
              onKeyup: (e: KeyboardEvent) => {
                if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
              },
              onFocusin: () => (focused.value = true),
              onFocusout: () => (focused.value = false),
            }),
            ref: setEl,
          },
          attrs,
        ),
        children,
        props.asChild,
      )
    }
  },
})

const Indicator = defineComponent({
  name: "ClipboardIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    default?: (state: ClipboardRenderState) => VNodeChild
    /** Rendered while copied (else the default slot). */
    copied?: (state: ClipboardRenderState) => VNodeChild
    /** Rendered on error (else the default slot). */
    failed?: (state: ClipboardRenderState) => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const ctx = useClipboard("Indicator")
    const icons = { copy: useIcon("copy"), check: useIcon("check"), x: useIcon("x") }
    return () => {
      const s = ctx.state()
      const copyState = s.copyState
      const own =
        copyState === "copied"
          ? (slots.copied ?? slots.default)?.(s)
          : copyState === "error"
            ? (slots.failed ?? slots.default)?.(s)
            : slots.default?.(s)
      // Else the provider's icon for the state (Copy, Check, X); else nothing: the theme draws it.
      const icon =
        icons[copyState === "copied" ? "check" : copyState === "error" ? "x" : "copy"].value
      return renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().indicator()), attrs),
        own !== undefined && own !== null ? own : icon ? h(icon) : null,
        props.asChild,
      )
    }
  },
})

const ValueText = defineComponent({
  name: "ClipboardValueText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useClipboard("ValueText")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().valueText()), attrs),
        slots.default?.(ctx.state()) ?? ctx.state().value,
        props.asChild,
      )
  },
})

/** The parts, by name: `clipboard.parts.ts` re-exports them as the `Clipboard` namespace. */
export { Control, Indicator, Input, Label, Root, Trigger, ValueText }
