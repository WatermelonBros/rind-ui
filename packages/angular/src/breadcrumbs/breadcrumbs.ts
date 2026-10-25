import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
  signal,
} from "@angular/core"
import {
  type BreadcrumbsCurrentValue,
  type BreadcrumbsItemState,
  type BreadcrumbsMessages,
  type BreadcrumbsTrail,
  type BreadcrumbsTrailItem,
  breadcrumbsConnect,
  breadcrumbsItemState,
  breadcrumbsMessages,
  deriveTrail,
  type Href,
  type ItemRegistry,
  type MessageOverrides,
  type RouterOptions,
  warnBreadcrumbsInPopup,
  warnCurrentWithoutAria,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { injectCollectionItems, injectRegisterItem } from "../collection-items"
import { CONTROL_OVERRIDE, HostedControl } from "../hosted-control"
import { injectRootId } from "../ids"
import { Link } from "../link/link"
import { injectMessages } from "../provider"

/** What an Item's Link reports up: where it goes and its text (the ellipsis menu's item). */
interface ItemMeta {
  readonly current?: boolean | undefined
  readonly href?: Href | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly text?: string | undefined
}

const sameMeta = (a: ItemMeta | undefined, b: ItemMeta) =>
  a !== undefined &&
  a.current === b.current &&
  a.href === b.href &&
  a.routerOptions === b.routerOptions &&
  a.text === b.text

export interface BreadcrumbsState {
  readonly collapsed: boolean
}

const ROOT = new InjectionToken<BreadcrumbsRoot>("rind-ui.breadcrumbs")
const ITEM = new InjectionToken<BreadcrumbsItem>("rind-ui.breadcrumbs-item")

function injectRoot(part: string): BreadcrumbsRoot {
  const root = inject(ROOT, { optional: true })
  if (!root) throw new Error(`rindBreadcrumbs${part} must be inside rindBreadcrumbsRoot`)
  return root
}
function injectItem(part: string): BreadcrumbsItem {
  const item = inject(ITEM, { optional: true })
  if (!item) throw new Error(`rindBreadcrumbs${part} must be inside rindBreadcrumbsItem`)
  return item
}

/**
 * The trail: `<nav rindBreadcrumbsRoot>` holding an `<ol rindBreadcrumbsList>` of
 * `<li rindBreadcrumbsItem value="…">` crumbs, each with its Link and Separator.
 */
@Directive({
  selector: "[rindBreadcrumbsRoot]",
  exportAs: "rindBreadcrumbsRoot",
  providers: [{ provide: ROOT, useExisting: forwardRef(() => BreadcrumbsRoot) }],
})
export class BreadcrumbsRoot {
  /** Collapse the middle items past this many. */
  readonly maxItems = input<number>()
  /** Default 1. */
  readonly itemsBeforeCollapse = input<number>()
  /** Default 1. */
  readonly itemsAfterCollapse = input<number>()
  /** The current item's `aria-current`. Default `"page"`. */
  readonly currentValue = input<BreadcrumbsCurrentValue>("page")
  /**
   * The trail as data: collapse is known while rendering (the server render collapses too).
   * Render one Item per entry, with the same `value`.
   */
  readonly items = input<readonly BreadcrumbsTrailItem[]>()
  readonly messages = input<MessageOverrides<BreadcrumbsMessages>>()
  readonly id = input<string>()

  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly connect: Signal<ReturnType<typeof breadcrumbsConnect>>
  /** @internal */
  readonly trail: Signal<BreadcrumbsTrail>
  /** @internal */
  readonly trailItems: Signal<readonly BreadcrumbsTrailItem[]>
  /** @internal */
  readonly messageTexts: Signal<BreadcrumbsMessages>
  /** @internal Null with the data-driven `items` input: nothing registers. */
  readonly registry: () => ItemRegistry | null
  /** @internal */
  readonly setMeta: (key: string, meta: ItemMeta) => void
  /** The trail's state, for the template (`#b="rindBreadcrumbsRoot"`, `b.state()`). */
  readonly state: Signal<BreadcrumbsState>

  constructor() {
    const messages = injectMessages("breadcrumbs", breadcrumbsMessages, () => this.messages())
    this.messageTexts = messages
    const { collection, registry } = injectCollectionItems()
    this.registry = () => (this.items() ? null : registry)
    const meta = new Map<string, ItemMeta>()
    const version = signal(0)
    this.setMeta = (key, next) => {
      if (sameMeta(meta.get(key), next)) return
      meta.set(key, next)
      version.update((v) => v + 1)
    }
    this.trailItems = computed((): readonly BreadcrumbsTrailItem[] => {
      const data = this.items()
      if (data) return data
      version()
      const c = collection()
      return Array.from({ length: c?.size ?? 0 }, (_, i) => {
        const it = c?.at(i)?.value
        const m = it ? meta.get(it.key) : undefined
        return {
          key: it?.key ?? "",
          current: m?.current,
          disabled: it?.disabled,
          href: m?.href,
          routerOptions: m?.routerOptions,
          textValue: m?.text ?? it?.textValue ?? "",
        }
      })
    })
    this.trail = computed(() =>
      deriveTrail({
        items: this.trailItems(),
        maxItems: this.maxItems(),
        itemsBeforeCollapse: this.itemsBeforeCollapse(),
        itemsAfterCollapse: this.itemsAfterCollapse(),
      }),
    )
    const labelled =
      inject(new HostAttributeToken("aria-label"), { optional: true }) !== null ||
      inject(new HostAttributeToken("aria-labelledby"), { optional: true }) !== null
    this.connect = computed(() =>
      breadcrumbsConnect({
        instance: this.instance(),
        trail: this.trail(),
        labelled,
        label: messages().label,
      }),
    )
    this.state = computed(() => ({ collapsed: this.trail().collapsed.length > 0 }))
    bindProps(
      () => ({ ...this.connect().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "currentvalue",
          "id",
          "items",
          "itemsaftercollapse",
          "itemsbeforecollapse",
          "maxitems",
          "messages",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const el: Element = inject(ElementRef).nativeElement
    afterNextRender(() => {
      if (el instanceof HTMLElement) warnBreadcrumbsInPopup(el)
    })
  }
}

/** The `<ol>` of crumbs. */
@Directive({ selector: "[rindBreadcrumbsList]", exportAs: "rindBreadcrumbsList" })
export class BreadcrumbsList {
  constructor() {
    const root = injectRoot("List")
    bindProps(() => root.connect().list())
  }
}

/**
 * A crumb: `<li rindBreadcrumbsItem value="docs" #i="rindBreadcrumbsItem">`. The current one
 * without `href` is text, not a link: render `<span rindBreadcrumbsCurrent>` for it
 * (`@if (i.state().current && !href)`), `<a rindBreadcrumbsLink>` otherwise.
 */
@Directive({
  selector: "[rindBreadcrumbsItem]",
  exportAs: "rindBreadcrumbsItem",
  providers: [{ provide: ITEM, useExisting: forwardRef(() => BreadcrumbsItem) }],
})
export class BreadcrumbsItem {
  /** The Item's key: stable across renders, so the trail keeps its DOM nodes. */
  readonly value = input.required<string>()
  /** `true` makes it current; `false` on the last Item opts out of the default. */
  readonly current = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Its text in the ellipsis menu; default its Link's text. */
  readonly textValue = input<string>()

  /** The crumb's state, for the template. */
  readonly state: Signal<BreadcrumbsItemState>
  /** @internal What its Link reports (set in the Link's renders). */
  readonly linkMeta: { current: ItemMeta } = { current: {} }
  /** @internal The Link or text that had focus was replaced: the next one takes it. */
  readonly focusHandoff = { pending: false }

  constructor() {
    const root = injectRoot("Item")
    const el: Element = inject(ElementRef).nativeElement
    // The registry is fixed by the Root's mode (data-driven or registered).
    injectRegisterItem(
      root.registry(),
      () => ({ key: this.value(), textValue: this.textValue(), disabled: this.disabled() }),
      el,
    )
    this.state = computed(() =>
      breadcrumbsItemState(root.trail(), this.value(), this.disabled(), root.currentValue()),
    )
    bindProps(() => root.connect().item(this.state()), {
      owns: ["current", "disabled", "textvalue", "value"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // After the Link's render (children render first): the Item's own `current` with its Link's.
    let warned = false
    afterEveryRender(() => {
      root.setMeta(this.value(), {
        ...this.linkMeta.current,
        current: this.current(),
        text: this.textValue() ?? this.linkMeta.current.text,
      })
      if (!warned && this.state().current && el instanceof HTMLElement) {
        warned = true
        warnCurrentWithoutAria(el)
      }
    })
  }
}

/** Reports the crumb's link or text up to its Item, and keeps focus across a swap. */
function injectCrumb(item: BreadcrumbsItem, meta: () => Omit<ItemMeta, "current" | "text">) {
  if (inject(PLATFORM_ID) !== "browser") return
  const el: Element = inject(ElementRef).nativeElement
  // A focused link that becomes the current text is a new element (an <a> becomes a <span>):
  // the old one notes the focus as it goes, the new one takes it (react-spectrum#2592, #5294).
  inject(DestroyRef).onDestroy(() => {
    if (el.ownerDocument.activeElement === el) item.focusHandoff.pending = true
  })
  afterNextRender(() => {
    if (!item.focusHandoff.pending) return
    item.focusHandoff.pending = false
    if (el instanceof HTMLElement) el.focus()
  })
  afterEveryRender({
    // Before the Item's report (the `read` phase runs after it): what the Item reports up.
    earlyRead: () => {
      item.linkMeta.current = { ...meta(), text: el.textContent?.trim() ?? "" }
    },
  })
}

/** The crumb's link: `<a rindBreadcrumbsLink href="/docs">Docs</a>` (a rind-ui Link). */
@Directive({
  selector: "[rindBreadcrumbsLink]",
  exportAs: "rindBreadcrumbsLink",
  providers: [{ provide: CONTROL_OVERRIDE, useFactory: () => new HostedControl() }],
  hostDirectives: [
    {
      directive: Link,
      inputs: [
        "href",
        "target",
        "rel",
        "download",
        "ping",
        "referrerpolicy",
        "hreflang",
        "routerOptions",
      ],
      outputs: ["activate"],
    },
  ],
})
export class BreadcrumbsLink {
  constructor() {
    const root = injectRoot("Link")
    const item = injectItem("Link")
    const link = inject(Link, { self: true })
    const hosted = inject(CONTROL_OVERRIDE, { self: true })
    hosted.source = {
      disabled: () => item.state().disabled,
      current: () => (item.state().current ? item.state().currentValue : undefined),
    }
    bindProps(() => ({
      "data-scope": "breadcrumbs",
      "data-part": "link",
      "data-instance": root.instance(),
    }))
    injectCrumb(item, () => ({ href: link.href(), routerOptions: link.routerOptions() }))
  }
}

/** The current crumb's text, when it has no `href`: `<span rindBreadcrumbsCurrent>`. */
@Directive({ selector: "[rindBreadcrumbsCurrent]", exportAs: "rindBreadcrumbsCurrent" })
export class BreadcrumbsCurrent {
  constructor() {
    const root = injectRoot("Current")
    const item = injectItem("Current")
    bindProps(() => root.connect().currentText(item.state()))
    injectCrumb(item, () => ({ href: undefined, routerOptions: undefined }))
  }
}

/** A glyph after the crumb, `aria-hidden`; no default content. */
@Directive({ selector: "[rindBreadcrumbsSeparator]", exportAs: "rindBreadcrumbsSeparator" })
export class BreadcrumbsSeparator {
  constructor() {
    const root = injectRoot("Separator")
    const item = injectItem("Separator")
    bindProps(() => root.connect().separator(item.state()))
  }
}

/** One collapsed item, for the ellipsis menu. */
export type BreadcrumbsCollapsedItem = Pick<
  BreadcrumbsTrailItem,
  "key" | "textValue" | "href" | "routerOptions" | "disabled"
>

export interface BreadcrumbsEllipsisState {
  readonly items: readonly BreadcrumbsCollapsedItem[]
  /** The trigger's accessible name: `messages.showCollapsed(count)`. */
  readonly label: string
  readonly count: number
}

/**
 * The collapsed items' place in the list (`<li rindBreadcrumbsEllipsis #e="…">`), hidden while
 * nothing is collapsed (React renders nothing). Place it after the first `itemsBeforeCollapse`
 * Items; it usually holds a Menu (or Popover) whose trigger is named `e.state().label`.
 */
@Directive({ selector: "[rindBreadcrumbsEllipsis]", exportAs: "rindBreadcrumbsEllipsis" })
export class BreadcrumbsEllipsis {
  readonly state: Signal<BreadcrumbsEllipsisState>

  constructor() {
    const root = injectRoot("Ellipsis")
    const label = computed(() => root.messageTexts().showCollapsed(root.trail().collapsed.length))
    this.state = computed(() => {
      const trail = root.trail()
      const items = root.trailItems()
      return {
        items: trail.collapsed.flatMap((key) => {
          const it = items.find((i) => i.key === key)
          return it
            ? [
                {
                  key: it.key,
                  textValue: it.textValue,
                  href: it.href,
                  routerOptions: it.routerOptions,
                  disabled: it.disabled,
                },
              ]
            : []
        }),
        label: label(),
        count: trail.collapsed.length,
      }
    })
    bindProps(() => root.connect().ellipsis(label()) ?? absentProps("breadcrumbs", root.instance()))
  }
}

/** The Breadcrumbs' parts, for a standalone component's `imports`. */
export const Breadcrumbs = [
  BreadcrumbsRoot,
  BreadcrumbsList,
  BreadcrumbsItem,
  BreadcrumbsLink,
  BreadcrumbsCurrent,
  BreadcrumbsSeparator,
  BreadcrumbsEllipsis,
] as const
