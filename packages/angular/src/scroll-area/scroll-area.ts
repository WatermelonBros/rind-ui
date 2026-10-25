import {
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import {
  domScrollMetrics,
  type ScrollAreaState as ScrollAreaActivity,
  type ScrollAreaConnectInput,
  type ScrollAreaType,
  scrollAreaConnect,
  scrollAreaMachine,
  warnUnnamedTabStop,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, withCapabilities } from "../provider"

export interface ScrollAreaState {
  readonly state: ScrollAreaActivity
}

type Orientation = "vertical" | "horizontal"

const SCROLL_AREA = new InjectionToken<ScrollAreaRoot>("rind-ui.scroll-area")
const SCROLLBAR = new InjectionToken<ScrollAreaScrollbar>("rind-ui.scroll-area-scrollbar")

function injectScrollArea(part: string): ScrollAreaRoot {
  const root = inject(SCROLL_AREA, { optional: true })
  if (!root) throw new Error(`rindScrollArea${part} must be inside rindScrollAreaRoot`)
  return root
}

/**
 * A native scroll container with custom-drawn scrollbars (native scrolling kept):
 * `<div rindScrollAreaRoot>` with a Viewport holding the Content, and a Scrollbar holding its
 * Thumb.
 */
@Directive({
  selector: "[rindScrollAreaRoot]",
  exportAs: "rindScrollAreaRoot",
  providers: [{ provide: SCROLL_AREA, useExisting: forwardRef(() => ScrollAreaRoot) }],
})
export class ScrollAreaRoot {
  /** Default `hover`. */
  readonly type = input<ScrollAreaType>("hover")
  /** Default 600 ms. */
  readonly hideDelay = input<number>()
  /** Default `page`. */
  readonly trackPress = input<"page" | "jump">()
  readonly id = input<string>()

  /** @internal */
  readonly connect: Signal<ReturnType<typeof scrollAreaConnect>>
  /** @internal */
  readonly input: Signal<ScrollAreaConnectInput>
  /** @internal */
  readonly send: Parameters<ReturnType<typeof scrollAreaConnect>["root"]>[0]
  /** @internal The rendered Scrollbars' orientations (the Corner needs both). */
  readonly bars = signal<ReadonlySet<Orientation>>(new Set())
  readonly state: Signal<ScrollAreaState>
  private handle: { measure(): void } | null = null

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment()
    const { view, send } = injectMachine(
      scrollAreaMachine,
      () => ({
        root: instance(),
        type: this.type(),
        hideDelay: this.hideDelay(),
        trackPress: this.trackPress(),
        onTrack: (h: { measure(): void } | null) => {
          this.handle = h
        },
      }),
      withCapabilities(env, { scrollMetrics: domScrollMetrics(env) }),
    )
    this.send = send
    const modality = injectModality(env.modality, () => view().context.viewportFocused)
    this.input = computed(() => ({
      instance: instance(),
      state: view().state as ScrollAreaActivity,
      context: view().context,
      type: this.type(),
      modality: modality(),
    }))
    this.connect = computed(() => scrollAreaConnect(this.input()))
    this.state = computed(() => ({ state: this.input().state }))
    // The Root's id is the instance's: a consumer id names the instance, the part id stays ours.
    bindProps(() => this.connect().root(send), {
      owns: ["hidedelay", "id", "trackpress", "type"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // The window's tracker installed while rendered (it records the pointer before a focus).
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }

  /** Re-measures after a change the observers cannot see (a deep descendant resized). */
  measure(): void {
    this.handle?.measure()
  }

  /** @internal */
  register(o: Orientation): () => void {
    this.bars.set(new Set([...untracked(this.bars), o]))
    return () => {
      const next = new Set(untracked(this.bars))
      next.delete(o)
      this.bars.set(next)
    }
  }
}

/** The native scroll container; a keyboard tab stop when it scrolls (name it, `aria-label`). */
@Directive({ selector: "[rindScrollAreaViewport]", exportAs: "rindScrollAreaViewport" })
export class ScrollAreaViewport {
  constructor() {
    const root = injectScrollArea("Viewport")
    let named = false
    const { statics } = bindProps(() => root.connect().viewport(root.send, named))
    named = statics.has("aria-label") || statics.has("aria-labelledby")
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect(() => {
      if (!ready()) return
      const tabStop = root.input().context.tabStop && !statics.has("tabindex")
      untracked(() => warnUnnamedTabStop(tabStop, named))
    })
  }
}

/** Your content, measured; the only element between the Viewport and your children. */
@Directive({ selector: "[rindScrollAreaContent]", exportAs: "rindScrollAreaContent" })
export class ScrollAreaContent {
  constructor() {
    const root = injectScrollArea("Content")
    bindProps(() => root.connect().content())
  }
}

@Directive({
  selector: "[rindScrollAreaScrollbar]",
  exportAs: "rindScrollAreaScrollbar",
  providers: [{ provide: SCROLLBAR, useExisting: forwardRef(() => ScrollAreaScrollbar) }],
})
export class ScrollAreaScrollbar {
  /** Default `vertical`. */
  readonly orientation = input<Orientation>("vertical")
  constructor() {
    const root = injectScrollArea("Scrollbar")
    bindProps(() => root.connect().scrollbar(root.send, this.orientation()), {
      owns: ["orientation"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready()) return
      const o = this.orientation()
      onCleanup(untracked(() => root.register(o)))
    })
  }
}

@Directive({ selector: "[rindScrollAreaThumb]", exportAs: "rindScrollAreaThumb" })
export class ScrollAreaThumb {
  constructor() {
    const root = injectScrollArea("Thumb")
    const bar = inject(SCROLLBAR, { optional: true })
    bindProps(() => root.connect().thumb(bar?.orientation() ?? "vertical"))
  }
}

/** Shown only when both Scrollbars are (React renders nothing otherwise). */
@Directive({ selector: "[rindScrollAreaCorner]", exportAs: "rindScrollAreaCorner" })
export class ScrollAreaCorner {
  constructor() {
    const root = injectScrollArea("Corner")
    const instance = () => root.input().instance
    bindProps(() => {
      const bars = root.bars()
      return bars.has("vertical") && bars.has("horizontal")
        ? root.connect().corner()
        : absentProps("scroll-area", instance())
    })
  }
}

/** The Scroll Area's parts, for a standalone component's `imports`. */
export const ScrollArea = [
  ScrollAreaRoot,
  ScrollAreaViewport,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaCorner,
] as const
