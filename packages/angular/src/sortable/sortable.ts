import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  Injector,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewContainerRef,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type MessageOverrides,
  partId,
  type SortableMessages,
  type SortableOrientation,
  type SortableReorderDetails,
  sortableConnect,
  sortableDrag,
  sortableMachine,
  sortableMessages,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"

/** The list's state, for the template (`#s="rindSortableRoot"`, `s.state()`). */
export interface SortableRenderState {
  readonly orientation: SortableOrientation
  /** The picked-up or dragged key, or null. */
  readonly active: string | null
  readonly dragging: boolean
}

type Api = ReturnType<typeof sortableConnect>
type Drag = {
  readonly delta: { x: number; y: number }
  readonly indicator: number
  readonly target: number
  readonly room: number
} | null

const SORTABLE = new InjectionToken<SortableRoot>("rind-ui.sortable")
const ITEM = new InjectionToken<SortableItem>("rind-ui.sortable-item")

function injectSortable(part: string): SortableRoot {
  const root = inject(SORTABLE, { optional: true })
  if (!root) throw new Error(`rindSortable${part} must be inside rindSortableRoot`)
  return root
}
function injectItemKey(part: string): () => string {
  const item = inject(ITEM, { optional: true })
  if (!item) throw new Error(`rindSortable${part} must be inside rindSortableItem`)
  return item.value
}

/**
 * A list the user reorders: `<ul rindSortableRoot aria-label="Fruits" [items]="keys"
 * (reorder)="keys = $event.keys">` of `<li rindSortableItem [value]="k">` items, each with a
 * Handle (Space picks up, arrows move) and optional move buttons. It renders its keyboard
 * instructions after itself.
 */
@Directive({
  selector: "[rindSortableRoot]",
  exportAs: "rindSortableRoot",
  providers: [{ provide: SORTABLE, useExisting: forwardRef(() => SortableRoot) }],
})
export class SortableRoot {
  /** The keys in their current order (controlled: reorder your data on `reorder`). */
  readonly items = input.required<readonly string[]>()
  readonly orientation = input<SortableOrientation>("vertical")
  /** Pointer drags start from the Handle (default), or anywhere on the item. */
  readonly handle = input(true, { transform: booleanAttribute })
  readonly messages = input<MessageOverrides<SortableMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  readonly id = input<string>()
  /** The new order: apply it to `items`. */
  readonly reorder = output<{ keys: readonly string[]; details: SortableReorderDetails }>()

  /** @internal */
  readonly api: Signal<Api>
  /** @internal */
  readonly send: ReturnType<typeof injectMachine<typeof sortableMachine>>["send"]
  /** @internal */
  readonly startDrag: (key: string, e: PointerEvent) => void
  readonly state: Signal<SortableRenderState>
  private readonly labels = signal<ReadonlyMap<string, string>>(new Map())
  private readonly disabledKeys = signal<ReadonlySet<string>>(new Set())

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const instance = injectRootId(() => this.id())
    const locale = injectLocale(() => this.locale())
    const messages = injectMessages("sortable", sortableMessages, () => this.messages())
    const rootEl: Element = inject(ElementRef).nativeElement
    const drag = signal<Drag>(null)
    const { view, send } = injectMachine(
      sortableMachine,
      () => ({
        id: instance(),
        items: this.items(),
        onReorder: (keys: readonly string[], details: SortableReorderDetails) =>
          this.reorder.emit({ keys, details }),
        disabledKeys: this.disabledKeys(),
        labels: this.labels(),
        messages: messages(),
        lang: locale().locale,
      }),
      env,
    )
    this.send = send
    this.startDrag = (key, e) => {
      if (!(rootEl instanceof HTMLElement) || (e.pointerType === "mouse" && e.button !== 0)) return
      const id = untracked(instance)
      const items = untracked(this.items)
      const els = items
        .map((k) =>
          rootEl.querySelector<HTMLElement>(
            `[data-scope="sortable"][data-part="item"][data-instance="${CSS.escape(id)}"][data-value="${CSS.escape(k)}"]`,
          ),
        )
        .filter((el): el is HTMLElement => el !== null)
      const index = items.indexOf(key)
      if (index < 0) return
      // the room the picked item leaves: its size along the axis plus the list's gap (layout
      // pixels: the same the others' transforms are written in)
      const horizontal = untracked(this.orientation) === "horizontal"
      const picked = els[index]
      const cs = getComputedStyle(rootEl)
      const gap = Number.parseFloat(horizontal ? cs.columnGap : cs.rowGap) || 0
      const room = picked ? (horizontal ? picked.offsetWidth : picked.offsetHeight) + gap : 0
      sortableDrag(e, {
        items: els,
        index,
        axis: horizontal ? "x" : "y",
        root: rootEl,
        onStart: () => send({ type: "DRAG.START", key }),
        onMove: (delta, target, indicator) => {
          drag.set({ delta, indicator, target, room })
          send({ type: "DRAG.OVER", index: target })
        },
        onEnd: (drop) => {
          drag.set(null)
          send(drop ? { type: "DRAG.END" } : { type: "CANCEL" })
        },
      })
    }
    this.api = computed(() =>
      sortableConnect({
        instance: instance(),
        state: view().state as "idle" | "moving" | "dragging",
        items: this.items(),
        orientation: this.orientation(),
        active: view().context.active,
        disabled: (k) => this.disabledKeys().has(k),
        label: (k) => this.labels().get(k) ?? k,
        drag: view().state === "dragging" ? drag() : null,
        ids: { instructions: partId("sortable", instance(), "instructions") },
        messages: messages(),
      }),
    )
    this.state = computed(() => ({
      orientation: this.orientation(),
      active: view().context.active,
      dragging: view().state === "dragging",
    }))
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      { owns: ["handle", "id", "items", "locale", "messages", "orientation"] },
    )
    // The instructions, the list's next sibling as React renders them (they inject this Root:
    // created once it exists, in the first render, the server's too).
    const container = inject(ViewContainerRef)
    const injector = inject(Injector)
    let created = false
    effect(() => {
      if (created) return
      created = true
      untracked(() => container.createComponent(SortableInstructions, { injector }))
    })
  }

  /** @internal */
  register(key: string, label: string | undefined, disabled: boolean): void {
    const labels = untracked(this.labels)
    if (label !== undefined && labels.get(key) !== label)
      this.labels.set(new Map(labels).set(key, label))
    const keys = untracked(this.disabledKeys)
    if (keys.has(key) !== disabled) {
      const next = new Set(keys)
      if (disabled) next.add(key)
      else next.delete(key)
      this.disabledKeys.set(next)
    }
  }
  /** @internal */
  isMovable(key: string): boolean {
    return !untracked(this.disabledKeys).has(key)
  }
}

/** The keyboard instructions a Sortable renders after its list. */
@Component({
  selector: "span[rindSortableInstructions]",
  encapsulation: ViewEncapsulation.None,
  template: "{{ text() }}",
})
export class SortableInstructions {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectSortable("Root")
    this.text = computed(() => root.api().instructionsText)
    bindProps(() => root.api().instructions())
  }
}

/** An item: `<li rindSortableItem [value]="key">`. */
@Directive({
  selector: "[rindSortableItem]",
  exportAs: "rindSortableItem",
  providers: [{ provide: ITEM, useExisting: forwardRef(() => SortableItem) }],
})
export class SortableItem {
  /** The item's key (one of the Root's `items`). */
  readonly value = input.required<string>()
  /** The spoken label (default: the item's text). */
  readonly label = input<string>()
  /** Cannot be moved; other items can pass it. */
  readonly disabled = input(false, { transform: booleanAttribute })

  constructor() {
    const root = injectSortable("Item")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(
      () => {
        const own = root.api().item(this.value())
        return root.handle()
          ? own
          : joinHandlers(own, {
              onPointerDown: (e: PointerEvent) => {
                if (!untracked(this.disabled)) root.startDrag(untracked(this.value), e)
              },
            })
      },
      { owns: ["disabled", "label", "value"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The label: the input, else the item's text (read after each render, as it can change).
    afterEveryRender(() =>
      root.register(
        untracked(this.value),
        untracked(this.label) ?? el.textContent?.replace(/\s+/g, " ").trim(),
        untracked(this.disabled),
      ),
    )
  }
}

const NEXT = { vertical: "ArrowDown", horizontal: "ArrowRight" } as const
const PREV = { vertical: "ArrowUp", horizontal: "ArrowLeft" } as const

/** Picks up and moves its item: `<button rindSortableHandle>` (named "Reorder <label>"). */
@Directive({ selector: "[rindSortableHandle]", exportAs: "rindSortableHandle" })
export class SortableHandle {
  constructor() {
    const root = injectSortable("Handle")
    const key = injectItemKey("Handle")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const picked = computed(() => root.state().active === key() && !root.state().dragging)
    bindProps(() => {
      const k = key()
      const isPicked = picked()
      const orientation = root.orientation()
      return joinHandlers(root.api().handle(k, { focused: focused(), modality: modality() }), {
        onFocus: () => focused.set(true),
        onBlur: (e: FocusEvent) => {
          focused.set(false)
          // Moving focus elsewhere drops where it is (the order has already changed live). A
          // blur with no next target is the item moving in the DOM: its handle is refocused.
          if (isPicked && e.relatedTarget !== null) root.send({ type: "DROP" })
        },
        onKeyDown: (e: KeyboardEvent) => {
          const next = e.key === NEXT[orientation]
          const prev = e.key === PREV[orientation]
          if (!isPicked) {
            if ((next || prev) && e.altKey) {
              e.preventDefault()
              root.send({ type: "QUICK", key: k, by: next ? 1 : -1 })
            } else if (e.key === " " || e.key === "Enter") {
              e.preventDefault()
              root.send({ type: "PICK", key: k })
            }
            return
          }
          if (next || prev) {
            e.preventDefault()
            root.send({ type: "MOVE", by: next ? 1 : -1 })
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault()
            root.send({ type: "MOVE.TO", edge: e.key === "Home" ? "first" : "last" })
          } else if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            root.send({ type: "DROP" })
          } else if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            root.send({ type: "CANCEL" })
          } else if (e.key === "Tab") {
            root.send({ type: "DROP" })
          }
        },
        onPointerDown: (e: PointerEvent) => {
          if (isPicked) {
            root.send({ type: "DROP" })
            return
          }
          if (root.isMovable(k)) root.startDrag(k, e)
        },
        // A pointer press never picks up (Space / Enter do): the click is the drag's.
        onClick: (e: MouseEvent) => e.preventDefault(),
      })
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    // The item moves in the DOM as the order changes: keep focus on its handle.
    afterEveryRender(() => {
      if (untracked(picked) && el instanceof HTMLElement && el.ownerDocument.activeElement !== el)
        el.focus({ preventScroll: false })
    })
    // A press elsewhere drops the keyboard session; the listener lives only while picked up.
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready() || !picked()) return
      const doc = el.ownerDocument
      const onDown = (e: PointerEvent) => {
        if (!el.contains(e.target as Node)) root.send({ type: "DROP" })
      }
      doc.addEventListener("pointerdown", onDown, true)
      onCleanup(() => doc.removeEventListener("pointerdown", onDown, true))
    })
  }
}

/** Where a dragged item lands (`<li rindSortableIndicator>`). */
@Directive({ selector: "[rindSortableIndicator]", exportAs: "rindSortableIndicator" })
export class SortableIndicator {
  constructor() {
    const root = injectSortable("Indicator")
    bindProps(() => root.api().indicator())
  }
}

/** Moves its item one place: `<button rindSortableMoveButton direction="up">` (WCAG 2.5.7). */
@Directive({ selector: "[rindSortableMoveButton]", exportAs: "rindSortableMoveButton" })
export class SortableMoveButton {
  /** Which way it moves its item. */
  readonly direction = input.required<"up" | "down">()
  constructor() {
    const root = injectSortable("MoveButton")
    const key = injectItemKey("MoveButton")
    bindProps(
      () => {
        const own = root.api().moveButton(key(), this.direction())
        return joinHandlers(own, {
          onClick: () => {
            if (own["aria-disabled"] !== "true")
              root.send({
                type: "QUICK",
                key: untracked(key),
                by: untracked(this.direction) === "up" ? -1 : 1,
              })
          },
        })
      },
      { owns: ["direction"] },
    )
  }
}

/** The Sortable's parts, for a standalone component's `imports`. */
export const Sortable = [
  SortableRoot,
  SortableItem,
  SortableHandle,
  SortableIndicator,
  SortableMoveButton,
] as const
