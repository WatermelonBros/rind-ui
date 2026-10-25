import {
  afterEveryRender,
  afterNextRender,
  Component,
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
  ViewEncapsulation,
} from "@angular/core"
import {
  type ChangeDetails,
  cssZoom,
  type MessageOverrides,
  partId,
  readingPosition,
  type TableOfContentsChangeReason,
  type TableOfContentsEvent,
  type TableOfContentsMessages,
  type TableOfContentsItem as TocItem,
  tableOfContentsConnect,
  tableOfContentsMachine,
  tableOfContentsMessages,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectMessages } from "../provider"

/** The contents' state, for the template (`#t="rindTableOfContentsRoot"`, `t.state()`). */
export interface TableOfContentsRenderState {
  /** The current section's id ("" for none). */
  readonly value: string
}

/** What `valueChangeDetails` emits with the value. */
export interface TableOfContentsChangeDetails {
  readonly reason: TableOfContentsChangeReason
  readonly event: ChangeDetails<TableOfContentsEvent>["event"]
}

type Marker = { readonly top: number; readonly height: number } | null

const TOC = new InjectionToken<TableOfContentsRoot>("rind-ui.table-of-contents")
const ITEM = new InjectionToken<TableOfContentsItem>("rind-ui.table-of-contents-item")

function injectToc(part: string): TableOfContentsRoot {
  const root = inject(TOC, { optional: true })
  if (!root) throw new Error(`rindTableOfContents${part} must be inside rindTableOfContentsRoot`)
  return root
}

/**
 * The page's sections: `<nav rindTableOfContentsRoot [items]="sections">` with an
 * `<ol rindTableOfContentsList>` of `<li rindTableOfContentsItem [item]="s">` entries, each
 * with its `<a rindTableOfContentsLink>`; the current one follows the reading position.
 */
@Directive({
  selector: "[rindTableOfContentsRoot]",
  exportAs: "rindTableOfContentsRoot",
  providers: [{ provide: TOC, useExisting: forwardRef(() => TableOfContentsRoot) }],
})
export class TableOfContentsRoot {
  /** The sections, in document order (`collectHeadings(root)` reads them from headings). */
  readonly items = input.required<readonly TocItem[]>()
  /** Controlled current section id (`[(value)]`). */
  readonly value = input<string>()
  readonly defaultValue = input<string>()
  /** The scrolling container (default: the window). */
  readonly scrollRoot = input<HTMLElement | null>(null)
  /** Pixels hidden at the top by a sticky header (default 0). */
  readonly offset = input<number>()
  /** The reading line, as a fraction of the scroll root below the offset (default 1/3). */
  readonly ratio = input<number>()
  readonly messages = input<MessageOverrides<TableOfContentsMessages>>()
  readonly id = input<string>()
  /** `details.reason`: "scroll" (the reading position) or "navigate" (a followed link). */
  readonly valueChangeDetails = output<{
    value: string
    details: TableOfContentsChangeDetails
  }>()
  /** The current section, for `[(value)]`. */
  readonly valueChange = output<string>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof tableOfContentsConnect>>
  /** @internal */
  readonly navigate: (id: string) => void
  /** @internal */
  readonly titled = signal(false)
  /** @internal */
  readonly setMarker: (marker: Marker) => void
  readonly state: Signal<TableOfContentsRenderState>

  constructor() {
    const env = injectEnvironment()
    const instance = injectRootId(() => this.id())
    const messages = injectMessages("table-of-contents", tableOfContentsMessages, () =>
      this.messages(),
    )
    const marker = signal<Marker>(null)
    const { view, send } = injectMachine(
      tableOfContentsMachine,
      () => ({
        id: instance(),
        value: this.value(),
        defaultValue: this.defaultValue(),
        onValueChange: (next: string, d: ChangeDetails<TableOfContentsEvent>) => {
          // Sound: every value-writing transition declares one of these reasons (machine).
          this.valueChangeDetails.emit({
            value: next,
            details: { reason: d.reason as unknown as TableOfContentsChangeReason, event: d.event },
          })
          this.valueChange.emit(next)
        },
      }),
      env,
    )
    this.api = computed(() =>
      tableOfContentsConnect({
        instance: instance(),
        value: view().values.value,
        visible: view().context.visible,
        titled: this.titled(),
        ids: { title: partId("table-of-contents", instance(), "title") },
        marker: marker(),
        messages: messages(),
      }),
    )
    this.state = computed(() => ({ value: view().values.value }))
    this.navigate = (target) => {
      // The activation's modality, read now: the focus moves after the browser's jump.
      const modality = env.modality.modality()
      send({ type: "NAVIGATE", id: target })
      if (modality !== "keyboard" && modality !== "virtual") return
      env.scheduler.requestAnimationFrame(() => {
        const heading = document.getElementById(target)
        if (!heading) return
        if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1")
        env.modality.markFocus(heading, "navigation", modality)
        // No scroll: the jump already placed the heading (and may still be scrolling smoothly).
        heading.focus({ preventScroll: true })
      })
    }
    this.setMarker = (m) => {
      const prev = untracked(marker)
      if (prev?.top !== m?.top || prev?.height !== m?.height) marker.set(m)
    }
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: ["defaultvalue", "id", "items", "messages", "offset", "ratio", "scrollroot", "value"],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready()) return
      const scrollRoot = this.scrollRoot()
      const offset = this.offset()
      const ratio = this.ratio()
      onCleanup(
        untracked(() =>
          readingPosition(document, {
            ids: () => untracked(this.items).map((i) => i.id),
            scrollRoot,
            offset,
            ratio,
            onPosition: (p) => send({ type: "POSITION", current: p.current, visible: p.visible }),
            onUserScroll: () => send({ type: "USER.SCROLL" }),
          }),
        ),
      )
    })
  }
}

/** The contents' heading (`<h2>`): names the navigation. */
@Directive({ selector: "[rindTableOfContentsTitle]", exportAs: "rindTableOfContentsTitle" })
export class TableOfContentsTitle {
  constructor() {
    const root = injectToc("Title")
    bindProps(() => root.api().title())
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => root.titled.set(true))
    inject(DestroyRef).onDestroy(() => root.titled.set(false))
  }
}

/** The `<ol>` of entries; it keeps the current link in view when it scrolls. */
@Directive({ selector: "[rindTableOfContentsList]", exportAs: "rindTableOfContentsList" })
export class TableOfContentsList {
  constructor() {
    const root = injectToc("List")
    const list: Element = inject(ElementRef).nativeElement
    bindProps(() => root.api().list())
    if (inject(PLATFORM_ID) !== "browser") return
    // The current link: the Indicator's box, and kept in view when the List scrolls (Starlight
    // #3617), by the List's own scrollTop only (scrollIntoView would move the page too).
    let placed: string | null = null
    afterEveryRender(() => {
      const current = untracked(root.state).value
      if (placed === current) return
      placed = current
      const link = list.querySelector<HTMLElement>('[aria-current="location"]')
      if (!(list instanceof HTMLElement) || !link) {
        root.setMarker(null)
        return
      }
      const box = list.getBoundingClientRect()
      const own = link.getBoundingClientRect()
      // rects are viewport pixels; the marker is placed in the list's own (zoomed) ones
      const z = cssZoom(list)
      const top = (own.top - box.top) / z + list.scrollTop
      const height = own.height / z
      root.setMarker({ top, height })
      if (list.scrollHeight > list.clientHeight) {
        if (top < list.scrollTop) list.scrollTop = top
        else if (top + height > list.scrollTop + list.clientHeight)
          list.scrollTop = top + height - list.clientHeight
      }
    })
  }
}

/** An entry: `<li rindTableOfContentsItem [item]="section">`. */
@Directive({
  selector: "[rindTableOfContentsItem]",
  exportAs: "rindTableOfContentsItem",
  providers: [{ provide: ITEM, useExisting: forwardRef(() => TableOfContentsItem) }],
})
export class TableOfContentsItem {
  /** The section this item lists. */
  readonly item = input.required<TocItem>()
  constructor() {
    const root = injectToc("Item")
    bindProps(() => root.api().item(this.item()), { owns: ["item"] })
  }
}

/** The entry's link (`<a rindTableOfContentsLink>`): its content, or the section's label. */
@Component({
  selector: "[rindTableOfContentsLink]",
  exportAs: "rindTableOfContentsLink",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ label() }}</ng-content>",
})
export class TableOfContentsLink {
  /** @internal */
  protected readonly label: Signal<string>
  constructor() {
    const root = injectToc("Link")
    const item = inject(ITEM, { optional: true })
    if (!item) throw new Error("rindTableOfContentsLink must be inside rindTableOfContentsItem")
    const env = injectEnvironment()
    this.label = computed(() => item.item().label)
    // The link's own focus, tracked from the first render so the focusing key is known.
    if (inject(PLATFORM_ID) === "browser") {
      const destroy = inject(DestroyRef)
      afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    }
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    bindProps(() => {
      const it = item.item()
      return joinHandlers(root.api().link(it, { focused: focused(), modality: modality() }), {
        onFocusIn: (e: FocusEvent) => {
          if (e.target === e.currentTarget) focused.set(true)
        },
        onFocusOut: (e: FocusEvent) => {
          if (e.target === e.currentTarget) focused.set(false)
        },
        onClick: (e: MouseEvent) => {
          // New tab, new window, download: the browser's, not a jump on this page.
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          root.navigate(it.id)
        },
      })
    })
  }
}

/** Follows the current link (`--rind-toc-indicator-*`). */
@Directive({
  selector: "[rindTableOfContentsIndicator]",
  exportAs: "rindTableOfContentsIndicator",
})
export class TableOfContentsIndicator {
  constructor() {
    const root = injectToc("Indicator")
    bindProps(() => root.api().indicator())
  }
}

/** The Table of Contents' parts, for a standalone component's `imports`. */
export const TableOfContents = [
  TableOfContentsRoot,
  TableOfContentsTitle,
  TableOfContentsList,
  TableOfContentsItem,
  TableOfContentsLink,
  TableOfContentsIndicator,
] as const
