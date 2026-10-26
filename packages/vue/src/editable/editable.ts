// Editable (add-editable): a Preview (a button showing the value) that becomes an Input. Enter
// commits (Ctrl/⌘+Enter in a textarea), Escape restores the value at entry, an outside press
// submits or cancels by `submitMode`; a hidden input carries the committed value to forms.

import {
  type ActivationMode,
  activates,
  type ChangeDetails,
  type EditableEvent,
  type EditableMessages,
  type EditableState,
  type EditReason,
  editableConnect,
  editableMachine,
  editableMessages,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  type PartProps,
  partId,
  type SubmitMode,
  watchLeave,
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
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    editable: EditableMessages
  }
}

/** What every part's slot receives. */
export interface EditableRenderState {
  readonly state: EditableState
  readonly editing: boolean
  readonly value: string
  readonly draft: string
}

type Api = ReturnType<typeof editableConnect>

interface Ctx {
  readonly api: () => Api
  readonly send: (event: EditableEvent) => void
  readonly state: () => EditableRenderState
  readonly activationMode: () => ActivationMode
  readonly registry: PartRegistry<"label">
  readonly labelId: () => string
  readonly inputEl: { value: Element | null }
  readonly previewEl: { value: Element | null }
}
const EditableKey: InjectionKey<Ctx> = Symbol("rind-ui.editable")
function useEditable(part: string): Ctx {
  const ctx = inject(EditableKey, null)
  if (!ctx) throw new Error(`Editable.${part} must be inside Editable.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: EditableRenderState) => VNodeChild }>
const asHtml = (el: Element | null) => (el instanceof HTMLElement ? el : null)

const Root = defineComponent({
  name: "EditableRoot",
  inheritAttrs: false,
  props: {
    /** Controlled committed value (`v-model`). */
    modelValue: { type: String, default: undefined },
    /** Uncontrolled committed value. Default "". */
    defaultValue: String,
    /** Controlled edit state (`v-model:edit`). */
    edit: { type: Boolean, default: undefined },
    /** Uncontrolled edit state. Default false. */
    defaultEdit: { type: Boolean, default: undefined },
    /** How the Preview enters edit (Enter and Space always do, except `none`). Default "click". */
    activationMode: { type: String as PropType<ActivationMode>, default: "click" },
    /** Whether an outside press submits (both, blur) or cancels (enter, none). Default "both". */
    submitMode: String as PropType<SubmitMode>,
    /** Select the text on entering edit. Default true. */
    selectOnFocus: { type: Boolean, default: true },
    /** Shown when the value is empty. */
    placeholder: [String, Object] as PropType<string | { edit: string; preview: string }>,
    /** The Input's maximum length. */
    maxLength: Number,
    /** No edit; not submitted. */
    disabled: Boolean,
    /** Shown and submitted; no edit. */
    readonly: Boolean,
    /** An empty value blocks submit. */
    required: Boolean,
    /** Marks the field invalid. */
    invalid: Boolean,
    /** The form field's name. */
    name: String,
    /** The form id, when the Editable is outside it. */
    form: String,
    messages: Object as PropType<MessageOverrides<EditableMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** A commit; `details.event.reason` says how. */
    valueChange: (_value: string, _details: ChangeDetails<EditableEvent>) => true,
    "update:modelValue": (_value: string) => true,
    /** Entering or leaving edit; `details.cancel()` keeps the user where they are. */
    editChange: (_edit: boolean, _details: ChangeDetails<EditableEvent>) => true,
    "update:edit": (_edit: boolean) => true,
    /** Each edit of the draft. */
    draftChange: (_draft: string) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment()
    const messages = useMessages("editable", editableMessages, () => props.messages)
    const registry = usePartRegistry<"label">({ scope: "editable", root: instance() })
    const ownLabel = useRenderedId(registry, "label")
    const ids = () => {
      const i = instance()
      return {
        label: partId("editable", i, "label"),
        preview: partId("editable", i, "preview"),
        input: partId("editable", i, "input"),
        hidden: partId("editable", i, "hidden-input"),
      }
    }
    const rootEl = shallowRef<Element | null>(null)
    const inputEl = shallowRef<Element | null>(null)
    const previewEl = shallowRef<Element | null>(null)
    const hiddenEl = shallowRef<Element | null>(null)
    const formInput = hiddenFormInput(
      { input: () => (hiddenEl.value instanceof HTMLInputElement ? hiddenEl.value : null) },
      env,
    )
    // After the render that shows the Input (or the Preview): the element is not hidden yet now.
    const later = (fn: () => void) => env.scheduler.requestAnimationFrame(fn)
    const { view, send } = useMachine(editableMachine, () => ({
      value: props.modelValue,
      defaultValue: props.defaultValue,
      onValueChange: (v: string, d: ChangeDetails<EditableEvent>) => {
        emit("valueChange", v, d)
        emit("update:modelValue", v)
      },
      edit: props.edit,
      defaultEdit: props.defaultEdit,
      onEditChange: (e: boolean, d: ChangeDetails<EditableEvent>) => {
        emit("editChange", e, d)
        emit("update:edit", e)
      },
      onDraftChange: (d: string) => emit("draftChange", d),
      activationMode: props.activationMode,
      submitMode: props.submitMode,
      disabled: props.disabled,
      readOnly: props.readonly,
      focusInput: () => {
        const entry = current()
        later(() => {
          const el = asHtml(inputEl.value)
          if (!el) return
          void focusSafely(el, env, "programmatic", env.modality.modality())
          // Keys typed in the frame before (Enter on EditTrigger, then typing) are kept.
          if (
            props.selectOnFocus &&
            (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
            el.value === entry
          )
            el.select()
        })
      },
      focusPreview: () =>
        later(() => {
          const el = asHtml(previewEl.value)
          if (el) void focusSafely(el, env, "programmatic", env.modality.modality())
        }),
    }))
    const current = () => view.value.values.value ?? ""
    const api = computed(() =>
      editableConnect(
        {
          instance: instance(),
          state: view.value.state as EditableState,
          value: current(),
          draft: view.value.context.draft,
          placeholder: props.placeholder,
          disabled: props.disabled,
          readOnly: props.readonly,
          required: props.required,
          invalid: props.invalid,
          name: props.name,
          maxLength: props.maxLength,
          messages: messages.value,
          ids: { ...ids(), label: ownLabel.value ?? ids().label },
          rendered: { label: ownLabel.value !== undefined },
        },
        env,
      ),
    )
    // The hidden input mirrors the committed value after every update; a form reset restores it.
    const show = () => formInput.sync({ value: current() }, { dispatch: false })
    onMounted(() => {
      show()
      onBeforeUnmount(
        formInput.track({
          onReset: () => send({ type: "RESET" }),
          current: () => ({ value: current() }),
        }),
      )
      // While editing, a press or focus outside the Root (Area, Control, triggers) is OUTSIDE.
      let stop: (() => void) | undefined
      watch(
        () => api.value.editing,
        (editing) => {
          stop?.()
          stop = undefined
          if (editing && rootEl.value)
            stop = watchLeave(rootEl.value, () => send({ type: "OUTSIDE" }))
        },
        { immediate: true },
      )
      onBeforeUnmount(() => stop?.())
    })
    onUpdated(show)
    const state = (): EditableRenderState => ({
      state: view.value.state as EditableState,
      editing: api.value.editing,
      value: current(),
      draft: view.value.context.draft,
    })
    provide(EditableKey, {
      api: () => api.value,
      send,
      state,
      activationMode: () => props.activationMode,
      registry,
      labelId: () => ids().label,
      inputEl,
      previewEl,
    })
    return () => {
      // The value is written as a property by hiddenFormInput; a reset re-syncs it.
      const { value: _value, ...hidden } = normalizeProps(api.value.hiddenInput())
      return renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
            ref: refTo(rootEl),
          },
          attrs,
        ),
        [
          slots.default?.(state()),
          h("input", {
            ...hidden,
            ...(props.form === undefined ? {} : { form: props.form }),
            ref: refTo(hiddenEl),
          }),
        ],
        props.asChild,
      )
    }
  },
})

/** Focus state with the modality it arrived by. Call in setup. */
function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  return { focused, modality }
}

/** The rendered tag of a part, measured after mount (a `textarea` through `asChild`). */
function useTag() {
  const el = shallowRef<Element | null>(null)
  const measured = shallowRef<string | null>(null)
  const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
  onMounted(measure)
  onUpdated(measure)
  return { el, measured }
}

/** Names the Preview and the Input. */
const Label = defineComponent({
  name: "EditableLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useEditable("Label")
    const own = () => props.id ?? ctx.labelId()
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

function simplePart(name: string, own: (api: Api) => PartProps) {
  return defineComponent({
    name: `Editable${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useEditable(name)
      return () =>
        renderPart(
          "div",
          mergeProps(normalizeProps(own(ctx.api())), attrs),
          slots.default?.(ctx.state()),
          props.asChild,
        )
    },
  })
}

/** The cell the Preview and the Input share (no layout jump). */
const Area = simplePart("Area", (a) => a.area())
/** Groups the triggers. */
const Control = simplePart("Control", (a) => a.control())

/** The value as a button; a press, double-click or focus enters edit by `activationMode`. */
const Preview = defineComponent({
  name: "EditablePreview",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useEditable("Preview")
    const { focused, modality } = useFocus()
    const { el, measured } = useTag()
    const enter = (kind: "press" | "dblclick" | "focus" | "key", reason: EditReason) => {
      if (activates(ctx.activationMode(), kind)) ctx.send({ type: "EDIT", reason })
    }
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.previewEl.value = el.value
    }
    return () => {
      const children = slots.default?.(ctx.state())
      const tag = renderedTag("button", children, props.asChild, measured.value)
      return renderPart(
        "button",
        mergeProps(
          {
            ...joinHandlers(
              normalizeProps(
                ctx.api().preview({ tag, focused: focused.value, modality: modality.value }),
              ),
              {
                onClick: (e: MouseEvent) => {
                  // A click without a pointer (an assistive technology's press) is the key path.
                  if (e.detail === 0) enter("key", "preview-key")
                  else enter("press", "preview-press")
                },
                onDblclick: () => enter("dblclick", "preview-dblclick"),
                onKeydown: (e: KeyboardEvent) => {
                  if (e.key !== "Enter" && e.key !== " ") return
                  // The native button's own click from the key would enter a second time.
                  e.preventDefault()
                  if (!e.repeat) enter("key", "preview-key")
                },
                onFocusin: () => {
                  focused.value = true
                  enter("focus", "preview-focus")
                },
                onFocusout: () => (focused.value = false),
              },
            ),
            ref: setEl,
          },
          attrs,
        ),
        children ?? ctx.api().previewText,
        props.asChild,
      )
    }
  },
})

/** The draft while editing (a textarea through `asChild`). */
const Input = defineComponent({
  name: "EditableInput",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useEditable("Input")
    const { focused, modality } = useFocus()
    const { el, measured } = useTag()
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.inputEl.value = el.value
    }
    return () => {
      const children = slots.default?.(ctx.state())
      const tag = renderedTag("input", children, props.asChild, measured.value)
      return renderPart(
        "input",
        mergeProps(
          {
            ...joinHandlers(
              normalizeProps(ctx.api().input({ focused: focused.value, modality: modality.value })),
              {
                onInput: (e: Event) =>
                  ctx.send({
                    type: "DRAFT",
                    draft: (e.currentTarget as HTMLInputElement).value,
                  }),
                onKeydown: (e: KeyboardEvent) => {
                  // An IME composition's Enter and Escape are the composition's.
                  if (e.isComposing || e.keyCode === 229) return
                  if (e.key === "Enter") {
                    if (tag === "textarea" && !(e.ctrlKey || e.metaKey)) return
                    e.preventDefault()
                    ctx.send({ type: "SUBMIT", reason: "enter-key" })
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    ctx.send({ type: "CANCEL", reason: "escape-key" })
                  }
                },
                onFocusin: () => (focused.value = true),
                onFocusout: () => (focused.value = false),
              },
            ),
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

/** A trigger that sends `event` on press. */
function trigger(
  name: "EditTrigger" | "SubmitTrigger" | "CancelTrigger",
  own: (api: Api, f: Parameters<Api["editTrigger"]>[0]) => PartProps,
  event: EditableEvent,
) {
  return defineComponent({
    name: `Editable${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useEditable(name)
      const { focused, modality } = useFocus()
      const { el, measured } = useTag()
      return () => {
        const children = slots.default?.(ctx.state())
        const tag = renderedTag("button", children, props.asChild, measured.value)
        const native = tag === "button" || tag === "input"
        const api = normalizeProps(
          own(ctx.api(), { tag, focused: focused.value, modality: modality.value }),
        )
        // A consumer name replaces the default one, labelled-by included.
        if (attrs["aria-label"] !== undefined && attrs["aria-labelledby"] === undefined)
          api["aria-labelledby"] = undefined
        return renderPart(
          "button",
          mergeProps(
            {
              ...joinHandlers(api, {
                onClick: () => ctx.send(event),
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

/** Enters edit. */
const EditTrigger = trigger("EditTrigger", (a, f) => a.editTrigger(f), {
  type: "EDIT",
  reason: "edit-trigger",
})
/** Commits the draft. */
const SubmitTrigger = trigger("SubmitTrigger", (a, f) => a.submitTrigger(f), {
  type: "SUBMIT",
  reason: "submit-trigger",
})
/** Restores the value at entry. */
const CancelTrigger = trigger("CancelTrigger", (a, f) => a.cancelTrigger(f), {
  type: "CANCEL",
  reason: "cancel-trigger",
})

/** The parts, by name: `editable.parts.ts` re-exports them as the `Editable` namespace. */
export { Area, CancelTrigger, Control, EditTrigger, Input, Label, Preview, Root, SubmitTrigger }
