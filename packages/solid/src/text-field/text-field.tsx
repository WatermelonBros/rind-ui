/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  on,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { type FieldRootOptions, useFieldBindingPeek, useFieldControl } from "../field/context"
import { FieldHost } from "../field/field-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
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
  readonly mounted: Accessor<{ readonly clearTriggers: number; readonly triggers: number }>
  readonly setMounted: (part: "clearTriggers" | "triggers", delta: 1 | -1) => void
  readonly scope: string
  readonly instance: () => string
  readonly view: Service["view"]
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

const TextFieldContext = createContext<TextFieldHostContext>()
/** A part's access to its host (`part` names it in the error). */
export function useTextFieldHost(part: string): TextFieldHostContext {
  const ctx = useContext(TextFieldContext)
  if (!ctx) throw new Error(`${part} must be inside its Root`)
  return ctx
}

function keys(ctx: TextFieldHostContext) {
  return textFieldKeysConnect(
    {
      value: ctx.view().values.value ?? "",
      composing: ctx.view().state === "composing",
      search: ctx.own().type === "search",
      customClear: ctx.mounted().clearTriggers > 0,
    },
    // Sound: the Text Field machine accepts ESCAPE and SUBMIT (its key preset).
    ctx.send as unknown as (event: TextFieldOwnEvent) => void,
  )
}

export type TextFieldRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onSubmit" | "id"
> &
  Omit<FieldRootOptions, "messages"> & {
    /** The parts: Label, Input or Textarea, Description, ErrorMessage and the triggers. */
    readonly children?: JSX.Element
    /**
     * The Input's native type. `"password"`: the visibility parts and rules (hidden on submit
     * and reset, caret kept, privacy attributes); `"search"`: a searchbox, "Clear search",
     * Escape clears.
     */
    readonly type?: string | undefined
    /** `type="password"`: controlled visibility. */
    readonly visible?: boolean | undefined
    readonly defaultVisible?: boolean | undefined
    readonly onVisibleChange?:
      | ((visible: boolean, details: TextFieldVisibilityDetails) => void)
      | undefined
    /** Escape clears a non-empty editable value (default: true for `type="search"`). */
    readonly escapeClears?: boolean | undefined
    /** Enter (not composing). The form still submits unless `details.event` is prevented. */
    readonly onSubmit?: ((value: string, details: TextFieldSubmitDetails) => void) | undefined
    readonly value?: string | null | undefined
    readonly defaultValue?: string | undefined
    readonly onValueChange?: ((value: string, details: TextFieldDetails) => void) | undefined
    /** Disabled but focusable: read-only + aria-disabled; nothing changes the value. */
    readonly focusableWhenDisabled?: boolean | undefined
    /** Announce the count when this many or fewer characters remain. */
    readonly countThreshold?: number | undefined
    readonly messages?: MessageOverrides<TextFieldMessages> | undefined
    readonly fieldMessages?: MessageOverrides<FieldMessages> | undefined
  }

function Root(props: TextFieldRootProps) {
  const [own, rest] = splitProps(props, [
    "type",
    "visible",
    "defaultVisible",
    "onVisibleChange",
    "escapeClears",
    "onSubmit",
    "value",
    "defaultValue",
    "onValueChange",
    "focusableWhenDisabled",
    "countThreshold",
    "messages",
    "fieldMessages",
    "children",
  ])
  const scope = "text-field"
  const env = useEnvironment(announcerCapability)
  const generated = createUniqueId()
  const instance = () => rest.id ?? generated
  const messages = useMessages("text-field", textFieldMessages, () => own.messages)
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = () =>
    rest.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled()
  const readOnly = () => rest.readOnly === true || enclosing?.().state.readOnly === true
  const [countState, setCountState] = createSignal<CountState | null>(null)
  const [maxLength, setMaxLength] = createSignal<number | undefined>(undefined)
  const limit = () => maxLength() ?? countState()?.max
  const controlEl: TextFieldHostContext["controlEl"] = { current: null }
  let reason: TextFieldReason | undefined
  const controls = { current: 0 }
  const pendingSelection: TextFieldHostContext["pendingSelection"] = { current: null }
  const [controlId, setControlId] = createSignal<string | undefined>(undefined)
  const [mounted, setMountedState] = createSignal({ clearTriggers: 0, triggers: 0 })
  const ownProps = () => ({
    type: own.type,
    visible: own.visible,
    defaultVisible: own.defaultVisible,
    escapeClears: own.escapeClears,
  })
  const { view, send } = useMachine(
    textFieldMachine,
    () => ({
      ...visibilityMachineProps(
        ownProps(),
        { controlEl, env, pendingSelection },
        (visible, details) => own.onVisibleChange?.(visible, details),
      ),
      escapeClears: own.escapeClears ?? own.type === "search",
      onSubmit: (value: string, details: TextFieldSubmitDetails) => own.onSubmit?.(value, details),
      value: own.value === undefined ? undefined : (own.value ?? ""),
      defaultValue: own.defaultValue ?? "",
      onValueChange: (v: string, details: unknown) => {
        // Machine details → the public ones (reason, native event, isComposing).
        const e = (
          details as {
            event: { type: string; reason?: string; event?: Event | null; composing?: boolean }
          }
        ).event
        own.onValueChange?.(v, {
          reason: e.type === "RESET" ? "RESET" : (e.reason ?? "INPUT"),
          event: e.event ?? null,
          isComposing: e.composing === true,
        } as TextFieldDetails)
      },
      disabled: disabled(),
      readOnly: readOnly(),
      focusableWhenDisabled: own.focusableWhenDisabled,
      limit: limit(),
      threshold: own.countThreshold,
      count: countState()?.count,
      messages: messages(),
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
  const modality = useModality(env.modality, () => view().context.focused)
  // Exactly one Input or Textarea (development error otherwise).
  afterMount(() => {
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
    const state = untrack(countState)
    const max = state?.max
    if (!el || max === undefined) return
    const used = (state?.count ?? defaultCount)(next)
    if (used > max) {
      el.setCustomValidity(untrack(messages).charactersOver(used - max))
      softSet = true
    } else if (softSet) {
      el.setCustomValidity("")
      softSet = false
    }
  }
  const ctx: TextFieldHostContext = {
    own: ownProps,
    mounted,
    setMounted: (part, delta) => setMountedState((m) => ({ ...m, [part]: m[part] + delta })),
    scope,
    instance,
    view,
    send,
    controlled: () => own.value !== undefined,
    defaultValue: () => own.defaultValue,
    disabled,
    readOnly,
    focusableWhenDisabled: () => own.focusableWhenDisabled === true,
    messages,
    limit,
    count: () => countState()?.count,
    countId: () => countState()?.id,
    applySoftLimit,
    setCount: setCountState,
    setMaxLength,
    controlEl,
    controlId,
    setControlId,
    pendingSelection,
    takeReason: () => reason,
    controls,
  }
  // After the `type` change is in the DOM: the caret stays where the user left it.
  afterMount(() =>
    createEffect(() => {
      view()
      visibilityAfterRender(ctx)
    }),
  )
  const rootData = createMemo(() => {
    const focused = view().context.focused
    return {
      "data-focus": focused ? "" : undefined,
      "data-focus-visible":
        focused && modality() !== "pointer" && modality() !== "touch" ? "" : undefined,
      "data-composing": view().matches("composing") ? "" : undefined,
      ...keys(ctx).root(),
      ...visibilityRootData(ctx),
    }
  })
  return (
    <FieldHost
      {...rest}
      scope={scope}
      id={instance()}
      messages={own.fieldMessages}
      attrs={rootData}
    >
      <TextFieldContext.Provider value={ctx}>{own.children}</TextFieldContext.Provider>
    </FieldHost>
  )
}

interface ComposingState {
  readonly composing: boolean
}

type ControlProps<A> = Omit<A, "children" | "value" | "defaultValue"> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<ComposingState> | undefined
  readonly children?: JSX.Element
}

/** The control's attributes the part reads by name (forwarded to `mergeFieldProps`). */
function useControl(
  part: "input" | "textarea",
  props: ControlProps<JSX.InputHTMLAttributes<HTMLInputElement>> & { autosize?: boolean },
) {
  const [local, attrs] = splitProps(props, ["id", "render", "children", "autosize"])
  const [named, rest] = splitProps(attrs, [
    "required",
    "name",
    "maxlength",
    "maxLength",
    "aria-describedby",
    "aria-label",
    "aria-labelledby",
  ])
  const ctx = useTextFieldHost(part === "input" ? "Input" : "Textarea")
  const binding = useFieldControl()
  const env = useEnvironment()
  const generated = createUniqueId()
  // A memo: the binding changes on every registration, the id (compared by value) does not.
  const controlId = createMemo(() => local.id ?? binding?.().controlId ?? generated)
  const [el, setEl] = createSignal<HTMLInputElement | HTMLTextAreaElement | null>(null)
  ctx.controls.current += 1
  onCleanup(() => {
    ctx.controls.current -= 1
  })
  const maxlength = () => {
    const v = named.maxlength ?? named.maxLength
    return v === undefined ? undefined : Number(v)
  }
  // After mount, like React's layout effects: the server render does not know them yet.
  afterMount(() => {
    createEffect(() => ctx.setMaxLength(maxlength()))
    createEffect(() => ctx.setControlId(controlId()))
    // autoFocus: focused before the handlers ran (base-ui#3172).
    const node = el()
    if (node && node.ownerDocument.activeElement === node) {
      ctx.send({ type: "FOCUS", modality: env.modality.modality() })
    }
    createEffect(() => {
      const id = controlId()
      const off = untrack(() =>
        binding?.().register(
          {
            id,
            labelable: true,
            focus: (modality) => {
              const current = el()
              if (current) void focusSafely(current, env, "programmatic", modality)
            },
            validityElement: () => el(),
            value: () => el()?.value ?? "",
          },
          id,
        ),
      )
      if (off) onCleanup(off)
    })
    // Development: the placeholder is never a name; a control needs a Label or an ARIA name.
    if (process.env.NODE_ENV !== "production" && node) {
      const labelled =
        (node.labels?.length ?? 0) > 0 ||
        node.hasAttribute("aria-label") ||
        node.hasAttribute("aria-labelledby")
      if (!labelled) {
        console.warn(
          `[rind-ui] ${ctx.scope}: the ${part} has no accessible name (a placeholder is not one); render a Label or pass aria-label / aria-labelledby.`,
        )
      }
    }
    // A form reset: the DOM value is re-read once the reset ran (the latest defaultValue).
    const form = node?.form
    if (form) {
      const onReset = (e: Event) =>
        env.scheduler.setTimeout(() => {
          const current = el()
          if (!e.defaultPrevented && current) ctx.send({ type: "RESET", value: current.value })
        }, 0)
      form.addEventListener("reset", onReset)
      onCleanup(() => form.removeEventListener("reset", onReset))
    }
  })
  const modality = useModality(env.modality, () => ctx.view().context.focused)
  // The value the Field last heard of: a parent's controlled change is reported too (not a
  // user change), so its validity and data-filled follow (react-spectrum#8659).
  let reported: string | null = null
  createEffect(() => {
    const current = ctx.view().values.value ?? ""
    if (!ctx.controlled()) return
    const b = untrack(() => binding?.())
    if (!b) return
    if (reported === null || reported === current) {
      reported = current
      return
    }
    reported = current
    b.report({ type: "change", value: current, user: false, composing: false })
  })
  const api = createMemo(() => {
    const field = mergeFieldProps(
      {
        role: "textbox",
        labelable: true,
        disabled: ctx.disabled(),
        readOnly: ctx.readOnly(),
        required: named.required === true || (named.required as unknown) === "",
        name: named.name,
        consumerDescribedBy: named["aria-describedby"],
        ariaLabel: named["aria-label"],
        ariaLabelledBy: named["aria-labelledby"],
      },
      binding?.() ?? null,
    )
    return textFieldConnect(
      {
        scope: ctx.scope,
        instance: ctx.instance(),
        state: ctx.view().state,
        value: ctx.view().values.value ?? "",
        controlled: ctx.controlled(),
        defaultValue: ctx.defaultValue(),
        focused: ctx.view().context.focused,
        modality: modality(),
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        field,
        fieldData: binding?.().data ?? {},
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
          binding?.().report(event)
        },
        takeReason: ctx.takeReason,
      },
    )
  })
  const full = createMemo(() => {
    const own = normalizeProps({
      ...api().control(part),
      maxlength: maxlength(),
      "aria-label": named["aria-label"],
    })
    const type = ctx.own().type as string | undefined
    // The preset's input attributes win; its handlers run after Text Field's.
    const preset = normalizeProps({
      ...(type !== undefined && type !== "password" && type !== "search" ? { type } : {}),
      ...keys(ctx).input(),
      ...visibilityInputProps(ctx),
    })
    return mergeProps(
      {
        ...joinHandlers(own, preset),
        ref: (node: HTMLInputElement | HTMLTextAreaElement) => {
          setEl(node)
          // Set while rendering: the machine starts (and watches the form) before the parts mount.
          ctx.controlEl.current = node
        },
      },
      rest,
    )
  })
  // A textarea's default is its text (the `value` attribute is not one there).
  const text = () =>
    part === "textarea" ? (full()["attr:value"] as string | undefined) : undefined
  const merged = createMemo(() => {
    if (part !== "textarea") return full()
    const { "attr:value": _text, ...props } = full()
    return props
  })
  const state = reactive<ComposingState>(() => ({ composing: api().composing }))
  return { merged, text, state, local, el, ctx }
}

export type TextFieldInputProps = ControlProps<JSX.InputHTMLAttributes<HTMLInputElement>>

function Input(props: TextFieldInputProps) {
  const control = useControl("input", props)
  return renderPart(
    control.local.render,
    control.merged,
    control.state,
    () => control.local.children,
    (p) => <input {...p} />,
  )
}

export type TextFieldTextareaProps = ControlProps<
  JSX.TextareaHTMLAttributes<HTMLTextAreaElement>
> & {
  /** Grows with its content. */
  readonly autosize?: boolean | undefined
}

function Textarea(props: TextFieldTextareaProps) {
  const control = useControl("textarea", props as never)
  const env = useEnvironment()
  afterMount(() => {
    let handle: ReturnType<typeof attachAutosize> | null = null
    createEffect(() => {
      const on = control.local.autosize
      const node = control.el()
      handle?.dispose()
      handle = null
      if (on && node instanceof HTMLTextAreaElement) handle = attachAutosize(node, env)
    })
    // Every value commit (controlled, programmatic, reset) re-measures (kobalte#484).
    createEffect(
      on(
        () => control.ctx.view().values.value,
        () => handle?.measure(),
        { defer: true },
      ),
    )
    onCleanup(() => handle?.dispose())
  })
  return renderPart(
    control.local.render,
    control.merged,
    control.state,
    () => control.local.children,
    (p) => <textarea {...p}>{control.text()}</textarea>,
  )
}

export type TextFieldClearTriggerProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

/** The ClearTrigger; with `type="search"`, the browser's own cancel button is hidden meanwhile. */
function ClearTrigger(props: TextFieldClearTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTextFieldHost("TextField.ClearTrigger")
  const env = useEnvironment()
  // Mounted, rendered or not: the browser's own clear control is hidden meanwhile.
  afterMount(() => {
    ctx.setMounted("clearTriggers", 1)
    onCleanup(() => ctx.setMounted("clearTriggers", -1))
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
  const clearable = () =>
    !ctx.disabled() &&
    !ctx.readOnly() &&
    !ctx.focusableWhenDisabled() &&
    (ctx.view().values.value ?? "") !== ""
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps({
          "data-scope": ctx.scope,
          "data-part": "clear-trigger",
          "data-instance": ctx.instance(),
          type: "button",
          "aria-label":
            ctx.own().type === "search" ? ctx.messages().clearSearch : ctx.messages().clear,
          tabindex: -1,
        }),
        ...press.props,
      },
      rest,
    ),
  )
  const children = () => local.children
  return (
    <Show when={clearable()}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <button {...p}>{children()}</button>
      ))}
    </Show>
  )
}

export type TextFieldCharacterCountProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** A soft limit: going over it is a `tooLong`-style error, never a truncation. */
  readonly max?: number | undefined
  /** Replaces the counter (default: UTF-16 code units, a line break counts once). */
  readonly count?: ((value: string) => number) | undefined
  readonly render?: RenderProp<undefined> | undefined
}

function CharacterCount(props: TextFieldCharacterCountProps) {
  const [local, rest] = splitProps(props, ["max", "count", "id", "render"])
  const ctx = useTextFieldHost("CharacterCount")
  const own = () => local.id ?? `${ctx.scope}-${ctx.instance()}-character-count`.replace(/:/g, "")
  onCleanup(() => ctx.setCount(null))
  // After mount, like React's layout effect (the server render shows the count alone); then
  // on mount and when the limit or counter changes, the soft-limit validity is written.
  afterMount(() => {
    createEffect(() => ctx.setCount({ id: own(), max: local.max, count: local.count }))
    createEffect(() => {
      ctx.limit()
      local.count
      ctx.applySoftLimit(ctx.controlEl.current?.value ?? "")
    })
  })
  const used = createMemo(() => (local.count ?? defaultCount)(ctx.view().values.value ?? ""))
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps({
        "data-scope": ctx.scope,
        "data-part": "character-count",
        "data-instance": ctx.instance(),
        id: own(),
        "data-over-limit":
          ctx.limit() !== undefined && used() > (ctx.limit() as number) ? "" : undefined,
      }),
      rest,
    ),
  )
  const children = () => {
    const limit = ctx.limit()
    return limit === undefined ? String(used()) : `${used()}/${limit}`
  }
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type { TextFieldDetails }
export { CharacterCount, ClearTrigger, Input, Root, Textarea }
