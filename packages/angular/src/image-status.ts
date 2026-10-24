// image-loading-status in Angular: the Root half (the shared machine, the source counter, the
// image registration) and the image half (registration after the first render, load/error
// events, `src` last). Shared by Avatar and Image, which differ only in their connect.

import {
  afterNextRender,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  Injector,
  inject,
  PLATFORM_ID,
  type Signal,
  untracked,
} from "@angular/core"
import {
  fallbackVisible,
  type ImageStatusProps,
  imageSettled,
  imageStatusMachine,
  type PartProps,
} from "@rind-ui/core"
import { injectMachine } from "./inject-machine"

type Send = ReturnType<typeof injectMachine<typeof imageStatusMachine>>["send"]

/** What the image part needs from its Root. */
export interface ImageHost {
  readonly send: Send
  /** Numbers the image's sources: load and error events of a replaced one are dropped. */
  readonly source: { current: number }
  readonly images: { current: number }
}

/**
 * The Root half: the status machine and the host the image part registers with. `onMount`
 * runs once after the first render (a development check).
 */
export function injectImageStatusRoot(props: () => ImageStatusProps, onMount: () => void) {
  const { view, send } = injectMachine(imageStatusMachine, props)
  const host: ImageHost = { send, source: { current: 0 }, images: { current: 0 } }
  if (inject(PLATFORM_ID) === "browser") {
    // The `read` phase runs after every `mixedReadWrite` callback of the render: after the
    // image read its element, so ROOT.MOUNT follows IMAGE.MOUNT (children mount first in React).
    afterNextRender({
      read: () => {
        send({ type: "ROOT.MOUNT" })
        onMount()
      },
    })
  }
  return {
    status: computed(() => view().state),
    fallback: computed(() => fallbackVisible(view().state, view().context.fallbackReady)),
    host,
  }
}

/** An empty source is no source: never written (browsers may refetch the page). */
const nonEmpty = (v: string | undefined): string | undefined => (v === "" ? undefined : v)

/** The image element's source inputs, as the image part declares them. */
export interface ImageSources {
  readonly src: () => string | undefined
  readonly srcset: () => string | undefined
  readonly sizes: () => string | undefined
  readonly loading: () => string | undefined
}

/**
 * The image half: the props of the one `<img>` the status is read from. `own` is the part's
 * connect output, given whether the element has a source; `onCount` gets the number of
 * registered images (a development check).
 */
export function injectStatusImage(
  host: ImageHost,
  own: (hasSource: boolean) => PartProps,
  sources: ImageSources,
  onCount: (count: number) => void,
): Signal<PartProps> {
  const { send, source, images } = host
  const img: HTMLImageElement = inject(ElementRef).nativeElement
  const url = () => nonEmpty(sources.src())
  const set = () => nonEmpty(sources.srcset())
  const hasSource = () => url() !== undefined || set() !== undefined
  // Reads the element: a load that fired before hydration is not missed.
  const read = (type: "IMAGE.MOUNT" | "IMAGE.SOURCE") => {
    const current = ++source.current
    const has = hasSource()
    const settled = has ? imageSettled(img) : "loading"
    if (typeof settled === "string") {
      send({ type, hasSource: has, source: current, settled })
      return
    }
    send({ type, hasSource: has, source: current, settled: "loading" })
    settled.then((status) => send({ type: "IMAGE.SETTLED", status, source: current }))
  }
  if (inject(PLATFORM_ID) === "browser") {
    let mounted = false
    afterNextRender(() => {
      images.current++
      onCount(images.current)
      mounted = true
      read("IMAGE.MOUNT")
    })
    // Re-reads the element when the source changes, after the DOM has it.
    const injector = inject(Injector)
    let last: string | undefined
    effect(() => {
      const key = `${url() ?? ""}\n${set() ?? ""}\n${sources.sizes() ?? ""}`
      if (last !== undefined && key !== last && mounted) {
        afterNextRender(() => untracked(() => read("IMAGE.SOURCE")), { injector })
      }
      last = key
    })
    inject(DestroyRef).onDestroy(() => {
      if (!mounted) return
      images.current--
      send({ type: "IMAGE.UNMOUNT" })
    })
  }
  return computed((): PartProps => {
    const u = url()
    const s = set()
    const sizes = sources.sizes()
    const loading = sources.loading()
    // `src` last: attributes are written in key order, and Safari and Firefox start fetching
    // when `src` lands, ignoring a `srcset`, `sizes` or `loading` set after it.
    return {
      ...own(hasSource()),
      onLoad: () => send({ type: "IMAGE.LOAD", source: source.current }),
      onError: () => send({ type: "IMAGE.ERROR", source: source.current }),
      ...(s === undefined ? {} : { srcset: s }),
      ...(sizes === undefined ? {} : { sizes }),
      ...(loading === undefined ? {} : { loading }),
      ...(u === undefined ? {} : { src: u }),
    }
  })
}
