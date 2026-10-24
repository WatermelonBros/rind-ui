// image-loading-status in Solid: the Root half (the shared machine, the source counter, the
// image registration) and the image half (registration on mount, load/error events, `src`
// last). Shared by Avatar and Image, which differ only in their connect.
import {
  fallbackVisible,
  type ImageStatusProps,
  imageSettled,
  imageStatusMachine,
} from "@rind-ui/core"
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  splitProps,
} from "solid-js"
import { afterMount } from "./lifecycle"
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
  // Solid runs mount callbacks in creation order, the Root's before its parts': this one
  // is created inside the first, so it runs after every part registered (and the service,
  // started by useMachine's own callback, is running); then the fallback rules for
  // `idle`/`error` apply.
  afterMount(() =>
    afterMount(() => {
      host.register.current?.()
      send({ type: "ROOT.MOUNT" })
      onMount()
    }),
  )
  const status = () => view().state
  return {
    status: status as Accessor<ReturnType<typeof view>["state"]>,
    fallback: () => fallbackVisible(view().state, view().context.fallbackReady),
    host,
  }
}

/** An empty source is no source: never written (browsers may refetch the page). */
const nonEmpty = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined

/**
 * The image half: the props of the one `<img>` the status is read from. `own` is the part's
 * connect output, given whether the element has a source; `onCount` gets the number of
 * registered images (a development check). Returns the merged props (an accessor).
 */
export function useStatusImage(
  host: ImageHost,
  own: (hasSource: boolean) => Readonly<Record<string, unknown>>,
  attrs: Readonly<Record<string | symbol, unknown>>,
  onCount: (count: number) => void,
): Accessor<Record<string | symbol, unknown>> {
  const { send, source, images, register } = host
  const [named, rest] = splitProps(
    attrs as { src?: unknown; srcset?: unknown; sizes?: unknown; loading?: unknown },
    ["src", "srcset", "sizes", "loading"],
  )
  const [el, setEl] = createSignal<HTMLImageElement | null>(null)
  const url = () => nonEmpty(named.src)
  const set = () => nonEmpty(named.srcset)
  const hasSource = () => url() !== undefined || set() !== undefined
  // Reads the element on mount: a load that fired before hydration is not missed.
  const read = (type: "IMAGE.MOUNT" | "IMAGE.SOURCE") => {
    const img = el()
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
  afterMount(() => {
    images.current++
    onCount(images.current)
    register.current = () => read("IMAGE.MOUNT")
    read("IMAGE.MOUNT")
    // Re-reads the element when the source changes, after the DOM has it.
    createEffect(
      on(
        () => `${url() ?? ""}\n${set() ?? ""}\n${String(named.sizes ?? "")}`,
        () => read("IMAGE.SOURCE"),
        { defer: true },
      ),
    )
    onCleanup(() => {
      images.current--
      register.current = null
      send({ type: "IMAGE.UNMOUNT" })
    })
  })
  return createMemo(() => {
    const merged = mergeProps(
      {
        ...own(hasSource()),
        ref: (node: unknown) => setEl(node instanceof HTMLImageElement ? node : null),
        onLoad: () => send({ type: "IMAGE.LOAD", source: source.current }),
        onError: () => send({ type: "IMAGE.ERROR", source: source.current }),
      },
      rest,
    )
    const u = url()
    const s = set()
    // `src` last: Safari and Firefox start fetching when `src` lands, ignoring a `srcset`,
    // `sizes` or `loading` set after it; attributes are set in key order.
    return {
      ...merged,
      ...(s === undefined ? {} : { srcset: s }),
      ...(named.sizes === undefined ? {} : { sizes: named.sizes }),
      ...(named.loading === undefined ? {} : { loading: named.loading }),
      ...(u === undefined ? {} : { src: u }),
    }
  })
}
