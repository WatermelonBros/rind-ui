// Tag Group: the Root hosting the parts (design §4). Wiring only: the machine owns highlight,
// selection, activation and removal; connect owns every attribute. Tags come from `items` data
// or from static Tag parts (collections registration); both render the same DOM.
import {
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
  announcerCapability,
  type Collection,
  type CollectionKey,
  checkTagGroupList,
  createListCollection,
  layoutCapability,
  type PartProps,
  type TagGroupActionDetails,
  type TagGroupMessages,
  type TagGroupParts,
  type TagGroupRemoveDetails,
  type TagGroupValue,
  tagGroupConnect,
  tagGroupIds,
  tagGroupMachine,
  tagSelectionOf,
  toKey,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectCollectionItems, injectRegisterItem } from "../collection-items"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment } from "../provider"
import { RindProps } from "../rind-props"

declare const process: { env: { NODE_ENV?: string } }

/** One tag of a data-driven group. */
export interface TagGroupItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  /** A link tag: its text renders as an anchor. */
  readonly href?: string
}
const fromData = (items: readonly TagGroupItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY = fromData([])

export interface TagGroupChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

const TAG_GROUP = new InjectionToken<TagGroupRoot>("rind-ui.tag-group")
const TAG = new InjectionToken<TagGroupTag>("rind-ui.tag-group-tag")
const LIST = new InjectionToken<boolean>("rind-ui.tag-group-list")

function injectHost(part: string): TagGroupRoot {
  const root = inject(TAG_GROUP, { optional: true })
  if (!root) throw new Error(`rindTagGroup${part} must be inside rindTagGroupRoot`)
  return root
}

/** A tag of the data, for a template's `@for` (`#g="rindTagGroupRoot"`, `g.tags()`). */
export interface TagGroupTagData {
  readonly key: string
  readonly label: string
  readonly disabled: boolean
  readonly href: string | undefined
}

/**
 * A collection of tags: browse with one Tab stop; select, act on, follow or remove them.
 * `<div rindTagGroupRoot [items]="cities" [onRemove]="drop">` with a Label and a List of
 * `rindTagGroupTag` tags; it renders the keyboard hint after its content.
 */
@Component({
  selector: "[rindTagGroupRoot]",
  exportAs: "rindTagGroupRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: TAG_GROUP, useExisting: forwardRef(() => TagGroupRoot) }],
  template: `<ng-content />@if (parts().hinted) {<span [rindProps]="parts().hint()">{{
        parts().hintText
      }}</span>}`,
})
export class TagGroupRoot {
  /** `none` (default), `single` or `multiple`. */
  readonly selectionMode = input<"none" | "single" | "multiple">("none")
  /** Controlled selection (`[(value)]`): a key or null (single), keys (multiple). */
  readonly value = input<string | readonly string[] | null>()
  readonly defaultValue = input<string | readonly string[] | null>()
  /** No user action leaves the selection empty. */
  readonly disallowEmptySelection = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false) },
  )
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Disabled tags stay reachable (announced as dimmed). Default true. */
  readonly focusableWhenDisabled = input(true, { transform: booleanAttribute })
  /** Arrow keys wrap around. Default true. */
  readonly loop = input(true, { transform: booleanAttribute })
  /** How long typed characters build one typeahead search (ms). Default: 1000. */
  readonly typeaheadTimeout = input<number>()
  /** Data tags. Without them (and without `collection`), Tag parts register themselves. */
  readonly items = input<readonly TagGroupItemData[]>()
  /** A collection built by the consumer, used instead of `items`. */
  readonly collection = input<Collection<unknown>>()
  /** Tags are removable: drop the keys from your data, or keep them (nothing happens). */
  readonly onRemove = input<(keys: readonly string[], details: TagGroupRemoveDetails) => void>()
  readonly onAction = input<(key: string, details: TagGroupActionDetails) => void>()
  readonly messages = input<Partial<TagGroupMessages>>()
  readonly id = input<string>()
  readonly valueChangeDetails = output<{
    value: string | readonly string[] | null
    details: TagGroupChangeDetails
  }>()
  /** The selection, for `[(value)]`. */
  readonly valueChange = output<string | readonly string[] | null>()

  /** @internal */
  readonly parts: Signal<TagGroupParts>
  /** @internal */
  readonly registry: () => ReturnType<typeof injectCollectionItems>["registry"] | null
  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly hrefOf: (key: CollectionKey) => string | undefined
  /** The data tags, for a template's `@for`. */
  readonly tags: Signal<readonly TagGroupTagData[]>
  private readonly mounted = signal({ label: false, description: false })
  private readonly staticLinks = signal<ReadonlySet<CollectionKey>>(new Set())
  private readonly hovered = signal<CollectionKey | null>(null)
  private readonly pressed = signal<CollectionKey | null>(null)

  constructor() {
    const env = injectEnvironment(announcerCapability, layoutCapability)
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const { collection: registered, registry } = injectCollectionItems()
    const data = computed(() => {
      const items = this.items()
      return items ? fromData(items) : null
    })
    const collection = computed(() => this.collection() ?? data() ?? registered() ?? EMPTY)
    this.registry = () => (this.collection() || data() ? null : registry)
    const ids = computed(() => tagGroupIds(instance()))
    const links = computed(() => {
      const out = new Set<CollectionKey>(this.staticLinks())
      for (const i of this.items() ?? []) if (i.href !== undefined) out.add(toKey(i.key))
      return out
    })
    const hrefs = computed(
      () =>
        new Map(
          (this.items() ?? []).flatMap((i) => (i.href ? [[toKey(i.key), i.href] as const] : [])),
        ),
    )
    this.hrefOf = (key) => hrefs().get(key)
    this.tags = computed(() => {
      const out: TagGroupTagData[] = []
      for (const node of collection()) {
        if (node.type !== "item") continue
        out.push({
          key: node.key,
          label: node.textValue,
          disabled: node.disabled === true,
          href: hrefs().get(node.key),
        })
      }
      return out
    })
    const { view, send, service } = injectMachine(
      tagGroupMachine,
      () => ({
        collection: collection(),
        ids: ids(),
        instance: instance(),
        strategy: "roving" as const,
        selectionMode: this.selectionMode(),
        selectionBehavior: "toggle" as const,
        disallowEmptySelection: this.disallowEmptySelection(),
        disabled: this.disabled(),
        focusableWhenDisabled: this.focusableWhenDisabled(),
        loop: this.loop(),
        typeaheadTimeout: this.typeaheadTimeout(),
        links: links(),
        messages: this.messages(),
        ...(this.value() === undefined ? {} : { value: this.value() as TagGroupValue }),
        defaultValue:
          (this.defaultValue() as TagGroupValue | undefined) ??
          (this.selectionMode() === "multiple" ? [] : null),
        onValueChange: (v: TagGroupValue, details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          const value = v as string | readonly string[] | null
          this.valueChangeDetails.emit({ value, details: { reason: e.type, key: e.key } })
          this.valueChange.emit(value)
        },
        onRemove: this.onRemove()
          ? (keys: readonly string[], d: TagGroupRemoveDetails) =>
              untracked(this.onRemove)?.(keys, d)
          : undefined,
        onAction: this.onAction()
          ? (key: string, d: TagGroupActionDetails) => untracked(this.onAction)?.(key, d)
          : undefined,
      }),
      env,
    )
    // The hint follows the last interaction anywhere (a virtual cursor arrives from outside).
    const modality = injectModality(env.modality, () => true)
    this.parts = computed(() =>
      tagGroupConnect(
        {
          instance: instance(),
          collection: collection(),
          context: view().context,
          selection: tagSelectionOf(view().values.value as TagGroupValue),
          selectionMode: this.selectionMode(),
          removable: this.onRemove() !== undefined,
          actions: this.onAction() !== undefined,
          links: links(),
          disabled: this.disabled(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
          pending: !this.collection() && !data() && registered() === null,
          focused: view().matches("focused"),
          modality: modality(),
          // platform-convention: touch screen readers reach the remove button; no Delete hint there
          touchDevice: env.platform.ios || env.platform.android,
          hoveredKey: this.hovered(),
          pressedKey: this.pressed(),
          typingAhead: () => {
            const t = service().getSnapshot().context.typeahead
            return (
              t.buffer !== "" &&
              env.clock.now() - t.at <= (untracked(this.typeaheadTimeout) ?? 1000)
            )
          },
          mounted: this.mounted(),
          messages: this.messages(),
          send,
        },
        env,
      ),
    )
    bindProps(() => this.parts().root(), {
      owns: [
        "collection",
        "defaultvalue",
        "disabled",
        "disallowemptyselection",
        "focusablewhendisabled",
        "id",
        "items",
        "loop",
        "messages",
        "onaction",
        "onremove",
        "selectionmode",
        "typeaheadtimeout",
        "value",
      ],
    })
  }

  /** @internal */
  mount(part: "label" | "description", on: boolean): void {
    const m = untracked(this.mounted)
    if (m[part] !== on) this.mounted.set({ ...m, [part]: on })
  }
  /** @internal */
  mountLink(key: CollectionKey, on: boolean): void {
    const now = untracked(this.staticLinks)
    if (now.has(key) === on) return
    const next = new Set(now)
    if (on) next.add(key)
    else next.delete(key)
    this.staticLinks.set(next)
  }
  /** @internal */
  hover(key: CollectionKey | null): void {
    this.hovered.set(key)
  }
  /** @internal */
  press(key: CollectionKey | null): void {
    this.pressed.set(key)
  }
  /** @internal */
  removable(): boolean {
    return this.onRemove() !== undefined
  }
}

/** Reports a mounted Label or Description while it exists. */
function injectMounted(host: TagGroupRoot, part: "label" | "description") {
  if (inject(PLATFORM_ID) !== "browser") return
  afterNextRender(() => host.mount(part, true))
  inject(DestroyRef).onDestroy(() => host.mount(part, false))
}

@Directive({ selector: "[rindTagGroupLabel]", exportAs: "rindTagGroupLabel" })
export class TagGroupLabel {
  constructor() {
    const host = injectHost("Label")
    injectMounted(host, "label")
    bindProps(() => host.parts().label())
  }
}

@Directive({ selector: "[rindTagGroupDescription]", exportAs: "rindTagGroupDescription" })
export class TagGroupDescription {
  constructor() {
    const host = injectHost("Description")
    injectMounted(host, "description")
    bindProps(() => host.parts().description())
  }
}

/** The tags' grid (or list): `<div rindTagGroupList>`. */
@Directive({
  selector: "[rindTagGroupList]",
  exportAs: "rindTagGroupList",
  providers: [{ provide: LIST, useValue: true }],
})
export class TagGroupList {
  constructor() {
    const host = injectHost("List")
    const el: Element = inject(ElementRef).nativeElement
    let naming: { "aria-label"?: string; "aria-labelledby"?: string } = {}
    const { statics } = bindProps(() => host.parts().list(naming))
    const label = statics.get("aria-label")
    const labelledBy = statics.get("aria-labelledby")
    naming = {
      ...(label === undefined ? {} : { "aria-label": label }),
      ...(labelledBy === undefined ? {} : { "aria-labelledby": labelledBy }),
    }
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    // After the render a Label's registration causes, not on the first one.
    effect(() => {
      if (!ready()) return
      const interactive = host.parts().interactive
      queueMicrotask(() => {
        if (el instanceof HTMLElement && el.isConnected) checkTagGroupList(el, interactive)
      })
    })
  }
}

/**
 * A tag: `<div rindTagGroupTag value="rome" #t="rindTagGroupTag">`, its content in the cell it
 * renders. A link tag's text is `<a rindTagGroupTagText>` (`t.href()`), a plain one a `<span>`.
 */
@Component({
  selector: "[rindTagGroupTag]",
  exportAs: "rindTagGroupTag",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: TAG, useExisting: forwardRef(() => TagGroupTag) }],
  template: `<div [rindProps]="cellProps()"><ng-content /></div>`,
})
export class TagGroupTag {
  /** The tag key. */
  readonly value = input.required<string>()
  /** The tag's text for typeahead and the remove button's name. */
  readonly textValue = input<string>()
  /** Disables this tag: it cannot be selected or removed. */
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** A link tag: its TagText is an `<a>` to it. */
  readonly hrefInput = input<string | undefined>(undefined, { alias: "href" })
  /** @internal */
  readonly key = computed(() => toKey(this.value()))
  /** The tag's link (its own, or its data's), for the template. */
  readonly href: Signal<string | undefined>
  /** @internal */
  readonly row: Element
  /** @internal */
  protected readonly cellProps: Signal<PartProps>

  constructor() {
    const host = injectHost("Tag")
    this.row = inject(ElementRef).nativeElement
    this.href = computed(() => this.hrefInput() ?? host.hrefOf(this.key()))
    this.cellProps = computed(() => host.parts().itemCell())
    injectRegisterItem(
      host.registry(),
      () => ({ key: this.value(), textValue: this.textValue(), disabled: this.disabled() }),
      this.row,
    )
    let naming: { "aria-label"?: string; "aria-labelledby"?: string } = {}
    const { statics } = bindProps(
      () => {
        const k = this.key()
        return joinHandlers(host.parts().item(k, naming), {
          // Hover for mouse and pen only.
          onPointerEnter: (e: PointerEvent) => {
            if (e.pointerType !== "touch") host.hover(k)
          },
          onPointerLeave: () => host.hover(null),
          onPointerDown: () => host.press(k),
          onPointerUp: () => host.press(null),
          onPointerCancel: () => host.press(null),
        })
      },
      { owns: ["disabled", "href", "textvalue", "value"] },
    )
    const label = statics.get("aria-label")
    const labelledBy = statics.get("aria-labelledby")
    naming = {
      ...(label === undefined ? {} : { "aria-label": label }),
      ...(labelledBy === undefined ? {} : { "aria-labelledby": labelledBy }),
    }
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready() || this.hrefInput() === undefined) return
      const k = this.key()
      untracked(() => host.mountLink(k, true))
      onCleanup(() => untracked(() => host.mountLink(k, false)))
    })
  }
}

/** The tag's text: `<span rindTagGroupTagText>`, or `<a rindTagGroupTagText>` on a link tag. */
@Directive({ selector: "[rindTagGroupTagText]", exportAs: "rindTagGroupTagText" })
export class TagGroupTagText {
  constructor() {
    const host = injectHost("TagText")
    const tag = inject(TAG, { optional: true })
    if (!tag) throw new Error("rindTagGroupTagText must be inside rindTagGroupTag")
    const isAnchor = (inject(ElementRef).nativeElement as Element).tagName === "A"
    bindProps(() => {
      const own = host.parts().itemText(tag.key())
      const href = tag.href()
      return isAnchor && href !== undefined ? { ...own, href } : own
    })
  }
}

/**
 * Removes its tag: `<button rindTagGroupTagRemove>` (a cross unless you give it content);
 * hidden while the group is not removable (React renders nothing).
 */
@Component({
  selector: "[rindTagGroupTagRemove]",
  exportAs: "rindTagGroupTagRemove",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content
    ><svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="1em" height="1em">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg></ng-content
  >`,
})
export class TagGroupTagRemove {
  constructor() {
    const host = injectHost("TagRemove")
    const tag = inject(TAG, { optional: true })
    if (!tag && process.env.NODE_ENV !== "production")
      console.warn("[rind-ui] TagGroup: TagRemove is outside a Tag; it renders nothing.")
    bindProps(() => {
      if (!tag || !host.removable()) return absentProps("tag-group", host.instance())
      const own = host.parts().itemRemove(tag.key())
      const press = own["onPointerDown"] as ((e: unknown) => void) | undefined
      return {
        ...own,
        // The press focuses the tag (connect prevents the button's own focus).
        onPointerDown: (e: PointerEvent) => {
          press?.(e)
          if (!e.defaultPrevented || (own["disabled"] as boolean | undefined)) return
          if (tag.row instanceof HTMLElement) tag.row.focus({ preventScroll: true })
        },
      }
    })
  }
}

/** Shown while there is no tag (inside the List); hidden otherwise (React renders nothing). */
@Directive({ selector: "[rindTagGroupEmpty]", exportAs: "rindTagGroupEmpty" })
export class TagGroupEmpty {
  constructor() {
    const host = injectHost("Empty")
    const inList = inject(LIST, { optional: true }) === true
    bindProps(() =>
      host.parts().isEmpty ? host.parts().empty() : absentProps("tag-group", host.instance()),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => {
      if (process.env.NODE_ENV !== "production" && !inList)
        console.warn(
          "[rind-ui] TagGroup: Empty is outside List; render it inside rindTagGroupList.",
        )
    })
  }
}

/** The Tag Group's parts, for a standalone component's `imports`. */
export const TagGroup = [
  TagGroupRoot,
  TagGroupLabel,
  TagGroupDescription,
  TagGroupList,
  TagGroupTag,
  TagGroupTagText,
  TagGroupTagRemove,
  TagGroupEmpty,
] as const
