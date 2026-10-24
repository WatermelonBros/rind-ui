// image-loading-status in Svelte: the Root half (the shared machine, the source counter, the
// image registration) and the image half (registration on mount, load/error events, `src`
// last). Shared by Avatar and Image, which differ only in their connect.
import {
  fallbackVisible,
  type ImageStatusProps,
  imageSettled,
  imageStatusMachine,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { elementRef } from "./element-ref.svelte"
import { mergeProps } from "./merge-props"
import { useMachine } from "./use-machine.svelte"

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
 * runs once after mount (a development check). Read `.status` and `.fallback`.
 */
export function useImageStatusRoot(props: () => ImageStatusProps, onMount: () => void) {
  const machine = useMachine(imageStatusMachine, props)
  const host: ImageHost = {
    send: machine.send,
    source: { current: 0 },
    register: { current: null },
    images: { current: 0 },
  }
  // After the service started (useMachine's effect runs first) and after the image's own
  // effect (children's effects run first, while the service was stopped, so its read was
  // dropped): the image re-reads its element; then the fallback rules apply.
  $effect(() =>
    untrack(() => {
      host.register.current?.()
      machine.send({ type: "ROOT.MOUNT" })
      onMount()
    }),
  )
  return {
    get status() {
      return machine.view.state
    },
    get fallback() {
      return fallbackVisible(machine.view.state, machine.view.context.fallbackReady)
    },
    host,
  }
}

/** An empty source is no source: never written (browsers may refetch the page). */
const nonEmpty = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined

/**
 * The image half: the props of the one `<img>` the status is read from. `own` is the part's
 * connect output, given whether the element has a source; `onCount` gets the number of
 * registered images. Read `.props` (the attrs getter's latest, `src` last).
 */
export function useStatusImage(
  host: ImageHost,
  own: (hasSource: boolean) => Readonly<Record<string, unknown>>,
  attrs: () => Readonly<Record<string, unknown>>,
  onCount: (count: number) => void,
) {
  const { send, source, images, register } = host
  const el = elementRef("img")
  const url = $derived(nonEmpty(attrs()["src"]))
  const set = $derived(nonEmpty(attrs()["srcset"]))
  const hasSource = $derived(url !== undefined || set !== undefined)
  // Reads the element on mount: a load that fired before hydration is not missed.
  const read = (type: "IMAGE.MOUNT" | "IMAGE.SOURCE") => {
    const img = el.current
    if (!(img instanceof HTMLImageElement)) return
    const current = ++source.current
    const settled = hasSource ? imageSettled(img) : "loading"
    if (typeof settled === "string") {
      send({ type, hasSource, source: current, settled })
      return
    }
    send({ type, hasSource, source: current, settled: "loading" })
    settled.then((status) => send({ type: "IMAGE.SETTLED", status, source: current }))
  }
  $effect(() => {
    if (!el.current) return
    untrack(() => {
      images.current++
      onCount(images.current)
      register.current = () => read("IMAGE.MOUNT")
      read("IMAGE.MOUNT")
    })
    return () => {
      images.current--
      register.current = null
      send({ type: "IMAGE.UNMOUNT" })
    }
  })
  // Re-reads the element when the source changes, not on the first run.
  let first = true
  $effect(() => {
    void `${url ?? ""}\n${set ?? ""}\n${String(attrs()["sizes"] ?? "")}`
    if (first) {
      first = false
      return
    }
    untrack(() => read("IMAGE.SOURCE"))
  })
  return {
    get props() {
      const { src: _s, srcset: _ss, sizes, loading, ...rest } = attrs()
      const merged = mergeProps(
        {
          ...own(hasSource),
          ...el.props,
          onload: () => send({ type: "IMAGE.LOAD", source: source.current }),
          onerror: () => send({ type: "IMAGE.ERROR", source: source.current }),
        },
        rest,
      )
      // `src` last: attributes are set in key order, and Safari and Firefox start fetching
      // when `src` lands, ignoring a `srcset`, `sizes` or `loading` set after it.
      return {
        ...merged,
        ...(set === undefined ? {} : { srcset: set }),
        ...(sizes === undefined ? {} : { sizes }),
        ...(loading === undefined ? {} : { loading }),
        ...(url === undefined ? {} : { src: url }),
      }
    },
  }
}
