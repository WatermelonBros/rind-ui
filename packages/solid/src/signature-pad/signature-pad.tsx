/** @jsxImportSource solid-js */
import {
  announcerCapability,
  exportSignature,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  partId,
  preventTouchScribble,
  type SignatureExportOptions,
  type SignaturePadEvent,
  type SignaturePadMessages,
  type SignaturePadState,
  type SignatureValue,
  type StrokeMessage,
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "signature-pad": SignaturePadMessages
  }
}

/** What every part's `render` receives. */
export interface SignaturePadRenderState {
  readonly state: SignaturePadState
  readonly value: SignatureValue
  readonly empty: boolean
  readonly strokeCount: number
  /** The signature as an image (PNG unless `type` says otherwise), in the Control's ink colour. */
  readonly toBlob: (options?: SignatureExportOptions) => Promise<Blob>
  /** Saves the image as a file (default "signature.png"). */
  readonly download: (filename?: string, options?: SignatureExportOptions) => Promise<void>
}

type Api = ReturnType<typeof signaturePadConnect>
type Optional = "label" | "status"

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (event: SignaturePadEvent) => void
  readonly state: SignaturePadRenderState
  readonly registry: PartRegistry<Optional>
  readonly ids: Accessor<{ readonly label: string; readonly status: string }>
  readonly setControl: (el: HTMLElement | null) => void
}
const SignaturePadContext = createContext<Ctx>()
function useSignaturePad(part: string): Ctx {
  const ctx = useContext(SignaturePadContext)
  if (!ctx) throw new Error(`SignaturePad.${part} must be inside SignaturePad.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<SignaturePadRenderState> | undefined
  readonly children?: JSX.Element | ((state: SignaturePadRenderState) => JSX.Element)
}

export type SignaturePadRootProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** The strokes, controlled: `{ width, height, strokes }`. */
  readonly value?: SignatureValue | undefined
  /** The strokes, uncontrolled. */
  readonly defaultValue?: SignatureValue | undefined
  /** When a stroke ends, on clear, undo and form reset; never while drawing. */
  readonly onValueChange?: ((value: SignatureValue) => void) | undefined
  /** The form field's name. */
  readonly name?: string | undefined
  /** The form id, when the pad is outside it. */
  readonly form?: string | undefined
  /** What the form submits: an SVG data URL (default), or the strokes as JSON. */
  readonly formValue?: "svg" | "json" | undefined
  /** The ink colour inlined in the submitted SVG. Default "#000". */
  readonly inkColor?: string | undefined
  /** An empty pad blocks submit. */
  readonly required?: boolean | undefined
  /** No drawing, not submitted. */
  readonly disabled?: boolean | undefined
  /** Shows and submits the strokes; no drawing, clear or undo. */
  readonly readOnly?: boolean | undefined
  /** Points closer than this to the previous one are dropped (px). Default 1. */
  readonly minDistance?: number | undefined
  /** Inside a Field, also set by the Field. */
  readonly invalid?: boolean | undefined
  readonly messages?: MessageOverrides<SignaturePadMessages> | undefined
  /** Default: the provider's locale (the announcements' language). */
  readonly locale?: string | undefined
}

const MESSAGE_EVENT = {
  down: "POINTER.DOWN",
  move: "POINTER.MOVE",
  up: "POINTER.UP",
  cancel: "POINTER.CANCEL",
} as const

/** A stroke-input message as the machine's event. */
const strokeEvent = (m: StrokeMessage): SignaturePadEvent =>
  // Sound: each message's fields are those of the event it maps to (pointerId, point/points/box).
  ({ ...m, type: MESSAGE_EVENT[m.type] }) as SignaturePadEvent

function Root(props: SignaturePadRootProps) {
  const [own, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "name",
    "form",
    "formValue",
    "inkColor",
    "required",
    "disabled",
    "readOnly",
    "minDistance",
    "invalid",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("signature-pad", signaturePadMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const registry = usePartRegistry<Optional>({ scope: "signature-pad", root: instance() })
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const [input, setInput] = createSignal<HTMLInputElement | null>(null)
  const [control, setControl] = createSignal<HTMLElement | null>(null)
  const [invalid, setInvalid] = createSignal(false)
  const formValue = () => own.formValue ?? "svg"
  const inkColor = () => own.inkColor ?? "#000"
  const formInput = hiddenFormInput({ input, control }, env)
  const field = createMemo(() =>
    mergeFieldProps(
      {
        role: "img",
        labelable: false,
        disabled: own.disabled === true || fieldsetContext() || fieldsetDom(),
        readOnly: own.readOnly === true,
        required: own.required === true,
        invalid: own.invalid === true || invalid(),
        name: own.name,
      },
      binding?.() ?? null,
    ),
  )
  const { view, send } = useMachine(
    signaturePadMachine,
    () => ({
      value: own.value,
      defaultValue: own.defaultValue,
      onValueChange: (v: SignatureValue) => own.onValueChange?.(v),
      disabled: field().disabled,
      readOnly: field().readOnly,
      minDistance: own.minDistance,
      messages: messages(),
      id: instance(),
      lang: locale().locale,
    }),
    {
      ...env,
      syncInput: (v: SignatureValue, dispatch: boolean) =>
        formInput.sync(
          { value: signatureFormValue(v, untrack(formValue), untrack(inkColor)) },
          { dispatch },
        ),
    },
  )
  const ids = createMemo(() => ({
    label: partId("signature-pad", instance(), "label"),
    control: partId("signature-pad", instance(), "control"),
    status: partId("signature-pad", instance(), "status"),
    input: partId("signature-pad", instance(), "hidden-input"),
  }))
  const labelId = useRenderedId(registry, "label")
  const statusId = useRenderedId(registry, "status")
  // Inside a Field without its own Label, the Field's label names the Control.
  const label = () => labelId() ?? binding?.().ids.label
  const value = () => view().values.value
  const api = createMemo(() =>
    signaturePadConnect(
      {
        instance: instance(),
        state: view().state as SignaturePadState,
        value: value(),
        stroke: view().context.stroke,
        messages: messages(),
        ids: {
          label: label() ?? ids().label,
          control: ids().control,
          status: statusId() ?? ids().status,
          input: ids().input,
        },
        rendered: { label: label() !== undefined, status: statusId() !== undefined },
        disabled: field().disabled,
        readOnly: field().readOnly,
        required: field().required,
        invalid: field().invalid,
        name: field().name,
        describedBy: field()["aria-describedby"],
        form: own.form,
        formValue: formValue(),
        inkColor: inkColor(),
      },
      env,
    ),
  )
  const toBlob = (options?: SignatureExportOptions) => {
    const el = untrack(control)
    const color = el ? getComputedStyle(el).color : untrack(inkColor)
    return exportSignature(untrack(value), {
      ...options,
      color,
      ...(el ? { doc: el.ownerDocument } : {}),
    })
  }
  const download = async (filename = "signature.png", options?: SignatureExportOptions) => {
    const blob = await toBlob(options)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    // After the click's task: the download has taken the URL.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const state = reactive<SignaturePadRenderState>(() => ({
    state: view().state as SignaturePadState,
    value: value(),
    empty: api().empty,
    strokeCount: api().strokeCount,
    toBlob,
    download,
  }))
  afterMount(() => {
    // The input mirrors the value after every commit (hydration, a parent's change).
    createEffect(() => {
      formInput.sync({ value: api().formValue }, { dispatch: false })
    })
    // An invalid submit marks the pad until it is signed or reset.
    createEffect(() => {
      if (!api().empty) setInvalid(false)
    })
    let resetting = false
    // field-control: one control; the hidden input is its validity element, the Control its focus.
    if (binding) {
      createEffect(() => {
        const id = ids().control
        onCleanup(
          untrack(() =>
            binding().register(
              {
                id,
                labelable: false,
                focus: (m) => {
                  const c = control()
                  if (c) void focusSafely(c, env, "programmatic", m)
                },
                validityElement: input,
                value: () => untrack(value),
              },
              id,
            ),
          ),
        )
      })
      let reported = untrack(value)
      createEffect(() => {
        const now = value()
        if (reported === now) return
        reported = now
        // A form reset is not the user's change: no commit (the Field revalidates on its own).
        const user = !resetting
        resetting = false
        untrack(() => {
          binding().report({ type: "change", value: now, user, composing: false })
          if (user) binding().report({ type: "commit" })
        })
      })
    }
    const el = untrack(input)
    if (!el) return
    const watch = watchFieldsetDisabled(el, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    const onInvalid = () => setInvalid(true)
    el.addEventListener("invalid", onInvalid)
    const stop = formInput.track({
      onReset: () => {
        resetting = true
        setInvalid(false)
        send({ type: "RESET" })
      },
      current: () => ({ value: untrack(api).formValue }),
    })
    onCleanup(() => {
      watch.stop()
      el.removeEventListener("invalid", onInvalid)
      stop()
    })
  })
  const ctx: Ctx = { api, send, state, registry, ids, setControl }
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const inputProps = createMemo(() =>
    mergeProps(normalizeProps(api().hiddenInput()), { ref: setInput }),
  )
  const children = () => (
    <>
      {resolveChildren(own.children, state)}
      <input {...inputProps()} />
    </>
  )
  return (
    <SignaturePadContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </SignaturePadContext.Provider>
  )
}

export type SignaturePadLabelProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Label(props: SignaturePadLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSignaturePad("Label")
  const id = () => rest.id ?? ctx.ids().label
  useRegisterPart(ctx.registry, "label", id)
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().label()), id: id() }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type SignaturePadControlProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Control(props: SignaturePadControlProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSignaturePad("Control")
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  let stop: (() => void) | null = null
  afterMount(() => {
    createEffect(() => {
      const node = el()
      if (node) onCleanup(preventTouchScribble(node))
    })
    onCleanup(() => stop?.())
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().control()), {
          onPointerDown: (e: PointerEvent) => {
            const node = e.currentTarget as HTMLElement
            if (!startsStroke(e)) return
            // Text selection and focus moves would follow the pen (the surface draws).
            e.preventDefault()
            stop = startStroke(node, e, (m) => {
              if (m.type === "up" || m.type === "cancel") stop = null
              ctx.send(strokeEvent(m))
            })
          },
        }),
        ref: (node: HTMLElement) => {
          setEl(node)
          ctx.setControl(node)
        },
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type SignaturePadSegmentProps = Omit<JSX.SvgSVGAttributes<SVGSVGElement>, "children"> & {
  readonly render?: RenderProp<SignaturePadRenderState> | undefined
}

function Segment(props: SignaturePadSegmentProps) {
  const [local, rest] = splitProps(props, ["render"])
  const ctx = useSignaturePad("Segment")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().segment()), rest))
  const children = () => (
    <For each={ctx.api().paths}>{(d) => <path {...normalizeProps(ctx.api().stroke(d))} />}</For>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    // biome-ignore lint/a11y/noSvgWithoutTitle: aria-hidden by connect (the Control is the image)
    <svg {...p}>{children()}</svg>
  ))
}

export type SignaturePadGuideProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Guide(props: SignaturePadGuideProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSignaturePad("Guide")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().guide()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type SignaturePadStatusProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Status(props: SignaturePadStatusProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSignaturePad("Status")
  const id = () => rest.id ?? ctx.ids().status
  useRegisterPart(ctx.registry, "status", id)
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().status()), id: id() }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.api().statusText
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type SignaturePadTriggerProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

/** Clear and Undo: a button that stays focusable when there is nothing to do. */
function trigger(part: "ClearTrigger" | "UndoTrigger") {
  return (props: SignaturePadTriggerProps) => {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useSignaturePad(part)
    const env = useEnvironment()
    // Tracks the modality from mount, so the first keyboard focus is already visible.
    afterMount(() => onCleanup(env.modality.subscribe(() => {})))
    const [focused, setFocused] = createSignal(false)
    const modality = useModality(env.modality, focused)
    const [el, setEl] = createSignal<Element | null>(null)
    // The rendered tag: the element's own once mounted when `render` substitutes it.
    const [measured, setMeasured] = createSignal<string | undefined>()
    afterMount(() => {
      const node = el()
      if (local.render && node) setMeasured(node.tagName.toLowerCase())
    })
    const tag = () => (local.render ? (measured() ?? "button") : "button")
    const native = () => tag() === "button" || tag() === "input"
    const merged = createMemo(() => {
      const input = { tag: tag(), focused: focused(), modality: modality() }
      const api = normalizeProps(
        part === "ClearTrigger" ? ctx.api().clearTrigger(input) : ctx.api().undoTrigger(input),
      )
      // A consumer name replaces the default one, labelled-by included.
      if (rest["aria-label"] !== undefined && rest["aria-labelledby"] === undefined) {
        api["aria-labelledby"] = undefined
      }
      return mergeProps(
        {
          ...joinHandlers(api, {
            // Nothing to do (aria-disabled): the machine's guard ignores it; focus stays.
            onClick: () => ctx.send({ type: part === "ClearTrigger" ? "CLEAR" : "UNDO" }),
            // A substituted non-button element: Enter and Space click it, as a button would.
            onKeyDown: (e: KeyboardEvent) => {
              if (native() || e.repeat) return
              if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
              if (e.key === " ") e.preventDefault()
            },
            onKeyUp: (e: KeyboardEvent) => {
              if (!native() && e.key === " ") (e.currentTarget as HTMLElement).click()
            },
            onFocusIn: () => setFocused(true),
            onFocusOut: () => setFocused(false),
          }),
          ref: setEl,
        },
        rest,
      )
    })
    const children = () => resolveChildren(local.children, ctx.state)
    return renderPart(local.render, merged, ctx.state, children, (p) => (
      <button {...p}>{children()}</button>
    ))
  }
}

const ClearTrigger = trigger("ClearTrigger")
const UndoTrigger = trigger("UndoTrigger")

/** The parts, by name: `signature-pad.parts.ts` re-exports them as the `SignaturePad` namespace. */
export { ClearTrigger, Control, Guide, Label, Root, Segment, Status, UndoTrigger }
