<script lang="ts">
import {
  type AutoplayReason,
  announcerCapability,
  type CarouselEvent,
  type CarouselLayout,
  type CarouselState,
  type ChangeDetails,
  carouselConnect,
  carouselMachine,
  carouselMessages,
  clampPage,
  createItemRegistry,
  firstSlideOf,
  pageCount,
  partId,
  visibilityCapability,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { carouselContext } from "./context"
import type { CarouselRenderState, CarouselRootProps } from "./types"

let {
  page = $bindable(),
  defaultPage,
  onPageChange,
  slideCount,
  slidesPerPage = 1,
  slidesPerMove = "page",
  loop = false,
  orientation = "horizontal",
  spacing = "0px",
  autoplay,
  autoplayDelay,
  pauseOnHover,
  onAutoplayChange,
  dir: ownDir,
  messages: ownMessages,
  id,
  child,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: CarouselRootProps = $props()

/** A scroll with no `scrollend` (older engines) settles after this quiet time. */
const SETTLE_MS = 120

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability, visibilityCapability)
const messages = useMessages("carousel", carouselMessages, () => ownMessages)
const locale = useLocale(
  () => undefined,
  () => ownDir,
)
const viewport: { current: HTMLElement | null } = { current: null }
const vertical = $derived(orientation === "vertical")
let layout: CarouselLayout = { slides: 0 }
const slideEl = (index: number) =>
  viewport.current?.querySelector(
    `[data-scope="carousel"][data-part="slide"][data-instance="${instance}"][data-index="${index}"]`,
  ) ?? null
/** The scroll position that puts `slide` at the Viewport's snap start. */
function startOf(el: HTMLElement, slide: Element) {
  const v = el.getBoundingClientRect()
  const s = slide.getBoundingClientRect()
  if (vertical) return s.top - v.top + el.scrollTop
  return (locale.current.dir === "rtl" ? s.right - v.right : s.left - v.left) + el.scrollLeft
}
/** The page our own scrollToPage is heading to: its scroll events are not the user's. */
let pending: number | null = null
const machine = useMachine(
  carouselMachine,
  () => ({
    id: instance,
    page,
    defaultPage,
    onPageChange: (p: number, d: ChangeDetails<CarouselEvent>) => {
      onPageChange?.(p, d)
      if (page !== undefined) page = p
    },
    slideCount,
    slidesPerPage,
    slidesPerMove,
    loop,
    autoplay,
    autoplayDelay,
    pauseOnHover,
    onAutoplayChange: (playing: boolean, d: { readonly reason: AutoplayReason }) =>
      onAutoplayChange?.(playing, d),
    messages: messages(),
    lang: locale.current.locale,
  }),
  {
    ...env,
    scrollToPage: (p: number, smooth: boolean) => {
      const el = viewport.current
      const slide = slideEl(firstSlideOf(layout, p))
      if (!el || !slide) return
      const at = startOf(el, slide)
      if (Math.abs(at - (vertical ? el.scrollTop : el.scrollLeft)) < 1) return
      pending = p
      el.scrollTo({ [vertical ? "top" : "left"]: at, behavior: smooth ? "smooth" : "auto" })
    },
  },
)
const registry = createItemRegistry((items) =>
  machine.send({ type: "COUNT", slides: items.length }),
)
// After the slides' own effects: the count arrives without waiting for the microtask.
$effect(() => registry.flush())
const slides = $derived(machine.view.context.slides)
const pages = $derived.by(() => {
  layout = { slides, perPage: slidesPerPage, perMove: slidesPerMove }
  return pageCount(layout)
})
const current = $derived(clampPage(machine.view.values.page ?? 0, pages))
const api = $derived(
  carouselConnect(
    {
      instance,
      state: machine.view.state as CarouselState,
      page: current,
      pages,
      slides,
      slidesPerPage,
      slidesPerMove,
      loop,
      orientation,
      spacing,
      delay: autoplayDelay ?? 5000,
      scrolling: machine.view.context.scrolling,
      messages: messages(),
      ariaLabel: ariaLabel ?? undefined,
      ariaLabelledBy: ariaLabelledBy ?? undefined,
      ids: {
        viewport: partId("carousel", instance, "viewport"),
        slide: (i) => partId("carousel", instance, `slide-${i}`),
      },
    },
    env,
  ),
)
// A scroll the user made: START once, then END at the nearest page when it settles.
let timer: unknown = null
let started = false
const onSettled = () => {
  if (timer !== null) env.scheduler.clearTimeout(timer as never)
  timer = null
  const el = viewport.current
  if (!el) return
  const pos = vertical ? el.scrollTop : el.scrollLeft
  let nearest = 0
  let best = Number.POSITIVE_INFINITY
  for (let p = 0; p < pageCount(layout); p++) {
    const slide = slideEl(firstSlideOf(layout, p))
    if (!slide) continue
    const d = Math.abs(startOf(el, slide) - pos)
    if (d < best) {
      best = d
      nearest = p
    }
  }
  const ours = pending
  pending = null
  // Our own scroll arrived where it was sent: nothing to report.
  if (ours === nearest && !started) return
  started = false
  machine.send({ type: "SCROLL.END", page: nearest })
}
const onScroll = () => {
  if (pending === null && !started) {
    started = true
    machine.send({ type: "SCROLL.START" })
  }
  if (timer !== null) env.scheduler.clearTimeout(timer as never)
  timer = env.scheduler.setTimeout(onSettled, SETTLE_MS)
}
$effect(() =>
  untrack(() => {
    const el = viewport.current
    el?.addEventListener("scrollend", onSettled)
    return () => {
      el?.removeEventListener("scrollend", onSettled)
      if (timer !== null) env.scheduler.clearTimeout(timer as never)
    }
  }),
)
const carouselState: CarouselRenderState = $derived({
  page: current,
  pages,
  autoplay: machine.view.state === "stopped" ? "off" : (machine.view.state as "playing" | "paused"),
})
carouselContext.set({
  api: () => api,
  send: machine.send,
  state: () => carouselState,
  registry,
  viewport,
  orientation: () => orientation,
  dir: () => locale.current.dir,
  onScroll,
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(api.root()), {
          onpointerenter: (e: PointerEvent) => {
            if (e.pointerType === "mouse") machine.send({ type: "HOLD", hold: "hover" })
          },
          onpointerleave: (e: PointerEvent) => {
            if (e.pointerType === "mouse") machine.send({ type: "RELEASE", hold: "hover" })
          },
          // Focus arriving from outside: a reader tabbed in, autoplay stops for good. Not on the
          // AutoplayTrigger: its press toggles, and a stop first would make that press restart it.
          onfocusin: (e: FocusEvent) => {
            const root = e.currentTarget as Element
            const from = e.relatedTarget
            if (from instanceof Node && root.contains(from)) return
            if (e.target instanceof Element && e.target.closest('[data-part="autoplay-trigger"]'))
              return
            machine.send({ type: "STOP", reason: "focus" })
          },
        }),
        ...(id === undefined ? {} : { id }),
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: carouselState })}
{:else}
  <section {...attrs(merged)}>{@render children?.(carouselState)}</section>
{/if}
