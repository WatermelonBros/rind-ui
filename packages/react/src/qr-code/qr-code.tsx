"use client"

import {
  blobToDataUrl,
  createQrEncoder,
  exportQr,
  type MessageOverrides,
  type QrCodeMessages,
  type QrDownloadDetails,
  type QrDownloadOptions,
  type QrEncodeFailure,
  type QrEncodingOptions,
  type QrMime,
  qrCodeConnect,
  qrCodeIds,
  qrCodeMachine,
  qrCodeMessages,
  qrEncodingKey,
  warnEncodeError,
} from "@rind-ui/core"
import {
  Children,
  type ComponentPropsWithRef,
  createContext,
  isValidElement,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import { Button, type ButtonProps } from "../button/button"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  type PartRegistry,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
} from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "qr-code": QrCodeMessages
  }
}

// useLayoutEffect warns on the server; it never runs there anyway.
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface QrCodeState {
  /** `ready`: a symbol; `empty`: no value; `invalid`: the encoder failed. */
  readonly state: "ready" | "empty" | "invalid"
  readonly downloading: boolean
}

/** The Root's imperative API (`apiRef`). */
export interface QrCodeApi {
  /** The symbol as a `data:` URL (PNG by default), overlay composited like a download. */
  readonly getDataUrl: (
    mimeType?: QrMime,
    options?: Omit<QrDownloadOptions, "mimeType" | "fileName">,
  ) => Promise<string>
  /** Starts a download, as pressing the trigger does (ignored while one runs). */
  readonly download: (options?: QrDownloadOptions) => void
  /** Proposes a new value (only `onValueChange` when controlled). */
  readonly setValue: (value: string) => void
}

type Part = "value-text"

interface Ctx {
  readonly connect: ReturnType<typeof qrCodeConnect>
  readonly registry: PartRegistry<Part>
  readonly value: string
  readonly state: QrCodeState
  readonly download: (options: QrDownloadOptions & { readonly modality: Modality }) => void
  readonly report: (part: "valueText" | "overlay", mounted: boolean) => void
}
type Modality = "pointer" | "keyboard" | "touch" | "virtual"

const QrCodeContext = createContext<Ctx | null>(null)
function useQrCode(part: string): Ctx {
  const ctx = useContext(QrCodeContext)
  if (!ctx) throw new Error(`QrCode.${part} must be inside QrCode.Root`)
  return ctx
}

export type QrCodeRootProps = Omit<ComponentPropsWithRef<"div">, "defaultValue"> & {
  readonly value?: string
  /** Default `""` (an empty frame). */
  readonly defaultValue?: string
  readonly onValueChange?: (value: string) => void
  /** Encoder options and the quiet zone, compared by value (an inline object is fine). */
  readonly encoding?: QrEncodingOptions
  /** The encoder failed (too long, invalid option): once per distinct value. */
  readonly onEncodeError?: (error: QrEncodeFailure) => void
  readonly onDownload?: (details: QrDownloadDetails) => void
  readonly messages?: MessageOverrides<QrCodeMessages>
  /** Receives the imperative API: `getDataUrl`, `download`, `setValue`. */
  readonly apiRef?: Ref<QrCodeApi>
  readonly render?: RenderProp<QrCodeState>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  encoding,
  onEncodeError,
  onDownload,
  messages: ownMessages,
  apiRef,
  render,
  id,
  children,
  ...rest
}: QrCodeRootProps) {
  const instance = useRootId(id)
  const messages = useMessages("qr-code", qrCodeMessages, ownMessages)
  const [encoder] = useStateOnce(createQrEncoder)
  const options = useRef(encoding)
  options.current = encoding
  // Stable: reads the latest options; the encoder memoises by value and option values.
  const encode = useCallback((v: string) => encoder.encode(v, options.current), [encoder])
  const encodingKey = qrEncodingKey("", encoding)
  const { view, send } = useMachine(qrCodeMachine, {
    value,
    defaultValue,
    onValueChange: onValueChange && ((v: string) => onValueChange(v)),
    encode,
    encodingKey,
    root: instance,
    onDownload,
  })
  const current = view.values.value
  const encoded = encode(current)
  // A ValueText in the element tree is known at render, on the server too: only then does
  // the frame reference it before mount. One inside another component registers after mount.
  const registry = usePartRegistry<Part>({
    scope: "qr-code",
    root: instance,
    optional: containsElement(children, ValueText) ? ["value-text"] : [],
  })

  // Once per distinct failing value (and its options), after commit: never during render.
  const reported = useRef<string | undefined>(undefined)
  const failureKey = encoded.status === "invalid" ? qrEncodingKey(current, encoding) : undefined
  const latest = useRef({ encoded, onEncodeError })
  latest.current = { encoded, onEncodeError }
  useEffect(() => {
    if (failureKey === undefined || failureKey === reported.current) return
    reported.current = failureKey
    const e = latest.current.encoded
    if (e.status !== "invalid") return
    warnEncodeError(e)
    latest.current.onEncodeError?.(e.error)
  }, [failureKey])

  // Mounted optional parts, reported to the machine (the overlay measurement needs them).
  const parts = useRef({ valueText: 0, overlay: 0 })
  const report = useCallback(
    (part: "valueText" | "overlay", mounted: boolean) => {
      parts.current[part] += mounted ? 1 : -1
      send({
        type: "PARTS.CHANGED",
        valueText: parts.current.valueText > 0,
        overlay: parts.current.overlay > 0,
      })
    },
    [send],
  )
  const downloading = view.state === "downloading"
  const state: QrCodeState = useMemo(
    () => ({ state: encoded.status, downloading }),
    [encoded.status, downloading],
  )
  const connect = qrCodeConnect({
    instance,
    encoded,
    downloading,
    covers: view.context.coverage?.covers,
    lastDownload: view.context.lastDownload?.fileName,
    messages,
  })
  const latestEncoded = useRef(encoded)
  latestEncoded.current = encoded
  useImperativeHandle(
    apiRef,
    (): QrCodeApi => ({
      getDataUrl: async (mimeType = "image/png", o = {}) => {
        const e = latestEncoded.current
        if (e.status !== "ready") throw new Error("[rind-ui] qr-code: there is no symbol to export")
        const ids = qrCodeIds(instance)
        const byId = (i: string) => document.getElementById(i)
        const { blob } = await exportQr({
          modules: e.result.modules,
          quietZone: e.quietZone,
          mimeType,
          quality: o.quality,
          size: o.size ?? 1024,
          frame: byId(ids.frame),
          pattern: byId(ids.pattern),
          overlay: byId(ids.overlay),
        })
        return blobToDataUrl(blob)
      },
      download: (o = {}) => send({ type: "DOWNLOAD", modality: "virtual", ...o }),
      setValue: (v) => send({ type: "VALUE.SET", value: v }),
    }),
    [instance, send],
  )
  const ctx: Ctx = {
    connect,
    registry,
    value: current,
    state,
    download: ({ modality, ...o }) => send({ type: "DOWNLOAD", modality, ...o }),
    report,
  }
  const props = mergeProps(
    {
      ...normalizeProps(connect.root()),
      ...(id === undefined ? {} : { id }),
      children,
    },
    rest,
  )
  return <QrCodeContext value={ctx}>{renderPart("div", props, render, state)}</QrCodeContext>
}

/** Whether `type` is rendered directly in the element tree (not inside another component). */
function containsElement(node: ReactNode, type: unknown): boolean {
  let found = false
  Children.forEach(node, (child) => {
    if (found || !isValidElement(child)) return
    if (child.type === type) found = true
    else found = containsElement((child.props as { children?: ReactNode }).children, type)
  })
  return found
}

/** A value computed once per component instance. */
function useStateOnce<T>(create: () => T): [T] {
  const ref = useRef<{ value: T } | null>(null)
  if (ref.current === null) ref.current = { value: create() }
  return [ref.current.value]
}

export type QrCodeFrameProps = ComponentPropsWithRef<"svg"> & {
  readonly render?: RenderProp<QrCodeState>
}

/** The symbol: an `svg` with the quiet zone in its viewBox, named when there is a symbol. */
function Frame({ render, ...rest }: QrCodeFrameProps) {
  const ctx = useQrCode("Frame")
  const valueTextId = useRenderedId(ctx.registry, "value-text")
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const { "aria-describedby": describedBy, ...own } = rest
  const props = mergeProps(
    normalizeProps(
      ctx.connect.frame({
        named,
        valueTextId,
        ...(describedBy === undefined ? {} : { describedBy }),
      }),
    ),
    own,
  )
  return renderPart("svg", props, render, ctx.state)
}

export type QrCodePatternProps = ComponentPropsWithRef<"path"> & {
  readonly render?: RenderProp<QrCodeState>
}

/** The dark modules: one path of merged runs. */
function Pattern({ render, ...rest }: QrCodePatternProps) {
  const ctx = useQrCode("Pattern")
  return renderPart(
    "path",
    mergeProps(normalizeProps(ctx.connect.pattern()), rest),
    render,
    ctx.state,
  )
}

export type QrCodeOverlayProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<QrCodeState>
}

/** Centred content over the symbol (a logo); the modules under it stay in the matrix. */
function Overlay({ render, ...rest }: QrCodeOverlayProps) {
  const ctx = useQrCode("Overlay")
  const { report } = ctx
  useIsoLayoutEffect(() => {
    report("overlay", true)
    return () => report("overlay", false)
  }, [report])
  return renderPart(
    "div",
    mergeProps(normalizeProps(ctx.connect.overlay()), rest),
    render,
    ctx.state,
  )
}

export type QrCodeValueTextProps = ComponentPropsWithRef<"span"> & {
  readonly render?: RenderProp<QrCodeState>
}

/**
 * The value as visually hidden text: the frame's description. Nothing while there is no
 * symbol (empty or invalid): there is no image for it to describe.
 */
function ValueText({ render, children, ...rest }: QrCodeValueTextProps) {
  const ctx = useQrCode("ValueText")
  const own = ctx.connect.valueText()
  const shown = ctx.state.state === "ready"
  const id = rest.id ?? (own["id"] as string) // connect always sets the part's id
  useRegisterPart(ctx.registry, "value-text", shown ? id : undefined)
  const { report } = ctx
  useIsoLayoutEffect(() => {
    report("valueText", true)
    return () => report("valueText", false)
  }, [report])
  if (!shown) return null
  const props = mergeProps({ ...normalizeProps(own), children: children ?? ctx.value }, rest)
  return renderPart("span", props, render, ctx.state)
}

export type QrCodeDownloadTriggerProps = Omit<
  ButtonProps,
  "render" | "disabled" | "focusableWhenDisabled" | "onPress" | "type"
> &
  QrDownloadOptions & {
    /** Visible content; without it the trigger is named by `messages.download`. */
    readonly children?: ReactNode
    readonly render?: RenderProp<QrCodeState>
  }

/** Saves the symbol as a file; `aria-disabled` while there is no symbol. */
function DownloadTrigger({
  mimeType,
  quality,
  fileName,
  size,
  render,
  children,
  ...rest
}: QrCodeDownloadTriggerProps) {
  const ctx = useQrCode("DownloadTrigger")
  const hasContent = children !== undefined && children !== null && children !== false
  const own = normalizeProps(ctx.connect.downloadTrigger(hasContent))
  // The trigger's props are Button props: the merged own and consumer props.
  const merged = mergeProps(own, rest) as ButtonProps
  // A render callback gets the QR code's state, not the inner Button's.
  const asButton =
    render === undefined
      ? {}
      : typeof render === "function"
        ? { render: (props: Record<string, unknown>) => render(props, ctx.state) }
        : { render }
  return (
    <Button
      {...merged}
      {...asButton}
      type="button"
      disabled={ctx.state.state !== "ready"}
      focusableWhenDisabled
      onPress={(d) =>
        ctx.download({
          modality: d.modality,
          ...(mimeType === undefined ? {} : { mimeType }),
          ...(quality === undefined ? {} : { quality }),
          ...(fileName === undefined ? {} : { fileName }),
          ...(size === undefined ? {} : { size }),
        })
      }
    >
      {children}
    </Button>
  )
}

/** A value rendered as a scannable QR code symbol, named, described and downloadable. */
/** The parts, by name: `qr-code.parts.ts` re-exports them as the `QrCode` namespace. */
export { DownloadTrigger, Frame, Overlay, Pattern, Root, ValueText }
