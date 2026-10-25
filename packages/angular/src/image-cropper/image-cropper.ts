// Image Cropper parts: wiring only. The machine owns the crop, zoom, rotation and flip, connect
// every attribute; core's crop gestures read the pointer, wheel and pinch on the viewport.
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
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
  type CropData,
  cropData,
  cropGestures,
  cropPlacementOf,
  type Flip,
  type HandlePosition,
  type ImageCropperEvent,
  type ImageCropperMessages,
  imageCropperConnect,
  imageCropperMachine,
  imageCropperMessages,
  type MessageOverrides,
  type PartProps,
  partId,
  type Rect,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages, withCapabilities } from "../provider"
import { RindProps } from "../rind-props"

/** The cropper's state, for the template (`#c="rindImageCropperRoot"`, `c.state()`). */
export interface ImageCropperRenderState {
  /** The crop in natural pixels. */
  readonly data: CropData | null
  readonly zoom: number
  readonly rotation: number
  readonly flip: Flip
  readonly dragging: boolean
}

/** The change details every value output carries: the crop in natural pixels too. */
export interface ImageCropperChangeDetails extends ChangeDetails<ImageCropperEvent> {
  readonly data: CropData | null
}

/** What a `<value>ChangeDetails` output emits. */
export interface ImageCropperChangeEvent<V> {
  readonly value: V
  /** `details.cancel()`, called synchronously, vetoes the change. */
  readonly details: ImageCropperChangeDetails
}

type Api = ReturnType<typeof imageCropperConnect>

const CROPPER = new InjectionToken<ImageCropperRoot>("rind-ui.image-cropper")

function injectCropper(part: string): ImageCropperRoot {
  const root = inject(CROPPER, { optional: true })
  if (!root) throw new Error(`rindImageCropper${part} must be inside rindImageCropperRoot`)
  return root
}

/**
 * Crops an image: `<div rindImageCropperRoot aria-label="Avatar">` with a Viewport holding the
 * `<img rindImageCropperImage>` and the Selection (its Handles and Grids); the instructions
 * follow.
 */
@Component({
  selector: "[rindImageCropperRoot]",
  exportAs: "rindImageCropperRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: CROPPER, useExisting: forwardRef(() => ImageCropperRoot) }],
  template: `<ng-content /><span [rindProps]="instructions()">{{ api().instructionsText }}</span>`,
})
export class ImageCropperRoot {
  readonly id = input<string>()
  /** Controlled crop (`[(crop)]`), viewport px. */
  readonly crop = input<Rect>()
  readonly defaultCrop = input<Rect>()
  /** Controlled zoom (`[(zoom)]`). */
  readonly zoom = input<number>()
  readonly defaultZoom = input<number>()
  /** Degrees, any angle (`[(rotation)]`). */
  readonly rotation = input<number>()
  readonly defaultRotation = input<number>()
  /** `[(flip)]`. */
  readonly flip = input<Flip>()
  readonly defaultFlip = input<Flip>()
  /** Smallest zoom (default 1). */
  readonly minZoom = input<number>()
  /** Largest zoom (default 5). */
  readonly maxZoom = input<number>()
  /** Per wheel notch and per + / − (default 0.1). */
  readonly zoomStep = input<number>()
  /** Pinch responsiveness (default 2). */
  readonly zoomSensitivity = input<number>()
  /** Width / height; free when omitted. */
  readonly aspectRatio = input<number>()
  /** A circle implies aspect 1. */
  readonly cropShape = input<"rectangle" | "circle">("rectangle")
  /** Viewport px (default 40). */
  readonly minWidth = input<number>()
  /** Viewport px (default 40). */
  readonly minHeight = input<number>()
  /** Viewport px (default Infinity). */
  readonly maxWidth = input<number>()
  /** Viewport px (default Infinity). */
  readonly maxHeight = input<number>()
  /** The crop stays; drags and arrows pan the image. */
  readonly fixedCropArea = input(false, { transform: booleanAttribute })
  /** Arrow step, px (default 1). */
  readonly nudgeStep = input(1)
  /** Shift+arrow step, px (default 10). */
  readonly nudgeStepShift = input(10)
  /** Ctrl/Cmd+arrow step, px (default 50). */
  readonly nudgeStepCtrl = input(50)
  readonly messages = input<MessageOverrides<ImageCropperMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  /** `details.data`: the crop in natural pixels (`rect`, `corners`). */
  readonly cropChangeDetails = output<ImageCropperChangeEvent<Rect>>()
  readonly cropChange = output<Rect>()
  readonly zoomChangeDetails = output<ImageCropperChangeEvent<number>>()
  readonly zoomChange = output<number>()
  readonly rotationChangeDetails = output<ImageCropperChangeEvent<number>>()
  readonly rotationChange = output<number>()
  readonly flipChangeDetails = output<ImageCropperChangeEvent<Flip>>()
  readonly flipChange = output<Flip>()

  /** @internal */
  readonly api: Signal<Api>
  /** @internal */
  readonly send: (event: ImageCropperEvent) => void
  /** The cropper's state, for the template. */
  readonly state: Signal<ImageCropperRenderState>
  /** @internal */
  protected readonly instructions: Signal<PartProps>

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const instance = injectRootId(() => this.id())
    const loc = injectLocale(() => this.locale())
    const messages = injectMessages("image-cropper", imageCropperMessages, () => this.messages())
    // The machine reports the natural-pixel crop of the placement it is about to write, so the
    // value outputs always get the current data (never the previous render's).
    let latestData: CropData | null = null
    const withData =
      <V>(details: { emit(e: ImageCropperChangeEvent<V>): void }, change: { emit(v: V): void }) =>
      (value: V, d: ChangeDetails<ImageCropperEvent>) => {
        let cancelled = false
        details.emit({
          value,
          details: {
            ...d,
            data: latestData,
            cancel() {
              cancelled = true
              d.cancel()
            },
          },
        })
        if (!cancelled) change.emit(value)
      }
    const machineProps = () => ({
      id: instance(),
      crop: this.crop(),
      defaultCrop: this.defaultCrop(),
      onCropChange: withData(this.cropChangeDetails, this.cropChange),
      zoom: this.zoom(),
      defaultZoom: this.defaultZoom(),
      onZoomChange: withData(this.zoomChangeDetails, this.zoomChange),
      rotation: this.rotation(),
      defaultRotation: this.defaultRotation(),
      onRotationChange: withData(this.rotationChangeDetails, this.rotationChange),
      flip: this.flip(),
      defaultFlip: this.defaultFlip(),
      onFlipChange: withData(this.flipChangeDetails, this.flipChange),
      minZoom: this.minZoom(),
      maxZoom: this.maxZoom(),
      zoomStep: this.zoomStep(),
      zoomSensitivity: this.zoomSensitivity(),
      aspectRatio: this.aspectRatio(),
      cropShape: this.cropShape(),
      minWidth: this.minWidth(),
      minHeight: this.minHeight(),
      maxWidth: this.maxWidth(),
      maxHeight: this.maxHeight(),
      fixedCropArea: this.fixedCropArea(),
      messages: messages(),
      lang: loc().locale,
    })
    const { view, send } = injectMachine(
      imageCropperMachine,
      machineProps,
      withCapabilities(env, {
        onData: (data: CropData) => {
          latestData = data
        },
      }),
    )
    this.send = send
    const placement = () => cropPlacementOf(view().values, view().context)
    const ready = () => view().state !== "loading"
    this.api = computed(() => {
      const v = view()
      return imageCropperConnect({
        instance: instance(),
        state: v.state as "loading" | "idle" | "dragging" | "settling",
        placement: placement(),
        crop: v.values.crop,
        shape: this.cropShape(),
        fixed: this.fixedCropArea(),
        dragging: v.state === "dragging" && v.context.drag?.target !== "image",
        panning: v.state === "dragging" && v.context.drag?.target === "image",
        ready: ready(),
        ids: { instructions: partId("image-cropper", instance(), "instructions") },
        messages: messages(),
        locale: loc().locale,
      })
    })
    this.state = computed(() => ({
      data: ready() ? cropData(placement(), view().values.crop) : null,
      zoom: view().values.zoom,
      rotation: view().values.rotation,
      flip: view().values.flip,
      dragging: view().state === "dragging",
    }))
    this.instructions = computed(() => {
      const { children: _text, ...own } = this.api().instructions()
      return own
    })
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "aspectratio",
          "crop",
          "cropshape",
          "defaultcrop",
          "defaultflip",
          "defaultrotation",
          "defaultzoom",
          "fixedcroparea",
          "flip",
          "id",
          "locale",
          "maxheight",
          "maxwidth",
          "maxzoom",
          "messages",
          "minheight",
          "minwidth",
          "minzoom",
          "nudgestep",
          "nudgestepctrl",
          "nudgestepshift",
          "rotation",
          "zoom",
          "zoomsensitivity",
          "zoomstep",
        ],
      },
    )
  }
}

/** The area that clips the image: pointer, wheel and pinch crop, pan and zoom it. */
@Directive({ selector: "[rindImageCropperViewport]", exportAs: "rindImageCropperViewport" })
export class ImageCropperViewport {
  constructor() {
    const root = injectCropper("Viewport")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() => root.api().viewport())
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      if (!(el instanceof HTMLElement)) return
      destroy.onDestroy(
        cropGestures(el, {
          onSize: (s) => root.send({ type: "VIEWPORT.MEASURED", ...s }),
          onDragStart: (target, x, y) => root.send({ type: "DRAG.START", target, x, y }),
          onDragMove: (x, y, lockRatio) => root.send({ type: "DRAG.MOVE", x, y, lockRatio }),
          onDragEnd: () => root.send({ type: "DRAG.END" }),
          onWheel: (direction, at) => root.send({ type: "ZOOM.STEP", direction, at }),
          onPinchStart: (distance) => root.send({ type: "PINCH.START", distance }),
          onPinchMove: (distance, center) => root.send({ type: "PINCH.MOVE", distance, center }),
          onPinchEnd: () => root.send({ type: "PINCH.END" }),
        }),
      )
    })
  }
}

/** The image: `<img rindImageCropperImage src="…">`. */
@Directive({ selector: "img[rindImageCropperImage]", exportAs: "rindImageCropperImage" })
export class ImageCropperImage {
  constructor() {
    const root = injectCropper("Image")
    const img: HTMLImageElement = inject(ElementRef).nativeElement
    const loaded = () =>
      root.send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
    bindProps(() => joinHandlers(root.api().image(), { onLoad: loaded }))
    if (inject(PLATFORM_ID) !== "browser") return
    // An image already decoded before hydration fires no load event.
    afterNextRender(() => {
      if (img.complete && img.naturalWidth > 0) loaded()
    })
  }
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** The crop: focusable; arrows move it (Alt resizes), + / − zoom. */
@Directive({ selector: "[rindImageCropperSelection]", exportAs: "rindImageCropperSelection" })
export class ImageCropperSelection {
  constructor() {
    const root = injectCropper("Selection")
    const env = injectEnvironment()
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    bindProps(() =>
      joinHandlers(root.api().selection({ focused: focused(), modality: modality() }), {
        onFocusIn: () => focused.set(true),
        onFocusOut: () => focused.set(false),
        onKeyDown: (e: KeyboardEvent) => {
          const arrow = ARROWS[e.key]
          if (arrow) {
            e.preventDefault()
            // Modifiers from the event itself (never a remembered keys-down set).
            const step =
              e.ctrlKey || e.metaKey
                ? root.nudgeStepCtrl()
                : e.shiftKey
                  ? root.nudgeStepShift()
                  : root.nudgeStep()
            root.send({
              type: "KEY.NUDGE",
              dx: arrow[0] * step,
              dy: arrow[1] * step,
              resize: e.altKey,
            })
            return
          }
          if (e.key === "+" || e.key === "=") {
            e.preventDefault()
            root.send({ type: "ZOOM.STEP", direction: 1 })
          } else if (e.key === "-" || e.key === "_") {
            e.preventDefault()
            root.send({ type: "ZOOM.STEP", direction: -1 })
          }
        },
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The modality tracker must see the key or pointer that comes before the selection's focus.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

/** A resize handle: `<div rindImageCropperHandle position="ne">`. */
@Directive({ selector: "[rindImageCropperHandle]", exportAs: "rindImageCropperHandle" })
export class ImageCropperHandle {
  /** The edge or corner it resizes: n, s, e, w, ne, nw, se or sw. */
  readonly position = input.required<HandlePosition>()
  constructor() {
    const root = injectCropper("Handle")
    bindProps(() => root.api().handle(this.position()), { owns: ["position"] })
  }
}

/** The thirds lines: `<div rindImageCropperGrid axis="horizontal">`. */
@Directive({ selector: "[rindImageCropperGrid]", exportAs: "rindImageCropperGrid" })
export class ImageCropperGrid {
  /** Which thirds lines it draws. */
  readonly axis = input.required<"horizontal" | "vertical">()
  constructor() {
    const root = injectCropper("Grid")
    bindProps(() => root.api().grid(this.axis()), { owns: ["axis"] })
  }
}

/** The Image Cropper's parts, for a standalone component's `imports`. */
export const ImageCropper = [
  ImageCropperRoot,
  ImageCropperViewport,
  ImageCropperImage,
  ImageCropperSelection,
  ImageCropperHandle,
  ImageCropperGrid,
] as const
