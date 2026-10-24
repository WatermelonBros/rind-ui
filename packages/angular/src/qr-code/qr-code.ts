import {
  afterEveryRender,
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  blobToDataUrl,
  createQrEncoder,
  exportQr,
  type MessageOverrides,
  partId,
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
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { Button } from "../button/button"
import { CONTROL_OVERRIDE, HostedControl } from "../hosted-control"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"

export interface QrCodeState {
  /** `ready`: a symbol; `empty`: no value; `invalid`: the encoder failed. */
  readonly state: "ready" | "empty" | "invalid"
  readonly downloading: boolean
}

type Modality = "pointer" | "keyboard" | "touch" | "virtual"

const QR_CODE = new InjectionToken<QrCodeRoot>("rind-ui.qr-code")

function injectQrCode(part: string): QrCodeRoot {
  const root = inject(QR_CODE, { optional: true })
  if (!root) throw new Error(`rindQrCode${part} must be inside rindQrCodeRoot`)
  return root
}

/**
 * A value rendered as a scannable QR code symbol, named, described and downloadable:
 * `<div rindQrCodeRoot [defaultValue]="url">` with `<svg rindQrCodeFrame>` holding
 * `<path rindQrCodePattern>`, and optionally an Overlay, a ValueText and a DownloadTrigger.
 */
@Directive({
  selector: "[rindQrCodeRoot]",
  exportAs: "rindQrCodeRoot",
  providers: [{ provide: QR_CODE, useExisting: forwardRef(() => QrCodeRoot) }],
})
export class QrCodeRoot {
  /** Controlled value (`[(value)]`). */
  readonly value = input<string>()
  /** Default `""` (an empty frame). */
  readonly defaultValue = input<string>()
  /** Encoder options and the quiet zone, compared by value (an inline object is fine). */
  readonly encoding = input<QrEncodingOptions>()
  readonly messages = input<MessageOverrides<QrCodeMessages>>()
  readonly id = input<string>()
  readonly valueChange = output<string>()
  /** The encoder failed (too long, invalid option): once per distinct value. */
  readonly encodeError = output<QrEncodeFailure>()
  readonly download = output<QrDownloadDetails>()

  /** @internal */
  readonly connect: Signal<ReturnType<typeof qrCodeConnect>>
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"value-text">>
  /** @internal A ValueText is declared inside (the server HTML references it). */
  declared = false
  /** @internal */
  readonly mounted = signal(false)
  /** @internal */
  readonly current: () => string
  /** @internal */
  readonly instance: () => string
  readonly state: Signal<QrCodeState>
  private readonly send: ReturnType<typeof injectMachine<typeof qrCodeMachine>>["send"]
  private readonly encoded: Signal<ReturnType<ReturnType<typeof createQrEncoder>["encode"]>>
  // Mounted optional parts, reported to the machine (the overlay measurement needs them).
  private readonly parts = { valueText: 0, overlay: 0 }

  constructor() {
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const messages = injectMessages("qr-code", qrCodeMessages, () => this.messages())
    const encoder = createQrEncoder()
    // Stable: reads the latest options; the encoder memoises by value and option values.
    const encode = (v: string) => encoder.encode(v, untracked(this.encoding))
    const { view, send } = injectMachine(qrCodeMachine, () => ({
      value: this.value(),
      defaultValue: this.defaultValue(),
      onValueChange: (v: string) => this.valueChange.emit(v),
      encode,
      encodingKey: qrEncodingKey("", this.encoding()),
      root: instance(),
      onDownload: (d: QrDownloadDetails) => this.download.emit(d),
    }))
    this.send = send
    this.current = () => view().values.value
    this.encoded = computed(() => {
      this.encoding()
      return encode(this.current())
    })
    this.registry = injectPartRegistry<"value-text">(() => ({ scope: "qr-code", root: instance() }))
    this.state = computed(() => ({
      state: this.encoded().status,
      downloading: view().state === "downloading",
    }))
    this.connect = computed(() =>
      qrCodeConnect({
        instance: instance(),
        encoded: this.encoded(),
        downloading: this.state().downloading,
        covers: view().context.coverage?.covers,
        lastDownload: view().context.lastDownload?.fileName,
        messages: messages(),
      }),
    )
    bindProps(
      () => ({ ...this.connect().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      { owns: ["defaultvalue", "encoding", "id", "messages", "value"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => this.mounted.set(true))
    // Once per distinct failing value (and its options), after the first render.
    let reported: string | undefined
    effect(() => {
      if (!this.mounted()) return
      const e = this.encoded()
      const key =
        e.status === "invalid" ? qrEncodingKey(this.current(), this.encoding()) : undefined
      if (key === undefined || key === reported || e.status !== "invalid") return
      reported = key
      untracked(() => {
        warnEncodeError(e)
        this.encodeError.emit(e.error)
      })
    })
  }

  /** The symbol as a `data:` URL (PNG by default), overlay composited like a download. */
  async getDataUrl(
    mimeType: QrMime = "image/png",
    o: Omit<QrDownloadOptions, "mimeType" | "fileName"> = {},
  ): Promise<string> {
    const e = untracked(this.encoded)
    if (e.status !== "ready") throw new Error("[rind-ui] qr-code: there is no symbol to export")
    const ids = qrCodeIds(untracked(this.instance))
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
  }

  /** Starts a download, as pressing the trigger does (ignored while one runs). */
  startDownload(options: QrDownloadOptions & { readonly modality?: Modality } = {}): void {
    this.send({ type: "DOWNLOAD", modality: "virtual", ...options })
  }

  /** Proposes a new value (only `valueChange` when controlled). */
  setValue(value: string): void {
    this.send({ type: "VALUE.SET", value })
  }

  /** @internal */
  report(part: "valueText" | "overlay", on: boolean): void {
    this.parts[part] += on ? 1 : -1
    this.send({
      type: "PARTS.CHANGED",
      valueText: this.parts.valueText > 0,
      overlay: this.parts.overlay > 0,
    })
  }
}

/** Reports a mounted optional part to the Root while it exists. */
function injectReport(root: QrCodeRoot, part: "valueText" | "overlay") {
  if (inject(PLATFORM_ID) !== "browser") return
  afterNextRender(() => root.report(part, true))
  inject(DestroyRef).onDestroy(() => root.report(part, false))
}

/** The symbol: `<svg rindQrCodeFrame>`, the quiet zone in its viewBox, named with a symbol. */
@Directive({ selector: "[rindQrCodeFrame]", exportAs: "rindQrCodeFrame" })
export class QrCodeFrame {
  constructor() {
    const root = injectQrCode("Frame")
    const rendered = injectRenderedId(root.registry, "value-text")
    let named = false
    let describedBy: string | undefined
    const { statics } = bindProps(
      () => {
        const valueTextId =
          rendered() ??
          (!root.mounted() && root.declared
            ? partId("qr-code", root.instance(), "value-text")
            : undefined)
        return root.connect().frame({
          named,
          valueTextId,
          ...(describedBy === undefined ? {} : { describedBy }),
        })
      },
      { owns: ["aria-describedby"] },
    )
    named = statics.has("aria-label") || statics.has("aria-labelledby")
    describedBy = statics.get("aria-describedby")
  }
}

/** The dark modules: `<path rindQrCodePattern>`, one path of merged runs. */
@Directive({ selector: "[rindQrCodePattern]", exportAs: "rindQrCodePattern" })
export class QrCodePattern {
  constructor() {
    const root = injectQrCode("Pattern")
    bindProps(() => root.connect().pattern())
  }
}

/** Centred content over the symbol (a logo); the modules under it stay in the matrix. */
@Directive({ selector: "[rindQrCodeOverlay]", exportAs: "rindQrCodeOverlay" })
export class QrCodeOverlay {
  constructor() {
    const root = injectQrCode("Overlay")
    injectReport(root, "overlay")
    bindProps(() => root.connect().overlay())
  }
}

/**
 * The value as visually hidden text (its content, or the value): the frame's description.
 * Hidden while there is no symbol (React renders nothing).
 */
@Component({
  selector: "[rindQrCodeValueText]",
  exportAs: "rindQrCodeValueText",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ value() }}</ng-content>",
})
export class QrCodeValueText {
  readonly id = input<string>()
  /** @internal */
  protected readonly value: () => string
  constructor() {
    const root = injectQrCode("ValueText")
    root.declared = true
    this.value = root.current
    const shown = () => root.state().state === "ready"
    // connect always sets the part's id
    const id = () => this.id() ?? (root.connect().valueText()["id"] as string)
    injectRegisterPart(root.registry, "value-text", () => (shown() ? id() : undefined))
    injectReport(root, "valueText")
    bindProps(
      () =>
        shown()
          ? { ...root.connect().valueText(), ...(this.id() === undefined ? {} : { id: this.id() }) }
          : absentProps("qr-code", root.instance()),
      { owns: ["id"] },
    )
  }
}

/** Saves the symbol as a file: `<button rindQrCodeDownloadTrigger>`; `aria-disabled` meanwhile. */
@Directive({
  selector: "[rindQrCodeDownloadTrigger]",
  exportAs: "rindQrCodeDownloadTrigger",
  providers: [{ provide: CONTROL_OVERRIDE, useFactory: () => new HostedControl() }],
  hostDirectives: [Button],
})
export class QrCodeDownloadTrigger {
  readonly mimeType = input<QrMime>()
  readonly quality = input<number>()
  readonly fileName = input<string>()
  readonly size = input<number>()

  constructor() {
    const root = injectQrCode("DownloadTrigger")
    const el: Element = inject(ElementRef).nativeElement
    inject(CONTROL_OVERRIDE, { self: true }).source = {
      disabled: () => root.state().state !== "ready",
      focusableWhenDisabled: () => true,
    }
    const button = inject(Button, { self: true })
    const sub = button.press.subscribe((d) =>
      root.startDownload({
        modality: d.modality,
        ...(this.mimeType() === undefined ? {} : { mimeType: this.mimeType() }),
        ...(this.quality() === undefined ? {} : { quality: this.quality() }),
        ...(this.fileName() === undefined ? {} : { fileName: this.fileName() }),
        ...(this.size() === undefined ? {} : { size: this.size() }),
      }),
    )
    inject(DestroyRef).onDestroy(() => sub.unsubscribe())
    // Text content names the trigger (an icon-only one keeps the message name).
    const hasText = () => (el.textContent ?? "").trim() !== ""
    const text = signal(hasText())
    bindProps(() => ({ ...root.connect().downloadTrigger(text() || hasText()), type: "button" }), {
      owns: ["filename", "mimetype", "quality", "size"],
    })
    if (inject(PLATFORM_ID) === "browser") afterEveryRender({ read: () => text.set(hasText()) })
  }
}

/** The QR Code's parts, for a standalone component's `imports`. */
export const QrCode = [
  QrCodeRoot,
  QrCodeFrame,
  QrCodePattern,
  QrCodeOverlay,
  QrCodeValueText,
  QrCodeDownloadTrigger,
] as const
