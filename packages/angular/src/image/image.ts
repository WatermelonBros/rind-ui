import {
  computed,
  Directive,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
} from "@angular/core"
import {
  checkImageAltGiven,
  checkImgCount,
  type ImageStatus,
  type ImageStatusProps,
  imageConnect,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { type ImageHost, injectImageStatusRoot, injectStatusImage } from "../image-status"

export interface ImageState {
  readonly status: ImageStatus
}

type StatusChange = Parameters<NonNullable<ImageStatusProps["onStatusChange"]>>

const IMAGE = new InjectionToken<ImageRoot>("rind-ui.image")

function injectImage(part: string): ImageRoot {
  const root = inject(IMAGE, { optional: true })
  if (!root) throw new Error(`rindImage${part} must be inside rindImageRoot`)
  return root
}

/**
 * An image with a fallback: `<span rindImageRoot alt="A red bicycle">` holding an
 * `<img rindImageImg>` and a `rindImageFallback`, shown while there is no image to show.
 */
@Directive({
  selector: "[rindImageRoot]",
  exportAs: "rindImageRoot",
  providers: [{ provide: IMAGE, useExisting: forwardRef(() => ImageRoot) }],
})
export class ImageRoot {
  /**
   * Required: the text alternative, or `""` for a decorative image. It names the `<img>`
   * while the image loads and Root when there is no image to show.
   */
  readonly alt = input.required<string>()
  /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
  readonly fallbackDelay = input<number>()
  readonly id = input<string>()
  /** Every status change (observed, not controlled). */
  readonly statusChange = output<StatusChange>()

  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly host: ImageHost
  /** @internal */
  readonly api: () => ReturnType<typeof imageConnect>
  /** @internal */
  readonly fallback: () => boolean
  /** The image's state, for the template (`#i="rindImageRoot"`, `i.state()`). */
  readonly state: () => ImageState

  constructor() {
    const { status, fallback, host } = injectImageStatusRoot(
      () => ({
        fallbackDelay: this.fallbackDelay(),
        onStatusChange: (...args: StatusChange) => this.statusChange.emit(args),
      }),
      () => checkImageAltGiven(this.alt(), this.instance()),
    )
    this.host = host
    this.fallback = fallback
    const api = computed(() =>
      imageConnect({ instance: this.instance(), status: status(), alt: this.alt() }),
    )
    this.api = api
    this.state = computed(() => ({ status: status() }))
    bindProps(() => ({ ...api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }), {
      owns: ["alt", "fallbackdelay", "id"],
    })
  }
}

/** The `<img>` (its `alt` is Root's). */
@Directive({ selector: "[rindImageImg]", exportAs: "rindImageImg" })
export class ImageImg {
  readonly src = input<string>()
  readonly srcset = input<string>()
  readonly sizes = input<string>()
  readonly loading = input<string>()
  constructor() {
    const root = injectImage("Img")
    const props = injectStatusImage(
      root.host,
      (has) => root.api().img(has),
      {
        src: () => this.src(),
        srcset: () => this.srcset(),
        sizes: () => this.sizes(),
        loading: () => this.loading(),
      },
      checkImgCount,
    )
    bindProps(() => props(), { owns: ["loading", "sizes", "src", "srcset"] })
  }
}

/** Shown while there is no image to show; hidden otherwise (React renders nothing). */
@Directive({ selector: "[rindImageFallback]", exportAs: "rindImageFallback" })
export class ImageFallback {
  constructor() {
    const root = injectImage("Fallback")
    bindProps(() =>
      root.fallback() ? root.api().fallback() : absentProps("image", root.instance()),
    )
  }
}

/** The Image's parts, for a standalone component's `imports`. */
export const Image = [ImageRoot, ImageImg, ImageFallback] as const
