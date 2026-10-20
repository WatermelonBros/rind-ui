"use client"

// image-loading-status in React: the Root half (the shared machine, the source counter, the
// image registration) and the image half (registration at commit, load/error events, `src`
// last). Shared by Avatar and Image, which differ only in their connect.
import {
  fallbackVisible,
  type ImageStatusProps,
  imageSettled,
  imageStatusMachine,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react"
import { composeRefs, mergeProps } from "./merge-props"
import { useMachine } from "./use-machine"

// useLayoutEffect warns on the server; it never runs there anyway.
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

type Send = ReturnType<typeof useMachine<typeof imageStatusMachine>>["send"]

/** What the image part needs from its Root. */
export interface ImageHost {
  readonly send: Send
  /** Numbers the image's sources: load and error events of a replaced one are dropped. */
  readonly source: RefObject<number>
  /** The registered image re-reads its element (after the service started). */
  readonly register: RefObject<(() => void) | null>
  readonly images: RefObject<number>
}

/**
 * The Root half: the status machine and the host the image part registers with. `onMount`
 * runs once after mount (a development check reading the props it mounted with).
 */
export function useImageStatusRoot(props: ImageStatusProps, onMount: () => void) {
  const { view, send } = useMachine(imageStatusMachine, props)
  const source = useRef(0)
  const register = useRef<(() => void) | null>(null)
  const images = useRef(0)
  const mounted = useRef(onMount)
  mounted.current = onMount
  // After the service started (useMachine's effect runs first): the image re-reads its
  // element, since a registration sent while the service was stopped (Strict Mode's remount)
  // is dropped; then the fallback rules for `idle`/`error` apply.
  useEffect(() => {
    register.current?.()
    send({ type: "ROOT.MOUNT" })
    mounted.current()
  }, [send])
  return {
    status: view.state,
    fallback: fallbackVisible(view.state, view.context.fallbackReady),
    host: { send, source, register, images } satisfies ImageHost,
  }
}

/** An empty source is no source: never written (browsers may refetch the page). */
const nonEmpty = <T>(v: T | "" | undefined): T | undefined => (v === "" ? undefined : v)

/**
 * The image half: the props of the one `<img>` the status is read from. `own` is the part's
 * connect output; `onCount` gets the number of registered images (a development check).
 */
export function useStatusImage(
  host: ImageHost,
  /** The part's own props, given whether the element has a source (`hidden` depends on it). */
  own: (hasSource: boolean) => Readonly<Record<string, unknown>>,
  { src, srcSet, sizes, loading, onLoad, onError, ref, ...rest }: ComponentPropsWithRef<"img">,
  onCount: (count: number) => void,
): Record<string, unknown> {
  const { send, source, images, register } = host
  const el = useRef<HTMLImageElement | null>(null)
  const url = nonEmpty(src)
  const set = nonEmpty(srcSet)
  const hasSource = url !== undefined || set !== undefined
  // Reads the element at commit: a load that fired before hydration is not missed.
  const read = (type: "IMAGE.MOUNT" | "IMAGE.SOURCE") => {
    const img = el.current
    if (!img) return
    const current = ++source.current
    const settled = hasSource ? imageSettled(img) : "loading"
    if (typeof settled === "string") {
      send({ type, hasSource, source: current, settled })
      return
    }
    send({ type, hasSource, source: current, settled: "loading" })
    settled.then((status) => send({ type: "IMAGE.SETTLED", status, source: current }))
  }
  const latest = useRef(read)
  latest.current = read
  const count = useRef(onCount)
  count.current = onCount
  useIsoLayoutEffect(() => {
    images.current++
    count.current(images.current)
    register.current = () => latest.current("IMAGE.MOUNT")
    latest.current("IMAGE.MOUNT")
    return () => {
      images.current--
      register.current = null
      send({ type: "IMAGE.UNMOUNT" })
    }
  }, [send, images, register])
  const key = `${url ?? ""}\n${set ?? ""}\n${sizes ?? ""}`
  const first = useRef(true)
  // Re-reads the element when the source changes (`key`), not on the first commit.
  useIsoLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    latest.current("IMAGE.SOURCE")
  }, [key])
  const merged = mergeProps(
    {
      ...own(hasSource),
      ref: composeRefs(el, ref),
      onLoad: () => send({ type: "IMAGE.LOAD", source: source.current }),
      onError: () => send({ type: "IMAGE.ERROR", source: source.current }),
    },
    { ...rest, ...(onLoad ? { onLoad } : {}), ...(onError ? { onError } : {}) },
  )
  // `src` last: React sets attributes in prop order, and Safari and Firefox start fetching
  // when `src` lands, ignoring a `srcSet`, `sizes` or `loading` set after it.
  return {
    ...merged,
    ...(set === undefined ? {} : { srcSet: set }),
    ...(sizes === undefined ? {} : { sizes }),
    ...(loading === undefined ? {} : { loading }),
    ...(url === undefined ? {} : { src: url }),
  }
}
