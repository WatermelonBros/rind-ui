"use client"

// Signature Pad (add-signature-pad): strokes drawn on the Control with Pointer Events
// (`dom/stroke-input`), rendered as SVG paths, mirrored on a hidden form input rendered by Root.

import {
  announcerCapability,
  EMPTY_SIGNATURE,
  exportSignature,
  type FieldControlBinding,
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
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    "signature-pad": SignaturePadMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What every part's `render` receives. */
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

type Api = ReturnType<typeof signaturePadConnect>
type Optional = "label" | "status"

interface Ctx {
  readonly api: Api
  readonly send: (event: SignaturePadEvent) => void
  readonly state: SignaturePadRenderState
  readonly registry: ReturnType<typeof usePartRegistry<Optional>>
  readonly ids: { readonly label: string; readonly status: string }
  readonly control: { current: HTMLElement | null }
  readonly binding: FieldControlBinding | null
}
const SignaturePadContext = createContext<Ctx | null>(null)
function useSignaturePad(part: string): Ctx {
  const ctx = useContext(SignaturePadContext)
  if (!ctx) throw new Error(`SignaturePad.${part} must be inside SignaturePad.Root`)
  return ctx
}

export type SignaturePadRootProps = Omit<ComponentPropsWithRef<"div">, "defaultValue"> & {
  /** The strokes, controlled: `{ width, height, strokes }`. */
  readonly value?: SignatureValue
  /** The strokes, uncontrolled. */
  readonly defaultValue?: SignatureValue
  /** When a stroke ends, on clear, undo and form reset; never while drawing. */
  readonly onValueChange?: (value: SignatureValue) => void
  /** The form field's name. */
  readonly name?: string
  /** The form id, when the pad is outside it. */
  readonly form?: string
  /** What the form submits: an SVG data URL, or the strokes as JSON. Default "svg". */
  readonly formValue?: "svg" | "json"
  /** The ink colour inlined in the submitted SVG. Default "#000". */
  readonly inkColor?: string
  /** An empty pad blocks submit. */
  readonly required?: boolean
  /** No drawing, not submitted. */
  readonly disabled?: boolean
  /** Shows and submits the strokes; no drawing, clear or undo. */
  readonly readOnly?: boolean
  /** Shows the pad invalid (a Field sets it too). */
  readonly invalid?: boolean
  /** Points closer than this to the previous one are dropped (px). Default 1. */
  readonly minDistance?: number
  readonly messages?: MessageOverrides<SignaturePadMessages>
  /** Default: the provider's locale (the announcements' language). */
  readonly locale?: string
  readonly render?: RenderProp<SignaturePadRenderState>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  name,
  form,
  formValue = "svg",
  inkColor = "#000",
  required = false,
  disabled = false,
  readOnly = false,
  invalid = false,
  minDistance,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: SignaturePadRootProps) {
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("signature-pad", signaturePadMessages, ownMessages)
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = useState(false)
  const registry = usePartRegistry<Optional>({ scope: "signature-pad", root: instance })
  const ownLabel = useRenderedId(registry, "label")
  const status = useRenderedId(registry, "status")
  const field = mergeFieldProps(
    {
      role: "img",
      labelable: false,
      disabled: disabled || fieldsetContext || fieldsetDom,
      readOnly,
      required,
      invalid,
      name,
    },
    binding,
  )
  const ids = {
    label: partId("signature-pad", instance, "label"),
    control: partId("signature-pad", instance, "control"),
    status: partId("signature-pad", instance, "status"),
    input: partId("signature-pad", instance, "hidden-input"),
  }
  const input = useRef<HTMLInputElement | null>(null)
  const control = useRef<HTMLElement | null>(null)
  const [formInput] = useState(() =>
    hiddenFormInput({ input: () => input.current, control: () => control.current }, env),
  )
  const encode = (v: SignatureValue) => signatureFormValue(v, formValue, inkColor)
  const encodeRef = useRef(encode)
  encodeRef.current = encode
  const [machineEnv] = useState(() => ({
    ...env,
    syncInput: (v: SignatureValue, dispatch: boolean) =>
      formInput.sync({ value: encodeRef.current(v) }, { dispatch }),
  }))
  const lastUser = useRef(false)
  const { view, send } = useMachine(
    signaturePadMachine,
    {
      value,
      defaultValue,
      onValueChange: (next: SignatureValue) => {
        lastUser.current = true
        onValueChange?.(next)
      },
      disabled: field.disabled,
      readOnly: field.readOnly,
      minDistance,
      messages,
      id: instance,
      lang: locale,
    },
    machineEnv,
  )
  const current = view.values.value ?? EMPTY_SIGNATURE
  const latest = useRef(current)
  latest.current = current
  const labelId = binding?.ids.label ?? ownLabel
  const api = signaturePadConnect(
    {
      instance,
      state: view.state,
      value: current,
      stroke: view.context.stroke,
      messages,
      ids: { ...ids, label: labelId ?? ids.label },
      rendered: { label: labelId !== undefined, status: status !== undefined },
      disabled: field.disabled,
      readOnly: field.readOnly,
      required: field.required,
      invalid: field.invalid,
      name: field.name,
      form,
      formValue,
      inkColor,
      describedBy: field["aria-describedby"],
    },
    env,
  )
  // After every commit: the input shows the value (hydration, a parent's change); no events.
  useIsoLayoutEffect(() => {
    formInput.sync({ value: encodeRef.current(latest.current) }, { dispatch: false })
  })
  useEffect(
    () =>
      formInput.track({
        onReset: () => send({ type: "RESET" }),
        current: () => ({ value: encodeRef.current(latest.current) }),
      }),
    [formInput, send],
  )
  useEffect(() => {
    const node = input.current
    if (!node) return
    const watch = watchFieldsetDisabled(node, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    return watch.stop
  }, [])
  // field-control: the Control takes focus; the hidden input is the validity element.
  const register = binding?.register
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: ids.control,
        labelable: false,
        focus: (m) => {
          if (control.current) void focusSafely(control.current, env, "programmatic", m)
        },
        validityElement: () => input.current,
        value: () => latest.current,
      },
      ids.control,
    )
  }, [register, ids.control, env])
  const report = binding?.report
  const reported = useRef(current)
  useEffect(() => {
    if (reported.current === current) return
    reported.current = current
    const user = lastUser.current
    lastUser.current = false
    report?.({ type: "change", value: current, user, composing: false })
    if (user) report?.({ type: "commit" })
  }, [current, report])

  const toBlob = (options: SignatureExportOptions = {}) => {
    const el = control.current
    const color = el ? getComputedStyle(el).color : inkColor
    return exportSignature(latest.current, {
      ...options,
      color,
      ...(el ? { doc: el.ownerDocument } : {}),
    })
  }
  const download = async (fileName = "signature.png", options: SignatureExportOptions = {}) => {
    const blob = await toBlob(options)
    const doc = control.current?.ownerDocument ?? document
    saveBlob(doc, blob, sanitizeFileName(fileName, "signature.png"))
  }
  const state: SignaturePadRenderState = {
    state: view.state,
    value: current,
    empty: api.empty,
    strokeCount: api.strokeCount,
    disabled: field.disabled,
    readOnly: field.readOnly,
    toBlob,
    download,
  }
  const ctx: Ctx = {
    api,
    send,
    state,
    registry,
    ids: { label: ids.label, status: ids.status },
    control,
    binding,
  }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    { ...binding?.data, ...rest },
  )
  return (
    <SignaturePadContext value={ctx}>
      {renderPart(
        "div",
        {
          ...props,
          children: (
            <>
              {children}
              <HiddenInput props={normalizeProps(api.hiddenInput())} input={input} />
            </>
          ),
        },
        render,
        state,
      )}
    </SignaturePadContext>
  )
}

/**
 * The form input: its value is written as a property by `hiddenFormInput` only (never by
 * React, so no "value without onChange" warning, Zag 6ef9950); a form reset re-syncs it.
 */
function HiddenInput({
  props: { value: _value, ...rest },
  input,
}: {
  readonly props: Record<string, unknown>
  readonly input: { current: HTMLInputElement | null }
}) {
  return <input {...rest} ref={input} />
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<SignaturePadRenderState>
}

function Label({ render, id, ...rest }: PartProps<"span">) {
  const ctx = useSignaturePad("Label")
  const own = id ?? ctx.ids.label
  useRegisterPart(ctx.registry, "label", own)
  return renderPart(
    "span",
    mergeProps({ ...normalizeProps(ctx.api.label()), id: own }, rest),
    render,
    ctx.state,
  )
}

function Control({ render, ref, ...rest }: PartProps<"div">) {
  const ctx = useSignaturePad("Control")
  const el = useRef<HTMLElement | null>(null)
  const stop = useRef<(() => void) | null>(null)
  useEffect(() => {
    const node = el.current
    if (!node) return
    const undo = preventTouchScribble(node)
    return () => {
      undo()
      stop.current?.()
    }
  }, [])
  const send = ctx.send
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.control()), {
        onPointerDown: (e: PointerEvent<HTMLElement>) => {
          const native = e.nativeEvent
          if (!startsStroke(native) || ctx.state.disabled || ctx.state.readOnly) return
          // A press on a trigger inside the Control is the trigger's, not a stroke.
          if ((e.target as Element).closest?.("button, [role='button']")) return
          if (ctx.state.state === "drawing") return
          e.preventDefault()
          stop.current?.()
          stop.current = startStroke(e.currentTarget, native, (m) => {
            if (m.type === "down") {
              send({ type: "POINTER.DOWN", pointerId: m.pointerId, point: m.point, box: m.box })
            } else if (m.type === "move") {
              send({ type: "POINTER.MOVE", pointerId: m.pointerId, points: m.points })
            } else {
              stop.current = null
              send({
                type: m.type === "up" ? "POINTER.UP" : "POINTER.CANCEL",
                pointerId: m.pointerId,
              })
            }
          })
        },
      }),
      ref: composeRefs(composeRefs(el, ctx.control), ref),
    },
    rest,
  )
  return renderPart("div", props, render, ctx.state)
}

function Segment({ render, children, ...rest }: PartProps<"svg">) {
  const ctx = useSignaturePad("Segment")
  const props = mergeProps(normalizeProps(ctx.api.segment()), rest)
  return renderPart(
    "svg",
    {
      ...props,
      children: (
        <>
          {ctx.api.paths.map((d, i) => (
            // Strokes only grow at the end or shrink from it: the index is their identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <path key={i} {...normalizeProps(ctx.api.stroke(d))} />
          ))}
          {children}
        </>
      ),
    },
    render,
    ctx.state,
  )
}

function Guide({ render, ...rest }: PartProps<"div">) {
  const ctx = useSignaturePad("Guide")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.guide()), rest), render, ctx.state)
}

function Status({ render, id, children, ...rest }: PartProps<"span">) {
  const ctx = useSignaturePad("Status")
  const own = id ?? ctx.ids.status
  useRegisterPart(ctx.registry, "status", own)
  const props = mergeProps({ ...normalizeProps(ctx.api.status()), id: own }, rest)
  return renderPart(
    "span",
    { ...props, children: children ?? ctx.api.statusText },
    render,
    ctx.state,
  )
}

function trigger(part: "ClearTrigger" | "UndoTrigger", event: "CLEAR" | "UNDO") {
  return function Trigger({ render, ref, ...rest }: PartProps<"button">) {
    const ctx = useSignaturePad(part)
    const env = useEnvironment()
    // Tracks the modality from mount, so the first keyboard focus is already visible.
    useEffect(() => env.modality.subscribe(() => {}), [env])
    const [focused, setFocused] = useState(false)
    const modality = useModality(env.modality, focused)
    const el = useRef<HTMLElement | null>(null)
    const tag = useRenderedTag("button", render, el)
    const own = part === "ClearTrigger" ? ctx.api.clearTrigger : ctx.api.undoTrigger
    const api = normalizeProps(own({ tag, focused, modality }))
    // A consumer name replaces the default one, labelled-by included.
    if (rest["aria-label"] !== undefined && rest["aria-labelledby"] === undefined) {
      api["aria-labelledby"] = undefined
    }
    const native = tag === "button" || tag === "input"
    const props = mergeProps(
      {
        ...joinHandlers(api, {
          // Disabled but focusable (aria-disabled): the machine ignores it; focus stays.
          onClick: () => ctx.send({ type: event }),
          // A substituted non-button element: Enter and Space click it, as a button would.
          onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
            if (native || e.repeat) return
            if (e.key === "Enter") e.currentTarget.click()
            if (e.key === " ") e.preventDefault()
          },
          onKeyUp: (e: KeyboardEvent<HTMLElement>) => {
            if (!native && e.key === " ") e.currentTarget.click()
          },
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        }),
        ref: composeRefs(el, ref),
      },
      rest,
    )
    return renderPart("button", props, render, ctx.state)
  }
}

const ClearTrigger = trigger("ClearTrigger", "CLEAR")
const UndoTrigger = trigger("UndoTrigger", "UNDO")

/** The parts, by name: `signature-pad.parts.ts` re-exports them as the `SignaturePad` namespace. */
export { ClearTrigger, Control, Guide, Label, Root, Segment, Status, UndoTrigger }
