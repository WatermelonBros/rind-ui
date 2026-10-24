// image-loading-status in Vue: the Root half (the shared machine, the source counter, the
// image registration) and the image half (registration on mount, load/error events, `src`
// last). Shared by Avatar and Image, which differ only in their connect.
import {
  fallbackVisible,
  type ImageStatusProps,
  imageSettled,
  imageStatusMachine,
} from "@rind-ui/core"
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue"
import { mergeProps } from "./merge-props"
import { useMachine } from "./use-machine"

type Send = ReturnType<typeof useMachine<typeof imageStatusMachine>>["send"]

/** What the image part needs from its Root. */
export interface ImageHost {
  readonly send: Send
  /** Numbers the image's sources: load and error events of a replaced one are dropped. */
  readonly source: { current: number }
  /** The registered image re-reads its element (after the service started). */
  readonly register: { current: (() => void) | null }
  readonly images: { current: number }
}

/**
 * The Root half: the status machine and the host the image part registers with. `onMount`
 * runs once after mount (a development check).
 */
export function useImageStatusRoot(props: () => ImageStatusProps, onMount: () => void) {
  const { view, send } = useMachine(imageStatusMachine, props)
  const host: ImageHost = {
    send,
    source: { current: 0 },
    register: { current: null },
    images: { current: 0 },
  }
  // After the service started (useMachine's mount hook runs first) and after the image's own
  // mount (children mount first, while the service was stopped, so its read was dropped): the
  // image re-reads its element; then the fallback rules for `idle`/`error` apply.
  onMounted(() => {
    host.register.current?.()
    send({ type: "ROOT.MOUNT" })
    onMount()
  })
  return {
    status: computed(() => view.value.state),
    fallback: computed(() => fallbackVisible(view.value.state, view.value.context.fallbackReady)),
    host,
  }
}

/** An empty source is no source: never written (browsers may refetch the page). */
const nonEmpty = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined

/**
 * The image half: the props of the one `<img>` the status is read from. `own` is the part's
 * connect output, given whether the element has a source; `onCount` gets the number of
 * registered images (a development check). Returns a render function of the attrs.
 */
export function useStatusImage(
  host: ImageHost,
  own: (hasSource: boolean) => Readonly<Record<string, unknown>>,
  attrs: Readonly<Record<string, unknown>>,
  onCount: (count: number) => void,
) {
  const { send, source, images, register } = host
  const el = shallowRef<HTMLImageElement | null>(null)
  // Stable: a new ref function on every render would detach and reattach the element.
  const setImg = (node: unknown) => {
    el.value = node instanceof HTMLImageElement ? node : null
  }
  const url = () => nonEmpty(attrs["src"])
  const set = () => nonEmpty(attrs["srcset"])
  const hasSource = () => url() !== undefined || set() !== undefined
  // Reads the element on mount: a load that fired before hydration is not missed.
  const read = (type: "IMAGE.MOUNT" | "IMAGE.SOURCE") => {
    const img = el.value
    if (!img) return
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
  onMounted(() => {
    images.current++
    onCount(images.current)
    register.current = () => read("IMAGE.MOUNT")
    read("IMAGE.MOUNT")
    // Re-reads the element when the source changes, after the DOM has it.
    watch(
      () => `${url() ?? ""}\n${set() ?? ""}\n${String(attrs["sizes"] ?? "")}`,
      () => read("IMAGE.SOURCE"),
      { flush: "post" },
    )
  })
  onBeforeUnmount(() => {
    images.current--
    register.current = null
    send({ type: "IMAGE.UNMOUNT" })
  })
  return () => {
    const { src: _s, srcset: _ss, sizes, loading, ...rest } = attrs
    const merged = mergeProps(
      {
        ...own(hasSource()),
        ref: setImg,
        onLoad: () => send({ type: "IMAGE.LOAD", source: source.current }),
        onError: () => send({ type: "IMAGE.ERROR", source: source.current }),
      },
      rest,
    )
    const u = url()
    const s = set()
    // `src` last: Vue sets attributes in key order, and Safari and Firefox start fetching
    // when `src` lands, ignoring a `srcset`, `sizes` or `loading` set after it.
    return {
      ...merged,
      ...(s === undefined ? {} : { srcset: s }),
      ...(sizes === undefined ? {} : { sizes }),
      ...(loading === undefined ? {} : { loading }),
      ...(u === undefined ? {} : { src: u }),
    }
  }
}
