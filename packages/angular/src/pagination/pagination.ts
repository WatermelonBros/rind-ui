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
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  ViewEncapsulation,
} from "@angular/core"
import {
  type MessageOverrides,
  type Modality,
  type PaginationDirection,
  type PaginationEntry,
  type PaginationEvent,
  type PaginationMessages,
  type PaginationState,
  paginationConnect,
  paginationMachine,
  paginationMessages,
  paginationState,
  warnDuplicateLandmark,
  warnPaginationInputs,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { Button } from "../button/button"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { CONTROL_OVERRIDE, HostedControl } from "../hosted-control"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { Link } from "../link/link"
import { injectMessages } from "../provider"

/** The Root's state (spec "Anatomy"), for the template (`#p="rindPaginationRoot"`). */
export interface PaginationRootState extends PaginationState {
  /** The visible range: pages and ellipses with stable keys. */
  readonly pages: readonly PaginationEntry[]
  /** Goes to a page (reason `SET_PAGE`), e.g. from a "go to page" field. */
  readonly setPage: (page: number) => void
  /** For a page-size control: keeps the first item of the current page visible. */
  readonly setPageSize: (pageSize: number) => void
}

const PAGINATION = new InjectionToken<PaginationRoot>("rind-ui.pagination")

function injectPagination(part: string): PaginationRoot {
  const root = inject(PAGINATION, { optional: true })
  if (!root) throw new Error(`rindPagination${part} must be inside rindPaginationRoot`)
  return root
}

const named = (attr: string) => inject(new HostAttributeToken(attr), { optional: true }) !== null

/**
 * Pagination: `<nav rindPaginationRoot [totalPages]="20" #p="rindPaginationRoot">` with a
 * `<ul rindPaginationList>` of `<li rindPaginationItem>` entries, one per `p.state().pages`.
 * Its pages and triggers are `<button>`s, or `<a>`s when `getPageHref` is set.
 */
@Directive({
  selector: "[rindPaginationRoot]",
  exportAs: "rindPaginationRoot",
  providers: [{ provide: PAGINATION, useExisting: forwardRef(() => PaginationRoot) }],
})
export class PaginationRoot {
  /** The page count; or pass `count` (items) with a page size, never both. */
  readonly totalPages = input<number>()
  /** The item count: the pages follow from the page size. */
  readonly count = input<number>()
  /** Controlled page (`[(page)]`). */
  readonly page = input<number>()
  readonly defaultPage = input<number>()
  /** Controlled page size (`[(pageSize)]`), with `count`. */
  readonly pageSize = input<number>()
  readonly defaultPageSize = input<number>()
  readonly siblingCount = input<number>()
  readonly boundaryCount = input<number>()
  /** Every control ignores activation (disable while loading). */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Default `true`: unavailable controls keep focus (`aria-disabled`). */
  readonly focusableWhenDisabled = input(true, { transform: booleanAttribute })
  /** Pages and triggers are links (write them as `<a>`), spec "Buttons And Links". */
  readonly getPageHref = input<(page: number, pageSize: number) => string>()
  readonly messages = input<MessageOverrides<PaginationMessages>>()
  readonly id = input<string>()
  /** Every change proposes a page; `details.cancel()` vetoes it. */
  readonly pageChangeDetails = output<ChangeEvent<number, PaginationEvent>>()
  /** The accepted page, for `[(page)]`. */
  readonly pageChange = output<number>()
  readonly pageSizeChangeDetails = output<ChangeEvent<number, PaginationEvent>>()
  /** The accepted page size, for `[(pageSize)]`. */
  readonly pageSizeChange = output<number>()

  private readonly onPage = changeEmitter<number, PaginationEvent>(
    this.pageChangeDetails,
    this.pageChange,
  )
  private readonly onPageSize = changeEmitter<number, PaginationEvent>(
    this.pageSizeChangeDetails,
    this.pageSizeChange,
  )
  /** @internal */
  readonly api: Signal<ReturnType<typeof paginationConnect>>
  /** @internal */
  readonly send: (e: PaginationEvent) => void
  /** The pagination's state and actions, for the template. */
  readonly state: Signal<PaginationRootState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const messages = injectMessages("pagination", paginationMessages, () => this.messages())
    const machineProps = () => ({
      totalPages: this.totalPages(),
      count: this.count(),
      page: this.page(),
      defaultPage: this.defaultPage(),
      onPageChange: this.onPage,
      pageSize: this.pageSize(),
      defaultPageSize: this.defaultPageSize(),
      onPageSizeChange: this.onPageSize,
      siblingCount: this.siblingCount(),
      boundaryCount: this.boundaryCount(),
      disabled: this.disabled(),
    })
    const { view, send } = injectMachine(paginationMachine, machineProps)
    this.send = send
    const base = computed(() => paginationState(machineProps(), view().values))
    this.api = computed(() =>
      paginationConnect({
        instance: instance(),
        state: base(),
        messages: messages(),
        disabled: this.disabled(),
        siblingCount: this.siblingCount(),
        boundaryCount: this.boundaryCount(),
      }),
    )
    this.state = computed(() => ({
      ...base(),
      pages: this.api().pages(),
      setPage: (n) => send({ type: "SET_PAGE", page: n, modality: "virtual" }),
      setPageSize: (n) => send({ type: "SET_PAGE_SIZE", pageSize: n }),
    }))
    const labelled = named("aria-label") || named("aria-labelledby")
    bindProps(() => this.api().root(labelled), {
      owns: [
        "boundarycount",
        "count",
        "defaultpage",
        "defaultpagesize",
        "disabled",
        "focusablewhendisabled",
        "id",
        "page",
        "pagesize",
        "siblingcount",
        "totalpages",
      ],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // ponytail: no "controlled without a handler" warning; an output's listeners are not known.
    effect(() =>
      warnPaginationInputs({
        totalPages: this.totalPages(),
        count: this.count(),
        pageSize: this.pageSize(),
        siblingCount: this.siblingCount(),
        boundaryCount: this.boundaryCount(),
      }),
    )
    const el: Element = inject(ElementRef).nativeElement
    afterNextRender(() => {
      if (el instanceof HTMLElement) warnDuplicateLandmark(el)
    })
  }
}

/** The `<ul>` of entries. */
@Directive({ selector: "[rindPaginationList]", exportAs: "rindPaginationList" })
export class PaginationList {
  constructor() {
    const root = injectPagination("List")
    bindProps(() => root.api().list())
  }
}

/** An entry: `<li rindPaginationItem>`, `type="trigger"` or `"ellipsis"` for those. */
@Directive({ selector: "[rindPaginationItem]", exportAs: "rindPaginationItem" })
export class PaginationItem {
  /** What the item holds (`data-type`). Default `"page"`. */
  readonly type = input<"page" | "ellipsis" | "trigger">("page")
  constructor() {
    const root = injectPagination("Item")
    bindProps(() => root.api().item(this.type()), { owns: ["type"] })
  }
}

/** The Button's or the Link's wiring of a page or a trigger. */
@Directive()
abstract class PaginationControl {
  /** Default: the Root's (`true`). */
  readonly focusableWhenDisabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })

  protected wire(
    root: PaginationRoot,
    c: () => {
      readonly disabled: boolean
      readonly href: string | undefined
      readonly current: boolean
    },
    onActivate: (modality: Modality) => void,
  ): void {
    const hosted = inject(CONTROL_OVERRIDE, { self: true })
    hosted.source = {
      disabled: () => c().disabled,
      focusableWhenDisabled: () => this.focusableWhenDisabled() ?? root.focusableWhenDisabled(),
      current: () => (c().current ? "page" : undefined),
      href: () => c().href,
    }
    const button = inject(Button, { self: true, optional: true })
    const link = inject(Link, { self: true, optional: true })
    const destroy = inject(DestroyRef)
    if (button) {
      const sub = button.press.subscribe((d) => onActivate(d.modality))
      destroy.onDestroy(() => sub.unsubscribe())
    }
    if (link) {
      // Same-tab activations only: a ⌘/Ctrl/middle click opens elsewhere and the page stays.
      const sub = link.activate.subscribe((a) => {
        if (a.disposition === "same-tab") onActivate(a.modality)
      })
      destroy.onDestroy(() => sub.unsubscribe())
    }
  }
}

/** Each page and trigger provides it on its element; its Button or Link reads it. */
const hosted = { provide: CONTROL_OVERRIDE, useFactory: () => new HostedControl() }

/** A page: `<button rindPaginationPage [value]="n">` (or `<a>` with `getPageHref`). */
@Directive()
abstract class PageBase extends PaginationControl {
  /** The page number it goes to; `aria-current="page"` when it is the current page. */
  readonly value = input.required<number>()
  constructor() {
    super()
    const root = injectPagination("Page")
    const labelled = named("aria-label") || named("aria-labelledby")
    const c = computed(() => root.api().page(this.value(), labelled))
    this.wire(
      root,
      () => {
        const s = root.state()
        return {
          disabled: c().disabled,
          current: this.value() === s.page,
          href: root.getPageHref()?.(this.value(), s.pageSize),
        }
      },
      (modality) => root.send({ type: "SET_PAGE", page: this.value(), modality }),
    )
    bindProps(() => c().props, { owns: ["focusablewhendisabled", "value"] })
  }
}

@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  template: "<ng-content>{{ value() }}</ng-content>",
  selector: "button[rindPaginationPage]",
  exportAs: "rindPaginationPage",
  hostDirectives: [Button],
})
export class PaginationPage extends PageBase {}

@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  template: "<ng-content>{{ value() }}</ng-content>",
  selector: "a[rindPaginationPage]",
  exportAs: "rindPaginationPage",
  hostDirectives: [Link],
})
export class PaginationPageLink extends PageBase {}

const EVENT = { first: "FIRST", previous: "PREV", next: "NEXT", last: "LAST" } as const
const TARGET: Record<PaginationDirection, (s: PaginationState) => number> = {
  first: () => 1,
  previous: (s) => Math.max(1, s.page - 1),
  next: (s) => Math.min(s.totalPages, s.page + 1),
  last: (s) => s.totalPages,
}

/** First, Previous, Next, Last: a chevron unless you give it content. */
@Directive()
abstract class TriggerBase extends PaginationControl {
  protected abstract readonly direction: PaginationDirection
  constructor() {
    super()
    const root = injectPagination("Trigger")
    const el: Element = inject(ElementRef).nativeElement
    const labelled = named("aria-label") || named("aria-labelledby")
    // Text content names the trigger (an icon-only one keeps the message name).
    const hasText = () => (el.textContent ?? "").trim() !== ""
    const text = signal(hasText())
    // `direction` is a subclass field: read in renders, after construction.
    const c = computed(() => root.api().trigger(this.direction, labelled || text()))
    this.wire(
      root,
      () => {
        const s = root.state()
        return {
          disabled: c().disabled,
          current: false,
          // Unavailable: no href (zag#3399); Link also drops it while disabled.
          href: c().disabled
            ? undefined
            : root.getPageHref()?.(TARGET[this.direction](s), s.pageSize),
        }
      },
      (modality) => root.send({ type: EVENT[this.direction], modality }),
    )
    bindProps(() => c().props, { owns: ["focusablewhendisabled"] })
    if (inject(PLATFORM_ID) === "browser") afterEveryRender({ read: () => text.set(hasText()) })
  }
}

@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  selector: "button[rindPaginationFirst]",
  exportAs: "rindPaginationFirst",
  hostDirectives: [Button],
  template: `<ng-content><svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em" data-direction="first"><path d="M11 4 7 8l4 4M6 4v8" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg></ng-content>`,
})
export class PaginationFirst extends TriggerBase {
  protected readonly direction = "first"
}
@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  selector: "a[rindPaginationFirst]",
  exportAs: "rindPaginationFirst",
  hostDirectives: [Link],
  template: `<ng-content><svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em" data-direction="first"><path d="M11 4 7 8l4 4M6 4v8" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg></ng-content>`,
})
export class PaginationFirstLink extends TriggerBase {
  protected readonly direction = "first"
}
@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  selector: "button[rindPaginationPrevious]",
  exportAs: "rindPaginationPrevious",
  hostDirectives: [Button],
  template: `<ng-content><svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em" data-direction="previous"><path d="M10 4 6 8l4 4" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg></ng-content>`,
})
export class PaginationPrevious extends TriggerBase {
  protected readonly direction = "previous"
}
@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  selector: "a[rindPaginationPrevious]",
  exportAs: "rindPaginationPrevious",
  hostDirectives: [Link],
  template: `<ng-content><svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em" data-direction="previous"><path d="M10 4 6 8l4 4" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg></ng-content>`,
})
export class PaginationPreviousLink extends TriggerBase {
  protected readonly direction = "previous"
}
@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  selector: "button[rindPaginationNext]",
  exportAs: "rindPaginationNext",
  hostDirectives: [Button],
  template: `<ng-content><svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em" data-direction="next"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg></ng-content>`,
})
export class PaginationNext extends TriggerBase {
  protected readonly direction = "next"
}
@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  selector: "a[rindPaginationNext]",
  exportAs: "rindPaginationNext",
  hostDirectives: [Link],
  template: `<ng-content><svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em" data-direction="next"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg></ng-content>`,
})
export class PaginationNextLink extends TriggerBase {
  protected readonly direction = "next"
}
@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  selector: "button[rindPaginationLast]",
  exportAs: "rindPaginationLast",
  hostDirectives: [Button],
  template: `<ng-content><svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em" data-direction="last"><path d="m5 4 4 4-4 4M10 4v8" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg></ng-content>`,
})
export class PaginationLast extends TriggerBase {
  protected readonly direction = "last"
}
@Component({
  encapsulation: ViewEncapsulation.None,
  providers: [hosted],
  selector: "a[rindPaginationLast]",
  exportAs: "rindPaginationLast",
  hostDirectives: [Link],
  template: `<ng-content><svg aria-hidden="true" viewBox="0 0 16 16" width="1em" height="1em" data-direction="last"><path d="m5 4 4 4-4 4M10 4v8" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg></ng-content>`,
})
export class PaginationLastLink extends TriggerBase {
  protected readonly direction = "last"
}

/** A gap in the range: `<span rindPaginationEllipsis [position]="e.position">` (default "…"). */
@Component({
  selector: "[rindPaginationEllipsis]",
  exportAs: "rindPaginationEllipsis",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>…</ng-content>",
})
export class PaginationEllipsis {
  /** Which gap it stands for, before or after the current page (`data-position`). Default: "end". */
  readonly position = input<"start" | "end">("end")
  constructor() {
    const root = injectPagination("Ellipsis")
    bindProps(() => root.api().ellipsis(this.position()), { owns: ["position"] })
  }
}

/** The Pagination's parts, for a standalone component's `imports`. */
export const Pagination = [
  PaginationRoot,
  PaginationList,
  PaginationItem,
  PaginationPage,
  PaginationPageLink,
  PaginationFirst,
  PaginationFirstLink,
  PaginationPrevious,
  PaginationPreviousLink,
  PaginationNext,
  PaginationNextLink,
  PaginationLast,
  PaginationLastLink,
  PaginationEllipsis,
] as const
