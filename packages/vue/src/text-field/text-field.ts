import {
  announcerCapability,
  autosize as attachAutosize,
  defaultCount,
  type FieldMessages,
  focusSafely,
  injectStyle,
  type MessageOverrides,
  mergeFieldProps,
  type TextFieldDetails,
  type TextFieldMessages,
  type TextFieldOwnEvent,
  type TextFieldReason,
  type TextFieldSubmitDetails,
  textFieldCancelStyle,
  textFieldConnect,
  textFieldKeysConnect,
  textFieldMachine,
  textFieldMessages,
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
import { fieldRootProps, useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"
import {
  type TextFieldVisibilityDetails,
  visibilityAfterRender,
  visibilityInputProps,
  visibilityMachineProps,
  visibilityRootData,
} from "./visibility"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    "text-field": TextFieldMessages
  }
}

interface CountState {
  readonly id: string
  readonly max: number | undefined
  readonly count: ((value: string) => number) | undefined
}

type Service = ReturnType<typeof useMachine<typeof textFieldMachine>>

/** The host's state, for the parts (and the visibility helpers). */
export interface TextFieldHostContext {
  /** The Root's own props that are not Field props (type, visibility, keys). */
  readonly own: () => {
    readonly type?: string | undefined
    readonly visible?: boolean | undefined
    readonly defaultVisible?: boolean | undefined
    readonly escapeClears?: boolean | undefined
  }
  readonly mounted: { readonly clearTriggers: number; readonly triggers: number }
  readonly setMounted: (part: "clearTriggers" | "triggers", delta: 1 | -1) => void
  readonly scope: string
  readonly instance: () => string
  readonly view: () => Service["view"]["value"]
  readonly send: Service["send"]
  readonly controlled: () => boolean
  readonly defaultValue: () => string | undefined
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly messages: () => TextFieldMessages
  readonly limit: () => number | undefined
  readonly count: () => ((value: string) => number) | undefined
  readonly countId: () => string | undefined
  /** Writes the soft-limit validity for `value` (before the Field sees the change). */
  readonly applySoftLimit: (value: string) => void
  readonly setCount: (state: CountState | null) => void
  readonly setMaxLength: (n: number | undefined) => void
  readonly controlEl: { current: HTMLInputElement | HTMLTextAreaElement | null }
  /** The control's id once rendered (a preset's `aria-controls`). */
  readonly controlId: () => string | undefined
  readonly setControlId: (id: string | undefined) => void
  readonly pendingSelection: { current: readonly [number, number] | null }
  readonly takeReason: () => TextFieldReason | undefined
  readonly controls: { current: number }
}

const TextFieldKey: InjectionKey<TextFieldHostContext> = Symbol("rind-ui.text-field")
/** A part's access to its host (`part` names it in the error). */
export function useTextFieldHost(part: string): TextFieldHostContext {
  const ctx = inject(TextFieldKey, null)
  if (!ctx) throw new Error(`${part} must be inside its Root`)
  return ctx
}

function keys(ctx: TextFieldHostContext) {
  return textFieldKeysConnect(
    {
      value: ctx.view().values.value ?? "",
      composing: ctx.view().state === "composing",
      search: ctx.own().type === "search",
      customClear: ctx.mounted.clearTriggers > 0,
    },
    // Sound: the Text Field machine accepts ESCAPE and SUBMIT (its key preset).
    ctx.send as unknown as (event: TextFieldOwnEvent) => void,
  )
}

const Root = defineComponent({
  name: "TextFieldRoot",
  inheritAttrs: false,
  props: {
    ...fieldRootProps,
    /**
     * The Input's native type. `"password"`: the visibility parts and rules (hidden on submit
     * and reset, caret kept, privacy attributes); `"search"`: a searchbox, "Clear search",
     * Escape clears.
     */
    type: String,
    /** `type="password"`: controlled visibility (`v-model:visible`). */
    visible: { type: Boolean, default: undefined },
    defaultVisible: { type: Boolean, default: undefined },
    /** Escape clears a non-empty editable value (default: true for `type="search"`). */
    escapeClears: { type: Boolean, default: undefined },
    /** Controlled value (`v-model`). */
    modelValue: { type: String as PropType<string | null>, default: undefined },
    defaultValue: String,
    /** Disabled but focusable: read-only + aria-disabled; nothing changes the value. */
    focusableWhenDisabled: Boolean,
    /** Announce the count when this many or fewer characters remain. */
    countThreshold: Number,
    messages: Object as PropType<MessageOverrides<TextFieldMessages>>,
    fieldMessages: Object as PropType<MessageOverrides<FieldMessages>>,
  },
  emits: {
    valueChange: (_value: string, _details: TextFieldDetails) => true,
    "update:modelValue": (_value: string) => true,
    visibleChange: (_visible: boolean, _details: TextFieldVisibilityDetails) => true,
    "update:visible": (_visible: boolean) => true,
    /** Enter (not composing). The form still submits unless `details.event` is prevented. */
    submit: (_value: string, _details: TextFieldSubmitDetails) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const scope = "text-field"
    const env = useEnvironment(announcerCapability)
    const generated = useId()
    const instance = () => props.id ?? generated
    const messages = useMessages("text-field", textFieldMessages, () => props.messages)
    const enclosing = useFieldBindingPeek()
    const fieldsetDisabled = useFieldsetDisabled()
    const disabled = () =>
      props.disabled || enclosing?.value.state.disabled === true || fieldsetDisabled.value
    const readOnly = () => props.readonly || enclosing?.value.state.readOnly === true
    const countState = shallowRef<CountState | null>(null)
    const maxLength = shallowRef<number | undefined>(undefined)
    const limit = () => maxLength.value ?? countState.value?.max
    const controlEl: TextFieldHostContext["controlEl"] = { current: null }
    let reason: TextFieldReason | undefined
    const controls = { current: 0 }
    const pendingSelection: TextFieldHostContext["pendingSelection"] = { current: null }
    const controlId = shallowRef<string | undefined>(undefined)
    const mounted = shallowRef({ clearTriggers: 0, triggers: 0 })
    const own = () => ({
      type: props.type,
      visible: props.visible,
      defaultVisible: props.defaultVisible,
      escapeClears: props.escapeClears,
    })
    const { view, send } = useMachine(
      textFieldMachine,
      () => ({
        ...visibilityMachineProps(
          own(),
          { controlEl, env, pendingSelection },
          (visible, details) => {
            emit("visibleChange", visible, details)
            emit("update:visible", visible)
          },
        ),
        escapeClears: props.escapeClears ?? props.type === "search",
        onSubmit: (value: string, details: TextFieldSubmitDetails) =>
          emit("submit", value, details),
        value: props.modelValue === undefined ? undefined : (props.modelValue ?? ""),
        defaultValue: props.defaultValue ?? "",
        onValueChange: (v: string, details: unknown) => {
          // Machine details → the public ones (reason, native event, isComposing).
          const e = (
            details as {
              event: { type: string; reason?: string; event?: Event | null; composing?: boolean }
            }
          ).event
          const pub = {
            reason: e.type === "RESET" ? "RESET" : (e.reason ?? "INPUT"),
            event: e.event ?? null,
            isComposing: e.composing === true,
          } as TextFieldDetails
          emit("valueChange", v, pub)
          emit("update:modelValue", v)
        },
        disabled: disabled(),
        readOnly: readOnly(),
        focusableWhenDisabled: props.focusableWhenDisabled,
        limit: limit(),
        threshold: props.countThreshold,
        count: countState.value?.count,
        messages: messages.value,
        id: instance(),
        // The only DOM write: the native setter, then one bubbling `input` event, which comes
        // back as an ordinary INPUT carrying this reason (base-ui#4643).
        clearInput: (why: TextFieldReason, focus: boolean) => {
          const el = controlEl.current
          if (!el) return
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set
          reason = why
          setter?.call(el, "")
          el.dispatchEvent(new Event("input", { bubbles: true }))
          reason = undefined
          if (focus && el.ownerDocument.activeElement !== el)
            void focusSafely(el, env, "programmatic")
        },
      }),
      env,
    )
    const modality = useModality(env.modality, () => view.value.context.focused)
    // Exactly one Input or Textarea (development error otherwise).
    onMounted(() => {
      if (process.env.NODE_ENV !== "production" && controls.current !== 1) {
        console.error(
          `[rind-ui] text-field: renders ${controls.current} Input/Textarea parts; exactly one is required.`,
        )
      }
    })
    // A soft limit is a control-owned validity message (the Field displays it), written from
    // the new value synchronously, before the change is reported.
    let softSet = false
    const applySoftLimit = (next: string) => {
      const el = controlEl.current
      const max = countState.value?.max
      if (!el || max === undefined) return
      const used = (countState.value?.count ?? defaultCount)(next)
      if (used > max) {
        el.setCustomValidity(messages.value.charactersOver(used - max))
        softSet = true
      } else if (softSet) {
        el.setCustomValidity("")
        softSet = false
      }
    }
    const ctx: TextFieldHostContext = {
      own,
      get mounted() {
        return mounted.value
      },
      setMounted: (part, delta) => {
        mounted.value = { ...mounted.value, [part]: mounted.value[part] + delta }
      },
      scope,
      instance,
      view: () => view.value,
      send,
      controlled: () => props.modelValue !== undefined,
      defaultValue: () => props.defaultValue,
      disabled,
      readOnly,
      focusableWhenDisabled: () => props.focusableWhenDisabled,
      messages: () => messages.value,
      limit,
      count: () => countState.value?.count,
      countId: () => countState.value?.id,
      applySoftLimit,
      setCount: (state) => (countState.value = state),
      setMaxLength: (n) => (maxLength.value = n),
      controlEl,
      controlId: () => controlId.value,
      setControlId: (id) => (controlId.value = id),
      pendingSelection,
      takeReason: () => reason,
      controls,
    }
    provide(TextFieldKey, ctx)
    onMounted(() => visibilityAfterRender(ctx))
    onUpdated(() => visibilityAfterRender(ctx))
    return () => {
      const focused = view.value.context.focused
      const rootData = {
        "data-focus": focused ? "" : undefined,
        "data-focus-visible":
          focused && modality.value !== "pointer" && modality.value !== "touch" ? "" : undefined,
        "data-composing": view.value.matches("composing") ? "" : undefined,
        ...keys(ctx).root(),
        ...visibilityRootData(ctx),
      }
      const field = Object.fromEntries(
        Object.keys(fieldRootProps)
          .filter((k) => k !== "messages")
          .map((k) => [k, (props as Record<string, unknown>)[k]]),
      )
      return h(
        FieldHost,
        {
          ...attrs,
          ...field,
          scope,
          id: instance(),
          ...(props.fieldMessages ? { messages: props.fieldMessages } : {}),
          ...rootData,
        },
        slots,
      )
    }
  },
})

/** The control's attributes the part reads by name (forwarded to `mergeFieldProps`). */
function useControl(
  part: "input" | "textarea",
  props: { id?: string | undefined },
  attrs: Readonly<Record<string, unknown>>,
) {
  const ctx = useTextFieldHost(part === "input" ? "Input" : "Textarea")
  const binding = useFieldControl()
  const env = useEnvironment()
  const generated = useId()
  const controlId = () => props.id ?? binding?.value.controlId ?? generated
  const el = shallowRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  ctx.controls.current += 1
  onBeforeUnmount(() => {
    ctx.controls.current -= 1
  })
  const maxlength = () => {
    const v = attrs["maxlength"]
    return v === undefined ? undefined : Number(v)
  }
  // After mount, like React's layout effects: the server render does not know them yet.
  onMounted(() => {
    watch(maxlength, (n) => ctx.setMaxLength(n), { immediate: true })
    watch(controlId, (id) => ctx.setControlId(id), { immediate: true })
  })
  let unregister: (() => void) | undefined
  onMounted(() => {
    ctx.controlEl.current = el.value
    // autoFocus: focused before the handlers ran (base-ui#3172).
    if (el.value && el.value.ownerDocument.activeElement === el.value) {
      ctx.send({ type: "FOCUS", modality: env.modality.modality() })
    }
    watch(
      controlId,
      (id) => {
        unregister?.()
        unregister = binding?.value.register(
          {
            id,
            labelable: true,
            focus: (modality) => {
              if (el.value) void focusSafely(el.value, env, "programmatic", modality)
            },
            validityElement: () => el.value,
            value: () => el.value?.value ?? "",
          },
          id,
        )
      },
      { immediate: true },
    )
    // Development: the placeholder is never a name; a control needs a Label or an ARIA name.
    const node = el.value
    if (process.env.NODE_ENV !== "production" && node) {
      const named =
        (node.labels?.length ?? 0) > 0 ||
        node.hasAttribute("aria-label") ||
        node.hasAttribute("aria-labelledby")
      if (!named) {
        console.warn(
          `[rind-ui] ${ctx.scope}: the ${part} has no accessible name (a placeholder is not one); render a Label or pass aria-label / aria-labelledby.`,
        )
      }
    }
    // A form reset: the DOM value is re-read once the reset ran (the latest defaultValue).
    const form = el.value?.form
    if (form) {
      const onReset = (e: Event) =>
        env.scheduler.setTimeout(() => {
          if (!e.defaultPrevented && el.value) ctx.send({ type: "RESET", value: el.value.value })
        }, 0)
      form.addEventListener("reset", onReset)
      onBeforeUnmount(() => form.removeEventListener("reset", onReset))
    }
  })
  onBeforeUnmount(() => unregister?.())
  const modality = useModality(env.modality, () => ctx.view().context.focused)
  // The value the Field last heard of: a parent's controlled change is reported too (not a
  // user change), so its validity and data-filled follow (react-spectrum#8659).
  let reported: string | null = null
  watch(
    () => ctx.view().values.value ?? "",
    (current) => {
      if (!ctx.controlled() || !binding) return
      if (reported === null || reported === current) {
        reported = current
        return
      }
      reported = current
      binding.value.report({ type: "change", value: current, user: false, composing: false })
    },
    { immediate: true, flush: "post" },
  )
  const render = () => {
    const {
      required,
      name,
      maxlength: _max,
      "aria-describedby": describedBy,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      ...rest
    } = attrs
    const field = mergeFieldProps(
      {
        role: "textbox",
        labelable: true,
        disabled: ctx.disabled(),
        readOnly: ctx.readOnly(),
        required: required === "" || required === true,
        name: name as string | undefined,
        consumerDescribedBy: describedBy as string | undefined,
        ariaLabel: ariaLabel as string | undefined,
        ariaLabelledBy: ariaLabelledBy as string | undefined,
      },
      binding?.value ?? null,
    )
    const api = textFieldConnect(
      {
        scope: ctx.scope,
        instance: ctx.instance(),
        state: ctx.view().state,
        value: ctx.view().values.value ?? "",
        controlled: ctx.controlled(),
        defaultValue: ctx.defaultValue(),
        focused: ctx.view().context.focused,
        modality: modality.value,
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        field,
        fieldData: binding?.value.data ?? {},
        controlId: controlId(),
        countId: ctx.countId(),
        limit: ctx.limit(),
        count: ctx.count(),
        clearLabel: ctx.own().type === "search" ? ctx.messages().clearSearch : ctx.messages().clear,
      },
      {
        send: ctx.send,
        report: (event) => {
          if (event.type === "change") {
            ctx.applySoftLimit(String(event.value))
            reported = String(event.value)
          }
          binding?.value.report(event)
        },
        takeReason: ctx.takeReason,
      },
    )
    const own = normalizeProps({
      ...api.control(part),
      maxlength: maxlength(),
      "aria-label": ariaLabel,
    })
    const type = ctx.own().type as string | undefined
    // The preset's input attributes win; its handlers run after Text Field's.
    const preset = normalizeProps({
      ...(type !== undefined && type !== "password" && type !== "search" ? { type } : {}),
      ...keys(ctx).input(),
      ...visibilityInputProps(ctx),
    })
    const merged = mergeProps(
      {
        ...joinHandlers(own, preset),
        ref: refTo(el),
      },
      rest,
    )
    return { merged, composing: api.composing }
  }
  return { render, el, ctx }
}

type ControlSlots = SlotsType<{ default?: (state: { composing: boolean }) => VNodeChild }>

const Input = defineComponent({
  name: "TextFieldInput",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as ControlSlots,
  setup(props, { attrs, slots }) {
    const control = useControl("input", props, attrs)
    return () => {
      const { merged, composing } = control.render()
      return renderPart("input", merged, slots.default?.({ composing }), props.asChild)
    }
  },
})

const Textarea = defineComponent({
  name: "TextFieldTextarea",
  inheritAttrs: false,
  props: {
    id: String,
    /** Grows with its content. */
    autosize: Boolean,
    ...asChildProp,
  },
  slots: Object as ControlSlots,
  setup(props, { attrs, slots }) {
    const control = useControl("textarea", props, attrs)
    const env = useEnvironment()
    let handle: ReturnType<typeof attachAutosize> | null = null
    onMounted(() => {
      watch(
        () => props.autosize,
        (on) => {
          handle?.dispose()
          handle = null
          if (on && control.el.value instanceof HTMLTextAreaElement)
            handle = attachAutosize(control.el.value, env)
        },
        { immediate: true },
      )
      // Every value commit (controlled, programmatic, reset) re-measures (kobalte#484).
      watch(
        () => control.ctx.view().values.value,
        () => handle?.measure(),
        { flush: "post" },
      )
    })
    onBeforeUnmount(() => handle?.dispose())
    return () => {
      const { merged, composing } = control.render()
      return renderPart("textarea", merged, slots.default?.({ composing }), props.asChild)
    }
  },
})

/** The ClearTrigger; with `type="search"`, the browser's own cancel button is hidden meanwhile. */
const ClearTrigger = defineComponent({
  name: "TextFieldClearTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs, slots }) {
    const ctx = useTextFieldHost("TextField.ClearTrigger")
    const env = useEnvironment()
    // Mounted, rendered or not: the browser's own clear control is hidden meanwhile.
    onBeforeUnmount(() => ctx.setMounted("clearTriggers", -1))
    onMounted(() => {
      ctx.setMounted("clearTriggers", 1)
      if (ctx.own().type === "search") {
        injectStyle(
          ctx.controlEl.current?.ownerDocument,
          "text-field-cancel",
          textFieldCancelStyle,
          env,
        )
      }
    })
    const press = usePress({
      env,
      // Pressing never moves focus away from the input.
      focusOnPress: false,
      send: (e) => {
        if (e.type === "PRESS") ctx.send({ type: "CLEAR", modality: e.modality, reason: "CLEAR" })
      },
    })
    return () => {
      const value = ctx.view().values.value ?? ""
      const clearable =
        !ctx.disabled() && !ctx.readOnly() && !ctx.focusableWhenDisabled() && value !== ""
      if (!clearable) return null
      const own = normalizeProps({
        "data-scope": ctx.scope,
        "data-part": "clear-trigger",
        "data-instance": ctx.instance(),
        type: "button",
        "aria-label":
          ctx.own().type === "search" ? ctx.messages().clearSearch : ctx.messages().clear,
        tabindex: -1,
      })
      return renderPart(
        "button",
        mergeProps({ ...own, ...press.props }, attrs),
        slots["default"]?.(),
        props.asChild,
      )
    }
  },
})

const CharacterCount = defineComponent({
  name: "TextFieldCharacterCount",
  inheritAttrs: false,
  props: {
    /** A soft limit: going over it is a `tooLong`-style error, never a truncation. */
    max: Number,
    /** Replaces the counter (default: UTF-16 code units, a line break counts once). */
    count: Function as PropType<(value: string) => number>,
    id: String,
    ...asChildProp,
  },
  setup(props, { attrs }) {
    const ctx = useTextFieldHost("CharacterCount")
    const own = () => props.id ?? `${ctx.scope}-${ctx.instance()}-character-count`.replace(/:/g, "")
    onBeforeUnmount(() => ctx.setCount(null))
    // After mount, like React's layout effect (the server render shows the count alone); then
    // on mount and when the limit or counter changes, the soft-limit validity is written.
    onMounted(() => {
      watch(
        () => [own(), props.max, props.count] as const,
        ([id, max, count]) => ctx.setCount({ id, max, count }),
        { immediate: true },
      )
      watch(
        () => [ctx.limit(), props.count],
        () => ctx.applySoftLimit(ctx.controlEl.current?.value ?? ""),
        { immediate: true },
      )
    })
    const used = computed(() => (props.count ?? defaultCount)(ctx.view().values.value ?? ""))
    return () => {
      const limit = ctx.limit()
      const over = limit !== undefined && used.value > limit
      const merged = mergeProps(
        normalizeProps({
          "data-scope": ctx.scope,
          "data-part": "character-count",
          "data-instance": ctx.instance(),
          id: own(),
          "data-over-limit": over ? "" : undefined,
        }),
        attrs,
      )
      return renderPart(
        "span",
        merged,
        limit === undefined ? String(used.value) : `${used.value}/${limit}`,
        props.asChild,
      )
    }
  },
})

export type { TextFieldDetails }
export { CharacterCount, ClearTrigger, Input, Root, Textarea }
