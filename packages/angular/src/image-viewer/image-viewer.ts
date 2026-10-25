// Image Viewer parts: wiring only. The machine owns zoom and pan, connect every attribute;
// core's zoom gestures read the pointer, wheel and pinch on the viewport.
import {
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
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type ChangeDetails,
  type ImageViewerEvent,
  type ImageViewerMessages,
  imageViewerConnect,
  imageViewerMachine,
  imageViewerMessages,
  type MessageOverrides,
  maxZoomOf,
  minZoomOf,
  type PartProps,
  partId,
  roomOf,
  viewerPlacement,
  zoomGestures,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

/** The viewer's state, for the template (`#v="rindImageViewerRoot"`, `v.state()`). */
export interface ImageViewerRenderState {
  readonly zoom: number
  readonly zoomed: boolean
  readonly panning: boolean
}

type Api = ReturnType<typeof imageViewerConnect>

const VIEWER = new InjectionToken<ImageViewerRoot>("rind-ui.image-viewer")

function injectViewer(part: string): ImageViewerRoot {
  const root = inject(VIEWER, { optional: true })
  if (!root) throw new Error(`rindImageViewer${part} must be inside rindImageViewerRoot`)
  return root
}

/**
 * An image to zoom and pan: `<div rindImageViewerRoot>` with a Viewport holding the
 * `<img rindImageViewerImage alt="…">` and the zoom controls; the instructions follow.
 */
@Component({
  selector: "[rindImageViewerRoot]",
  exportAs: "rindImageViewerRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: VIEWER, useExisting: forwardRef(() => ImageViewerRoot) }],
  template: `<ng-content /><span [rindProps]="instructions()">{{ api().instructionsText }}</span>`,
})
export class ImageViewerRoot {
  readonly id = input<string>()
  /** Controlled zoom (`[(zoom)]`; 1 = the image fitted). */
  readonly zoom = input<number>()
  readonly defaultZoom = input<number>()
  readonly minZoom = input<number>()
  readonly maxZoom = input<number>()
  /** + / − and the buttons (default 0.5). */
  readonly step = input<number>()
  /** A double click toggles fit and this (default 2). */
  readonly doubleClickZoom = input<number>()
  /** A plain wheel scrolls the page (default) or zooms; ctrl-wheel and pinch always zoom. */
  readonly wheel = input<"page" | "zoom">("page")
  readonly messages = input<MessageOverrides<ImageViewerMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  /** Every change proposes a zoom; `details.cancel()` vetoes it. */
  readonly zoomChangeDetails = output<ChangeEvent<number, ImageViewerEvent>>()
  /** The accepted zoom, for `[(zoom)]`. */
  readonly zoomChange = output<number>()

  private readonly emit = changeEmitter<number, ImageViewerEvent>(
    this.zoomChangeDetails,
    this.zoomChange,
  )
  /** @internal */
  readonly api: Signal<Api>
  /** @internal */
  readonly send: (event: ImageViewerEvent) => void
  /** @internal The image's alt: the viewport's name. */
  readonly label = signal("")
  /** @internal Pan room on each axis (px), for the arrow keys. */
  readonly room: () => { readonly width: number; readonly height: number }
  /** @internal */
  readonly viewport: () => { readonly width: number; readonly height: number }
  /** The viewer's state, for the template. */
  readonly state: Signal<ImageViewerRenderState>
  /** @internal */
  protected readonly instructions: Signal<PartProps>

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const instance = injectRootId(() => this.id())
    const loc = injectLocale(() => this.locale())
    const messages = injectMessages("image-viewer", imageViewerMessages, () => this.messages())
    const machineProps = () => ({
      id: instance(),
      zoom: this.zoom(),
      defaultZoom: this.defaultZoom(),
      onZoomChange: (z: number, d: ChangeDetails<ImageViewerEvent>) => this.emit(z, d),
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom(),
      step: this.step(),
      doubleClickZoom: this.doubleClickZoom(),
      messages: messages(),
      lang: loc().locale,
    })
    const { view, send } = injectMachine(imageViewerMachine, machineProps, env)
    this.send = send
    this.api = computed(() => {
      const { context } = view()
      const current = view().values.zoom
      return imageViewerConnect({
        instance: instance(),
        state: view().state as "loading" | "idle" | "panning" | "settling",
        placement: viewerPlacement(context.natural, context.viewport, current, context.offset),
        minZoom: minZoomOf(machineProps()),
        maxZoom: maxZoomOf(machineProps()),
        label: this.label(),
        ids: { instructions: partId("image-viewer", instance(), "instructions") },
        messages: messages(),
        locale: loc().locale,
      })
    })
    this.state = computed(() => ({
      zoom: view().values.zoom,
      zoomed: view().values.zoom > minZoomOf(machineProps()),
      panning: view().state === "panning",
    }))
    this.room = () => roomOf(view().values.zoom, view().context)
    this.viewport = () => view().context.viewport
    this.instructions = computed(() => {
      const { children: _text, ...own } = this.api().instructions()
      return own
    })
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "defaultzoom",
          "doubleclickzoom",
          "id",
          "locale",
          "maxzoom",
          "messages",
          "minzoom",
          "step",
          "wheel",
          "zoom",
        ],
      },
    )
  }
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** The focusable group that clips the image: pointer, wheel, pinch and keys zoom and pan it. */
@Directive({ selector: "[rindImageViewerViewport]", exportAs: "rindImageViewerViewport" })
export class ImageViewerViewport {
  constructor() {
    const root = injectViewer("Viewport")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    bindProps(() =>
      joinHandlers(root.api().viewport({ focused: focused(), modality: modality() }), {
        onFocusIn: (e: FocusEvent) => {
          if (e.target === e.currentTarget) focused.set(true)
        },
        onFocusOut: (e: FocusEvent) => {
          if (e.target === e.currentTarget) focused.set(false)
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return
          if (e.key === "+" || e.key === "=") {
            e.preventDefault()
            root.send({ type: "ZOOM.STEP", direction: 1, source: "key" })
          } else if (e.key === "-" || e.key === "_") {
            e.preventDefault()
            root.send({ type: "ZOOM.STEP", direction: -1, source: "key" })
          } else if (e.key === "0") {
            e.preventDefault()
            root.send({ type: "RESET", source: "key" })
          } else {
            const arrow = ARROWS[e.key]
            if (!arrow) return
            const [ax, ay] = arrow
            const room = root.room()
            // Nothing to pan on this axis: the page scrolls.
            if ((ax !== 0 ? room.width : room.height) <= 0) return
            e.preventDefault()
            const share = e.shiftKey ? 0.5 : 0.1
            const vp = root.viewport()
            root.send({ type: "PAN.KEY", dx: ax * vp.width * share, dy: ay * vp.height * share })
          }
        },
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      if (!(el instanceof HTMLElement)) return
      destroy.onDestroy(
        zoomGestures(el, {
          onSize: (s) => root.send({ type: "VIEWPORT.MEASURED", ...s }),
          onDragStart: (x, y) => root.send({ type: "DRAG.START", x, y }),
          onDragMove: (x, y) => root.send({ type: "DRAG.MOVE", x, y }),
          onDragEnd: () => root.send({ type: "DRAG.END" }),
          onZoomBy: (factor, at) => root.send({ type: "ZOOM.BY", factor, at }),
          onPinchStart: (distance) => root.send({ type: "PINCH.START", distance }),
          onPinchMove: (distance, center) => root.send({ type: "PINCH.MOVE", distance, center }),
          onPinchEnd: () => root.send({ type: "PINCH.END" }),
          onToggle: (at) => root.send({ type: "TOGGLE", at }),
          wheelZooms: () => root.wheel() === "zoom",
        }),
      )
      // The modality tracker must see the pointerdown that comes before the viewport's focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
    })
  }
}

/** The image: `<img rindImageViewerImage src="…" alt="…">`; its alt names the viewport. */
@Directive({ selector: "img[rindImageViewerImage]", exportAs: "rindImageViewerImage" })
export class ImageViewerImage {
  /** The image's description: it names the viewport (the image itself is hidden). */
  readonly alt = input<string>()
  constructor() {
    const root = injectViewer("Image")
    const img: HTMLImageElement = inject(ElementRef).nativeElement
    const loaded = () =>
      root.send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
    bindProps(() => joinHandlers(root.api().image(), { onLoad: loaded }), { owns: ["alt"] })
    if (inject(PLATFORM_ID) !== "browser") return
    // On the client, as React's effect: the server HTML has no name yet.
    effect(() => root.label.set(this.alt() ?? ""))
    // An image already decoded before hydration fires no load event.
    afterNextRender(() => {
      if (img.complete && img.naturalWidth > 0) loaded()
    })
  }
}

/** Only text children: they name the button (a visible "−" named "Zoom out" fails label-in-name). */
function textOnly(el: Element): boolean {
  const nodes = Array.from(el.childNodes).filter((n) => n.nodeType !== Node.COMMENT_NODE)
  return (
    nodes.length > 0 &&
    nodes.every((n) => n.nodeType === Node.TEXT_NODE) &&
    (el.textContent ?? "").trim() !== ""
  )
}

/** A control button: a no-op while aria-disabled (it keeps its focus at the limit). */
@Directive()
abstract class ViewerControl {
  constructor(part: string, propsOf: (api: Api) => PartProps, event: ImageViewerEvent) {
    const root = injectViewer(part)
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() => {
      const own = propsOf(root.api())
      return joinHandlers(textOnly(el) ? { ...own, "aria-label": undefined } : own, {
        onClick: () => {
          if (own["aria-disabled"] !== "true") root.send(event)
        },
      })
    })
  }
}

@Directive({ selector: "[rindImageViewerZoomIn]", exportAs: "rindImageViewerZoomIn" })
export class ImageViewerZoomIn extends ViewerControl {
  constructor() {
    super("ZoomIn", (api) => api.zoomIn(), { type: "ZOOM.STEP", direction: 1, source: "button" })
  }
}

@Directive({ selector: "[rindImageViewerZoomOut]", exportAs: "rindImageViewerZoomOut" })
export class ImageViewerZoomOut extends ViewerControl {
  constructor() {
    super("ZoomOut", (api) => api.zoomOut(), {
      type: "ZOOM.STEP",
      direction: -1,
      source: "button",
    })
  }
}

@Directive({ selector: "[rindImageViewerReset]", exportAs: "rindImageViewerReset" })
export class ImageViewerReset extends ViewerControl {
  constructor() {
    super("Reset", (api) => api.reset(), { type: "RESET", source: "button" })
  }
}

/** The zoom as text: its content, or the percentage. */
@Component({
  selector: "[rindImageViewerZoomText]",
  exportAs: "rindImageViewerZoomText",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ImageViewerZoomText {
  /** @internal */
  protected readonly text: () => string
  constructor() {
    const root = injectViewer("ZoomText")
    this.text = () => root.api().zoomText
    bindProps(() => root.api().zoomTextPart())
  }
}

/** The Image Viewer's parts, for a standalone component's `imports`. */
export const ImageViewer = [
  ImageViewerRoot,
  ImageViewerViewport,
  ImageViewerImage,
  ImageViewerZoomIn,
  ImageViewerZoomOut,
  ImageViewerReset,
  ImageViewerZoomText,
] as const
