/** @jsxImportSource solid-js */
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
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  type JSX,
  onCleanup,
  children as resolve,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { Button, type ButtonProps } from "../button/button"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "qr-code": QrCodeMessages
  }
}

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
type Modality = "pointer" | "keyboard" | "touch" | "virtual"

interface Ctx {
  readonly connect: Accessor<ReturnType<typeof qrCodeConnect>>
  readonly registry: PartRegistry<Part>
  readonly value: Accessor<string>
  readonly state: QrCodeState
  readonly download: (options: QrDownloadOptions & { readonly modality: Modality }) => void
  readonly report: (part: "valueText" | "overlay", mounted: boolean) => void
}

const QrCodeContext = createContext<Ctx>()
function useQrCode(part: string): Ctx {
  const ctx = useContext(QrCodeContext)
  if (!ctx) throw new Error(`QrCode.${part} must be inside QrCode.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<QrCodeState> | undefined
  readonly children?: JSX.Element | ((state: QrCodeState) => JSX.Element)
}

export type QrCodeRootProps = PartProps<
  Omit<JSX.HTMLAttributes<HTMLDivElement>, "defaultValue">
> & {
  readonly value?: string | undefined
  /** Default `""` (an empty frame). */
  readonly defaultValue?: string | undefined
  readonly onValueChange?: ((value: string) => void) | undefined
  /** Encoder options and the quiet zone, compared by value (an inline object is fine). */
  readonly encoding?: QrEncodingOptions | undefined
  /** The encoder failed (too long, invalid option): once per distinct value. */
  readonly onEncodeError?: ((error: QrEncodeFailure) => void) | undefined
  readonly onDownload?: ((details: QrDownloadDetails) => void) | undefined
  readonly messages?: MessageOverrides<QrCodeMessages> | undefined
  /** Receives the imperative API once, when the Root is created: `getDataUrl`, `download`, `setValue`. */
  readonly apiRef?: ((api: QrCodeApi) => void) | undefined
}

function Root(props: QrCodeRootProps) {
  const [own, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "encoding",
    "onEncodeError",
    "onDownload",
    "messages",
    "apiRef",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const messages = useMessages("qr-code", qrCodeMessages, () => own.messages)
  const encoder = createQrEncoder()
  // The encoder memoises by value and option values.
  const encode = (v: string) => encoder.encode(v, own.encoding)
  const { view, send } = useMachine(qrCodeMachine, () => ({
    value: own.value,
    defaultValue: own.defaultValue,
    onValueChange: (v: string) => own.onValueChange?.(v),
    encode,
    encodingKey: qrEncodingKey("", own.encoding),
    root: instance(),
    onDownload: (d: QrDownloadDetails) => own.onDownload?.(d),
  }))
  const current = () => view().values.value
  const encoded = createMemo(() => encode(current()))
  // A ValueText cannot be known from the tree before it renders (no element tree): the frame
  // references it from mount on.
  const registry = usePartRegistry<Part>({ scope: "qr-code", root: instance(), optional: [] })

  // Once per distinct failing value (and its options), after mount: never during render.
  afterMount(() => {
    let reported: string | undefined
    createEffect(() => {
      const e = encoded()
      const key = e.status === "invalid" ? qrEncodingKey(current(), own.encoding) : undefined
      if (key === undefined || key === reported) return
      reported = key
      if (e.status !== "invalid") return
      warnEncodeError(e)
      own.onEncodeError?.(e.error)
    })
  })

  // Mounted optional parts, reported to the machine (the overlay measurement needs them).
  const parts = { valueText: 0, overlay: 0 }
  const report = (part: "valueText" | "overlay", mounted: boolean) => {
    parts[part] += mounted ? 1 : -1
    send({
      type: "PARTS.CHANGED",
      valueText: parts.valueText > 0,
      overlay: parts.overlay > 0,
    })
  }
  const downloading = () => view().state === "downloading"
  const state = reactive<QrCodeState>(() => ({
    state: encoded().status,
    downloading: downloading(),
  }))
  const connect = createMemo(() =>
    qrCodeConnect({
      instance: instance(),
      encoded: encoded(),
      downloading: downloading(),
      covers: view().context.coverage?.covers,
      lastDownload: view().context.lastDownload?.fileName,
      messages: messages(),
    }),
  )
  own.apiRef?.({
    getDataUrl: async (mimeType = "image/png", o = {}) => {
      const e = encoded()
      if (e.status !== "ready") throw new Error("[rind-ui] qr-code: there is no symbol to export")
      const ids = qrCodeIds(instance())
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
  })
  const ctx: Ctx = {
    connect,
    registry,
    value: current,
    state,
    download: ({ modality, ...o }) => send({ type: "DOWNLOAD", modality, ...o }),
    report,
  }
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(connect().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <QrCodeContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </QrCodeContext.Provider>
  )
}

/** Reports a mounted optional part to the Root while it lives. */
function useReported(ctx: Ctx, part: "valueText" | "overlay") {
  afterMount(() => {
    ctx.report(part, true)
    onCleanup(() => ctx.report(part, false))
  })
}

export type QrCodeFrameProps = PartProps<JSX.SvgSVGAttributes<SVGSVGElement>>

/** The symbol: an `svg` with the quiet zone in its viewBox, named when there is a symbol. */
function Frame(props: QrCodeFrameProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useQrCode("Frame")
  const valueTextId = useRenderedId(ctx.registry, "value-text")
  const merged = createMemo(() => {
    const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
    const describedBy = rest["aria-describedby"]
    return mergeProps(
      normalizeProps(
        ctx.connect().frame({
          named,
          valueTextId: valueTextId(),
          ...(describedBy === undefined ? {} : { describedBy }),
        }),
      ),
      Object.fromEntries(Object.entries(rest).filter(([k]) => k !== "aria-describedby")),
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    // biome-ignore lint/a11y/noSvgWithoutTitle: connect sets the role and the name
    <svg {...p}>{children()}</svg>
  ))
}

export type QrCodePatternProps = PartProps<JSX.PathSVGAttributes<SVGPathElement>>

/** The dark modules: one path of merged runs. */
function Pattern(props: QrCodePatternProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useQrCode("Pattern")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.connect().pattern()), rest))
  return renderPart(
    local.render,
    merged,
    ctx.state,
    () => undefined,
    (p) => <path {...p} />,
  )
}

export type QrCodeOverlayProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** Centred content over the symbol (a logo); the modules under it stay in the matrix. */
function Overlay(props: QrCodeOverlayProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useQrCode("Overlay")
  useReported(ctx, "overlay")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.connect().overlay()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type QrCodeValueTextProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

/**
 * The value as visually hidden text: the frame's description. Nothing while there is no
 * symbol (empty or invalid): there is no image for it to describe.
 */
function ValueText(props: QrCodeValueTextProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useQrCode("ValueText")
  const shown = () => ctx.state.state === "ready"
  // connect always sets the part's id
  const id = () => rest.id ?? (ctx.connect().valueText()["id"] as string)
  useRegisterPart(ctx.registry, "value-text", () => (shown() ? id() : undefined))
  useReported(ctx, "valueText")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.connect().valueText()), rest))
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.value()
  return (
    <Show when={shown()}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <span {...p}>{children()}</span>
      ))}
    </Show>
  )
}

export type QrCodeDownloadTriggerProps = Omit<
  ButtonProps,
  "render" | "disabled" | "focusableWhenDisabled" | "onPress" | "type" | "children"
> &
  QrDownloadOptions & {
    /** Visible content; without it the trigger is named by `messages.download`. */
    readonly children?: JSX.Element
    readonly render?: RenderProp<QrCodeState> | undefined
  }

/** Saves the symbol as a file; `aria-disabled` while there is no symbol. */
function DownloadTrigger(props: QrCodeDownloadTriggerProps) {
  const [local, rest] = splitProps(props, [
    "mimeType",
    "quality",
    "fileName",
    "size",
    "render",
    "children",
  ])
  const ctx = useQrCode("DownloadTrigger")
  const content = resolve(() => local.children)
  const hasContent = () => {
    const c = content()
    return c !== undefined && c !== null && c !== false
  }
  // The trigger's props are Button props: the merged own and consumer props.
  const merged = createMemo(
    () =>
      mergeProps(normalizeProps(ctx.connect().downloadTrigger(hasContent())), rest) as ButtonProps,
  )
  return (
    <Button
      {...merged()}
      // A render callback gets the QR code's state, not the inner Button's.
      render={local.render && ((p) => local.render?.(p, ctx.state))}
      type="button"
      disabled={ctx.state.state !== "ready"}
      focusableWhenDisabled
      onPress={(d) =>
        ctx.download({
          modality: d.modality,
          ...(local.mimeType === undefined ? {} : { mimeType: local.mimeType }),
          ...(local.quality === undefined ? {} : { quality: local.quality }),
          ...(local.fileName === undefined ? {} : { fileName: local.fileName }),
          ...(local.size === undefined ? {} : { size: local.size }),
        })
      }
    >
      {content()}
    </Button>
  )
}

/** The parts, by name: `qr-code.parts.ts` re-exports them as the `QrCode` namespace. */
export { DownloadTrigger, Frame, Overlay, Pattern, Root, ValueText }
