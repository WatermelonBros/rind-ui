// Splitter parts: wiring only. The machine owns the sizes (percent), connect every attribute.
// Here the Root measures the panels' space for pixel constraints and the pointer scale, and a
// Handle's press is measured once by pointer-drag on the Root, then each move fraction is
// turned into a percent delta from the press.
import {
  afterNextRender,
  booleanAttribute,
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
  untracked,
} from "@angular/core"
import {
  blurEvent,
  describeKey,
  focusEvent,
  focusSafely,
  isDragPress,
  type Modality,
  pointerDragSession,
  resolveConstraints,
  type SplitterCommitDetails,
  type SplitterConstraints,
  type SplitterDragMessage,
  type SplitterEvent,
  type SplitterOrientation,
  type SplitterPanel as SplitterPanelConfig,
  sameConstraints,
  splitterConnect,
  splitterDelta,
  splitterDragAxis,
  splitterKeyEvent,
  splitterMachine,
  splitterSizes,
  warnUnnamedHandle,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale } from "../provider"

export interface SplitterState {
  readonly sizes: readonly number[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly orientation: SplitterOrientation
}

const SPLITTER = new InjectionToken<SplitterRoot>("rind-ui.splitter")

function injectSplitter(part: string): SplitterRoot {
  const root = inject(SPLITTER, { optional: true })
  if (!root) throw new Error(`rindSplitter${part} must be inside rindSplitterRoot`)
  return root
}

const px = (style: CSSStyleDeclaration, name: string) =>
  Number.parseFloat(style.getPropertyValue(name)) || 0

/** The Root's content box on the axis, and that minus its handles (the panels' space). */
function measure(root: HTMLElement, handles: readonly (Element | null)[], vertical: boolean) {
  const style = root.ownerDocument.defaultView?.getComputedStyle(root)
  const box = vertical
    ? root.clientHeight - (style ? px(style, "padding-top") + px(style, "padding-bottom") : 0)
    : root.clientWidth - (style ? px(style, "padding-left") + px(style, "padding-right") : 0)
  let taken = 0
  for (const h of handles) {
    if (!h?.isConnected) continue
    const r = h.getBoundingClientRect()
    taken += vertical ? r.height : r.width
  }
  const space = box - taken
  return space > 0 && box > 0 ? { space, scale: box / space } : null
}

/**
 * Resizable panels on one axis (APG Window Splitter): `<div rindSplitterRoot [panels]="p">`
 * with `<div rindSplitterPanel [index]="i">` panels and a `<div rindSplitterHandle [index]="i">`
 * between each two.
 */
@Directive({
  selector: "[rindSplitterRoot]",
  exportAs: "rindSplitterRoot",
  providers: [{ provide: SPLITTER, useExisting: forwardRef(() => SplitterRoot) }],
})
export class SplitterRoot {
  /** One entry per panel: `min`, `max`, `collapsible`, `collapsedSize`. */
  readonly panels = input.required<readonly SplitterPanelConfig[]>()
  /** Controlled sizes in percent, one per panel, summing to 100 (`[(sizes)]`). */
  readonly sizes = input<readonly number[]>()
  /** Uncontrolled initial sizes (default an equal split). */
  readonly defaultSizes = input<readonly number[]>()
  /** The panel axis. Default: `horizontal` (side by side). */
  readonly orientation = input<SplitterOrientation>("horizontal")
  /** Percent per arrow key. Default: 5. */
  readonly step = input<number>()
  /** No handle moves or is focusable. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Reading direction; mirrors a horizontal Splitter. Default: the provider's. */
  readonly dir = input<"ltr" | "rtl">()
  readonly id = input<string>()
  /** Every change (each pointer move); not when the parent changes `sizes`. */
  readonly sizesChangeDetails = output<ChangeEvent<readonly number[], SplitterEvent>>()
  /** The accepted sizes, for `[(sizes)]`. */
  readonly sizesChange = output<readonly number[]>()
  /** Once at the end of each interaction that changed the sizes: the hook to save a layout. */
  readonly sizesCommit = output<{
    sizes: readonly number[]
    details: SplitterCommitDetails
  }>()

  private readonly emit = changeEmitter<readonly number[], SplitterEvent>(
    this.sizesChangeDetails,
    this.sizesChange,
  )
  /** @internal */
  readonly api: Signal<ReturnType<typeof splitterConnect>>
  /** @internal */
  readonly send: (e: SplitterEvent) => void
  /** @internal */
  readonly handles: (Element | null)[] = []
  /** @internal */
  readonly press: (e: PointerEvent) => boolean
  /** @internal */
  readonly setHandleDisabled: (index: number, disabled: boolean | undefined) => void
  /** @internal */
  readonly direction: Signal<"ltr" | "rtl">
  /** The splitter's state, for the template (`#s="rindSplitterRoot"`, `s.state()`). */
  readonly state: Signal<SplitterState>

  constructor() {
    const env = injectEnvironment()
    const instance = injectRootId(() => this.id())
    const locale = injectLocale(
      () => undefined,
      () => this.dir(),
    )
    this.direction = computed(() => locale().dir)
    const el: Element = inject(ElementRef).nativeElement
    const handles = this.handles
    const layout = signal<{ space: number; scale: number } | null>(null)
    // Same content, same array: the machine's onProps compares content anyway.
    let constraints: SplitterConstraints[] | undefined
    const panels = computed(() => {
      const resolved = resolveConstraints(this.panels(), layout()?.space ?? null)
      if (constraints === undefined || !sameConstraints(constraints, resolved))
        constraints = resolved
      return constraints
    })
    const handleDisabled = signal<readonly boolean[]>([])
    this.setHandleDisabled = (index, off) => {
      const prev = untracked(handleDisabled)
      if ((prev[index] === true) === (off === true)) return
      const next = [...prev]
      next[index] = off === true
      handleDisabled.set(next)
    }
    const drag = pointerDragSession()
    let pressed: number | null = null
    const focusHandle = (index: number, modality: Modality) => {
      const handle = handles[index]
      if (handle instanceof HTMLElement) void focusSafely(handle, env, "programmatic", modality)
    }
    const machineProps = () => ({
      sizes: this.sizes(),
      defaultSizes: this.defaultSizes(),
      panels: panels(),
      step: this.step(),
      disabled: this.disabled(),
      handleDisabled: handleDisabled(),
      onSizesChange: this.emit,
      onSizesCommit: (v: readonly number[], d: SplitterCommitDetails) =>
        this.sizesCommit.emit({ sizes: v, details: d }),
    })
    const { view, send } = injectMachine(splitterMachine, machineProps, {
      drag: {
        track: (forward: (m: SplitterDragMessage) => void) =>
          drag.track((m) => {
            if (m.type !== "move") return forward(m)
            if (pressed === null) return
            forward({
              type: "move",
              delta: splitterDelta(
                pressed,
                m.fraction,
                untracked(this.orientation),
                untracked(layout)?.scale ?? 1,
              ),
            })
          }),
      },
      focusHandle,
    })
    this.send = send
    const current = computed(() => splitterSizes(machineProps(), view().values.sizes))
    const focused = () => view().context.focused
    const modality = injectModality(env.modality, () => focused() !== null)
    const dragging = () => view().matches("dragging")
    this.api = computed(() =>
      splitterConnect({
        instance: instance(),
        orientation: this.orientation(),
        dir: locale().dir,
        sizes: current(),
        panels: panels(),
        disabled: this.disabled(),
        handleDisabled: handleDisabled(),
        focused: focused(),
        modality: modality(),
        draggingHandle: dragging() ? view().context.handle : null,
      }),
    )
    this.state = computed(() => ({
      sizes: current(),
      dragging: dragging(),
      disabled: this.disabled(),
      orientation: this.orientation(),
    }))
    this.press = (e) => {
      if (!(el instanceof HTMLElement) || !isDragPress(e) || drag.active) return false
      pressed = drag.press(
        el,
        e,
        splitterDragAxis({ orientation: untracked(this.orientation), dir: untracked(locale).dir }),
      )
      return true
    }
    bindProps(() => this.api().root(), {
      owns: ["defaultsizes", "dir", "disabled", "id", "orientation", "panels", "sizes", "step"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // The panels' space: pixel constraints and the pointer scale follow every resize (RRP#720).
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      const vertical = this.orientation() === "vertical"
      if (!ready() || !(el instanceof HTMLElement)) return
      untracked(() => {
        const update = () => {
          const next = measure(el, handles, vertical)
          const prev = untracked(layout)
          if (prev?.space !== next?.space || prev?.scale !== next?.scale) layout.set(next)
        }
        update()
        const win = el.ownerDocument.defaultView
        if (!win || typeof win.ResizeObserver !== "function") return
        const observer = new win.ResizeObserver(update)
        observer.observe(el)
        for (const h of handles) if (h) observer.observe(h)
        onCleanup(() => observer.disconnect())
      })
    })
  }
}

/** Panel `index`: its size is `flex-grow` on a zero basis. */
@Directive({ selector: "[rindSplitterPanel]", exportAs: "rindSplitterPanel" })
export class SplitterPanel {
  /** The panel's index in the Root's `panels` (known on the server). */
  readonly index = input.required<number>()
  constructor() {
    const root = injectSplitter("Panel")
    bindProps(() => root.api().panel(this.index()), { owns: ["index"] })
  }
}

/** The focusable `separator` between panel `index` and the next one; name it (`aria-label`). */
@Directive({ selector: "[rindSplitterHandle]", exportAs: "rindSplitterHandle" })
export class SplitterHandle {
  /** The boundary after panel `index` (its primary panel). */
  readonly index = input.required<number>()
  /** Disables this handle only. */
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })

  constructor() {
    const root = injectSplitter("Handle")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    bindProps(
      () => {
        const index = this.index()
        return joinHandlers(root.api().handle(index, { disabled: this.disabled() }), {
          onPointerDown: (e: PointerEvent) => {
            const target = e.currentTarget
            if (!(target instanceof Element) || target.hasAttribute("data-disabled")) return
            if (!root.press(e)) return
            // No text selection and no native focus: the machine focuses without a ring.
            e.preventDefault()
            root.send({
              type: "POINTER.DOWN",
              handle: index,
              modality: e.pointerType === "touch" ? "touch" : "pointer",
            })
          },
          onKeyDown: (e: KeyboardEvent) => {
            const event = splitterKeyEvent(describeKey(e, env), index, {
              orientation: root.orientation(),
              dir: root.direction(),
              dragging: root.state().dragging,
            })
            if (!event || e.defaultPrevented) return
            e.preventDefault()
            // Escape ends the drag only: a surrounding layer stays open.
            if (event.type === "DRAG.CANCEL") e.stopPropagation()
            root.send(event)
          },
          onFocusIn: (e: FocusEvent) => {
            if (e.currentTarget instanceof Element)
              root.send({ ...focusEvent(e.currentTarget, env.modality), handle: index })
          },
          onFocusOut: () => root.send({ ...blurEvent(env.modality), handle: index }),
        })
      },
      { owns: ["disabled", "index"] },
    )
    // Registered by index (focus, measuring).
    let at: number | undefined
    effect(() => {
      const index = this.index()
      untracked(() => {
        if (at !== undefined && at !== index) root.handles[at] = null
        at = index
        root.handles[index] = el
      })
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    let ready = false
    let tracked: number | undefined
    const sync = () => {
      const index = this.index()
      const disabled = this.disabled()
      untracked(() => {
        if (tracked !== undefined && tracked !== index) root.setHandleDisabled(tracked, false)
        // Read on the element: a bound `[attr.aria-label]` names it too.
        const named = el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby")
        if (tracked !== index) warnUnnamedHandle(index, named)
        tracked = index
        root.setHandleDisabled(index, disabled)
      })
    }
    afterNextRender(() => {
      ready = true
      sync()
      // The modality tracker must see the pointerdown that comes before the handle's focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
    })
    effect(() => {
      this.index()
      this.disabled()
      if (ready) untracked(sync)
    })
    destroy.onDestroy(() => {
      if (tracked !== undefined) root.setHandleDisabled(tracked, false)
    })
  }
}

/** The Splitter's parts, for a standalone component's `imports`. */
export const Splitter = [SplitterRoot, SplitterPanel, SplitterHandle] as const
