// Signature Pad (add-signature-pad): strokes drawn on the Control with Pointer Events
// (`dom/stroke-input`), rendered as SVG paths, mirrored on a hidden form input rendered by Root.

import {
  announcerCapability,
  EMPTY_SIGNATURE,
  exportSignature,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  type PartProps,
  partId,
  preventTouchScribble,
  type SignatureExportOptions,
  type SignaturePadEvent,
  type SignaturePadMessages,
  type SignaturePadState,
  type SignatureValue,
  sanitizeFileName,
  saveBlob,
  signatureFormValue,
  signaturePadConnect,
  signaturePadMachine,
  signaturePadMessages,
  startStroke,
  startsStroke,
  watchFieldsetDisabled,
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
  watch,
} from "vue"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "signature-pad": SignaturePadMessages
  }
}

/** What every part's slot receives. */
export interface SignaturePadRenderState {
  readonly state: SignaturePadState
  readonly value: SignatureValue
  readonly empty: boolean
  readonly strokeCount: number
  readonly disabled: boolean
  readonly readOnly: boolean
  /** The strokes as an image (PNG by default); rejects with `EmptySignatureError` when empty. */
  readonly toBlob: (options?: SignatureExportOptions) => Promise<Blob>
  /** Saves the strokes as a file (PNG by default). */
  readonly download: (fileName?: string, options?: SignatureExportOptions) => Promise<void>
}

interface Ctx {
  readonly api: () => ReturnType<typeof signaturePadConnect>
  readonly send: (event: SignaturePadEvent) => void
  readonly state: () => SignaturePadRenderState
  readonly registry: PartRegistry<"label" | "status">
  readonly ids: () => { readonly label: string; readonly status: string }
  readonly control: { value: Element | null }
}
const SignaturePadKey: InjectionKey<Ctx> = Symbol("rind-ui.signature-pad")
function useSignaturePad(part: string): Ctx {
  const ctx = inject(SignaturePadKey, null)
  if (!ctx) throw new Error(`SignaturePad.${part} must be inside SignaturePad.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: SignaturePadRenderState) => VNodeChild }>
const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)
const asElement = (el: Element | null) => (el instanceof HTMLElement ? el : null)

const Root = defineComponent({
  name: "SignaturePadRoot",
  inheritAttrs: false,
  props: {
    /** The strokes, controlled (`v-model`): `{ width, height, strokes }`. */
    modelValue: { type: Object as PropType<SignatureValue>, default: undefined },
    /** The strokes, uncontrolled. */
    defaultValue: Object as PropType<SignatureValue>,
    /** The form field's name. */
    name: String,
    /** The form id, when the pad is outside it. */
    form: String,
    /** What the form submits: an SVG data URL, or the strokes as JSON. Default "svg". */
    formValue: { type: String as PropType<"svg" | "json">, default: "svg" },
    /** The ink colour inlined in the submitted SVG. Default "#000". */
    inkColor: { type: String, default: "#000" },
    /** An empty pad blocks submit. */
    required: Boolean,
    /** No drawing, not submitted. */
    disabled: Boolean,
    /** Shows and submits the strokes; no drawing, clear or undo. */
    readonly: Boolean,
    /** Shows the pad invalid (a Field sets it too). */
    invalid: Boolean,
    /** Points closer than this to the previous one are dropped (px). Default 1. */
    minDistance: Number,
    messages: Object as PropType<MessageOverrides<SignaturePadMessages>>,
    /** Default: the provider's locale (the announcements' language). */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** When a stroke ends, on clear, undo and form reset; never while drawing. */
    valueChange: (_value: SignatureValue) => true,
    "update:modelValue": (_value: SignatureValue) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const locale = useLocale(() => props.locale)
    const messages = useMessages("signature-pad", signaturePadMessages, () => props.messages)
    const binding = useFieldControl()
    const fieldsetContext = useFieldsetDisabled()
    const fieldsetDom = shallowRef(false)
    const registry = usePartRegistry<"label" | "status">({
      scope: "signature-pad",
      root: instance(),
    })
    const ownLabel = useRenderedId(registry, "label")
    const status = useRenderedId(registry, "status")
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "img",
          labelable: false,
          disabled: props.disabled || fieldsetContext.value || fieldsetDom.value,
          readOnly: props.readonly,
          required: props.required,
          invalid: props.invalid,
          name: props.name,
        },
        binding?.value ?? null,
      ),
    )
    const ids = () => {
      const i = instance()
      return {
        label: partId("signature-pad", i, "label"),
        control: partId("signature-pad", i, "control"),
        status: partId("signature-pad", i, "status"),
        input: partId("signature-pad", i, "hidden-input"),
      }
    }
    const input = shallowRef<Element | null>(null)
    const control = shallowRef<Element | null>(null)
    const formInput = hiddenFormInput(
      { input: () => asInput(input.value), control: () => asElement(control.value) },
      env,
    )
    const encode = (v: SignatureValue) => signatureFormValue(v, props.formValue, props.inkColor)
    let lastUser = false
    const { view, send } = useMachine(
      signaturePadMachine,
      () => ({
        value: props.modelValue,
        defaultValue: props.defaultValue,
        onValueChange: (next: SignatureValue) => {
          lastUser = true
          emit("valueChange", next)
          emit("update:modelValue", next)
        },
        disabled: field.value.disabled,
        readOnly: field.value.readOnly,
        minDistance: props.minDistance,
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
      }),
      {
        ...env,
        syncInput: (v: SignatureValue, dispatch: boolean) =>
          formInput.sync({ value: encode(v) }, { dispatch }),
      },
    )
    const current = () => view.value.values.value ?? EMPTY_SIGNATURE
    const api = computed(() => {
      const labelId = binding?.value.ids.label ?? ownLabel.value
      return signaturePadConnect(
        {
          instance: instance(),
          state: view.value.state,
          value: current(),
          stroke: view.value.context.stroke,
          messages: messages.value,
          ids: { ...ids(), label: labelId ?? ids().label },
          rendered: { label: labelId !== undefined, status: status.value !== undefined },
          disabled: field.value.disabled,
          readOnly: field.value.readOnly,
          required: field.value.required,
          invalid: field.value.invalid,
          name: field.value.name,
          form: props.form,
          formValue: props.formValue,
          inkColor: props.inkColor,
          describedBy: field.value["aria-describedby"],
        },
        env,
      )
    })
    // After every update: the input shows the value (hydration, a parent's change); no events.
    const show = () => formInput.sync({ value: encode(current()) }, { dispatch: false })
    onMounted(() => {
      show()
      const node = input.value
      if (node) {
        const w = watchFieldsetDisabled(node, (d) => (fieldsetDom.value = d))
        fieldsetDom.value = w.disabled
        onBeforeUnmount(w.stop)
      }
      onBeforeUnmount(
        formInput.track({
          onReset: () => send({ type: "RESET" }),
          current: () => ({ value: encode(current()) }),
        }),
      )
      // field-control: the Control takes focus; the hidden input is the validity element.
      if (binding) {
        const id = ids().control
        onBeforeUnmount(
          binding.value.register(
            {
              id,
              labelable: false,
              focus: (m) => {
                const el = asElement(control.value)
                if (el) void focusSafely(el, env, "programmatic", m)
              },
              validityElement: () => asInput(input.value),
              value: current,
            },
            id,
          ),
        )
      }
      let reported = current()
      watch(current, (now) => {
        if (reported === now) return
        reported = now
        const user = lastUser
        lastUser = false
        binding?.value.report({ type: "change", value: now, user, composing: false })
        if (user) binding?.value.report({ type: "commit" })
      })
    })
    onUpdated(show)
    const toBlob = (options: SignatureExportOptions = {}) => {
      const el = asElement(control.value)
      const color = el ? getComputedStyle(el).color : props.inkColor
      return exportSignature(current(), {
        ...options,
        color,
        ...(el ? { doc: el.ownerDocument } : {}),
      })
    }
    const download = async (fileName = "signature.png", options: SignatureExportOptions = {}) => {
      const blob = await toBlob(options)
      const doc = control.value?.ownerDocument ?? document
      saveBlob(doc, blob, sanitizeFileName(fileName, "signature.png"))
    }
    const state = (): SignaturePadRenderState => ({
      state: view.value.state,
      value: current(),
      empty: api.value.empty,
      strokeCount: api.value.strokeCount,
      disabled: field.value.disabled,
      readOnly: field.value.readOnly,
      toBlob,
      download,
    })
    provide(SignaturePadKey, {
      api: () => api.value,
      send,
      state,
      registry,
      ids: () => ({ label: ids().label, status: ids().status }),
      control,
    })
    return () => {
      // The input's value is written as a property by hiddenFormInput; a reset re-syncs it.
      const { value: _value, ...hidden } = normalizeProps(api.value.hiddenInput())
      return renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          { ...binding?.value.data, ...attrs },
        ),
        [slots.default?.(state()), h("input", { ...hidden, ref: refTo(input) })],
        props.asChild,
      )
    }
  },
})

/** A part with no props of its own, its attributes from `part`. */
function simplePart(name: string, tag: "div", part: (api: ReturnType<Ctx["api"]>) => PartProps) {
  return defineComponent({
    name: `SignaturePad${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useSignaturePad(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(part(ctx.api())), attrs),
          slots.default?.(ctx.state()),
          props.asChild,
        )
    },
  })
}

const Guide = simplePart("Guide", "div", (api) => api.guide())

const Label = defineComponent({
  name: "SignaturePadLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSignaturePad("Label")
    const own = () => props.id ?? ctx.ids().label
    useRegisterPart(ctx.registry, "label", own)
    return () =>
      renderPart(
        "span",
        mergeProps({ ...normalizeProps(ctx.api().label()), id: own() }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Status = defineComponent({
  name: "SignaturePadStatus",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSignaturePad("Status")
    const own = () => props.id ?? ctx.ids().status
    useRegisterPart(ctx.registry, "status", own)
    return () =>
      renderPart(
        "span",
        mergeProps({ ...normalizeProps(ctx.api().status()), id: own() }, attrs),
        slots.default?.(ctx.state()) ?? ctx.api().statusText,
        props.asChild,
      )
  },
})

const Control = defineComponent({
  name: "SignaturePadControl",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSignaturePad("Control")
    let stop: (() => void) | null = null
    let undoScribble: (() => void) | null = null
    onMounted(() => {
      const el = asElement(ctx.control.value)
      if (el) undoScribble = preventTouchScribble(el)
    })
    onBeforeUnmount(() => {
      undoScribble?.()
      stop?.()
    })
    const onPointerdown = (e: PointerEvent) => {
      const s = ctx.state()
      if (!startsStroke(e) || s.disabled || s.readOnly || s.state === "drawing") return
      // A press on a trigger inside the Control is the trigger's, not a stroke.
      if ((e.target as Element).closest?.("button, [role='button']")) return
      e.preventDefault()
      stop?.()
      stop = startStroke(e.currentTarget as HTMLElement, e, (m) => {
        if (m.type === "down") {
          ctx.send({ type: "POINTER.DOWN", pointerId: m.pointerId, point: m.point, box: m.box })
        } else if (m.type === "move") {
          ctx.send({ type: "POINTER.MOVE", pointerId: m.pointerId, points: m.points })
        } else {
          stop = null
          ctx.send({
            type: m.type === "up" ? "POINTER.UP" : "POINTER.CANCEL",
            pointerId: m.pointerId,
          })
        }
      })
    }
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(ctx.api().control()), { onPointerdown }),
            ref: refTo(ctx.control),
          },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Segment = defineComponent({
  name: "SignaturePadSegment",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSignaturePad("Segment")
    return () => {
      const api = ctx.api()
      return renderPart(
        "svg",
        mergeProps(normalizeProps(api.segment()), attrs),
        [
          // Strokes only grow at the end or shrink from it: the index is their identity.
          ...api.paths.map((d, i) => h("path", { key: i, ...normalizeProps(api.stroke(d)) })),
          slots.default?.(ctx.state()),
        ],
        props.asChild,
      )
    }
  },
})

function trigger(part: "ClearTrigger" | "UndoTrigger", event: "CLEAR" | "UNDO") {
  return defineComponent({
    name: `SignaturePad${part}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useSignaturePad(part)
      const env = useEnvironment()
      // Tracks the modality from mount, so the first keyboard focus is already visible.
      onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
      const focused = shallowRef(false)
      const modality = useModality(env.modality, () => focused.value)
      const el = shallowRef<Element | null>(null)
      const measured = shallowRef<string | null>(null)
      const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
      onMounted(measure)
      onUpdated(measure)
      return () => {
        const children = slots.default?.(ctx.state())
        const tag = renderedTag("button", children, props.asChild, measured.value)
        const own = part === "ClearTrigger" ? ctx.api().clearTrigger : ctx.api().undoTrigger
        const api = normalizeProps(own({ tag, focused: focused.value, modality: modality.value }))
        // A consumer name replaces the default one, labelled-by included.
        if (attrs["aria-label"] !== undefined && attrs["aria-labelledby"] === undefined)
          api["aria-labelledby"] = undefined
        const native = tag === "button" || tag === "input"
        return renderPart(
          "button",
          mergeProps(
            {
              ...joinHandlers(api, {
                // Disabled but focusable (aria-disabled): the machine ignores it; focus stays.
                onClick: () => ctx.send({ type: event }),
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
              ref: refTo(el),
            },
            attrs,
          ),
          children,
          props.asChild,
        )
      }
    },
  })
}

const ClearTrigger = trigger("ClearTrigger", "CLEAR")
const UndoTrigger = trigger("UndoTrigger", "UNDO")

/** The parts, by name: `signature-pad.parts.ts` re-exports them as the `SignaturePad` namespace. */
export { ClearTrigger, Control, Guide, Label, Root, Segment, Status, UndoTrigger }
