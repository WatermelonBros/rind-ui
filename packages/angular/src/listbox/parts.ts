// The listbox parts as directives, bound to a host through LISTBOX_HOST (design §2): Listbox's
// own Root, and later Select's and Combobox's popups. Wiring only: every attribute is the core
// parts'.
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
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  type Collection,
  type CollectionKey,
  type ItemRegistry,
  type ListboxParts,
  type SectionNode,
  toKey,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { injectRegisterItem } from "../collection-items"
import { RindProps } from "../rind-props"

declare const process: { env: { NODE_ENV?: string } }

/** What a host gives its listbox parts (read in renders, they stay reactive). */
export interface ListboxHost {
  /** The component name in errors and warnings ("Listbox", "Select"). */
  readonly name: string
  readonly parts: () => ListboxParts
  readonly collection: () => Collection<unknown>
  /** Static items register here (null: data or a given collection). */
  readonly registry: () => ItemRegistry | null
  readonly mount: (part: "label" | "empty", on: boolean) => void
  readonly mountDescription: (key: CollectionKey, on: boolean) => void
  /** The sentinel came into view (deduplicated per collection by the host). */
  readonly requestLoadMore: () => void
  /**
   * The host lists a subset of the registered items (Combobox filtering): the others stay
   * rendered, hidden and without a role, so they keep their registration and order.
   */
  readonly listed?: ((key: CollectionKey) => boolean) | undefined
  /** `data-instance`, for the parts React renders nothing for. */
  readonly instance: () => string
}

/** The host the listbox parts below read; Listbox's Root (and Select's, Combobox's) provide it. */
export const LISTBOX_HOST = new InjectionToken<ListboxHost>("rind-ui.listbox-host")
const SECTION = new InjectionToken<ListboxSection>("rind-ui.listbox-section")
const ITEM = new InjectionToken<ListboxItem>("rind-ui.listbox-item")

const INTERACTIVE =
  "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true']"

function injectHost(part: string): ListboxHost {
  const host = inject(LISTBOX_HOST, { optional: true })
  if (!host) throw new Error(`rindListbox${part} must be inside its Root`)
  return host
}
function injectItemKey(part: string): () => CollectionKey {
  const item = inject(ITEM, { optional: true })
  if (!item) throw new Error(`rindListbox${part} must be inside an Item`)
  return item.key
}

/** The list's visible name (a `<span>`). */
@Directive({
  selector: "[rindListboxLabel], [rindComboboxLabel], [rindTagsInputLabel]",
  exportAs: "rindListboxLabel",
})
export class ListboxLabel {
  constructor() {
    const host = injectHost("Label")
    bindProps(() => host.parts().label())
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => host.mount("label", true))
    inject(DestroyRef).onDestroy(() => host.mount("label", false))
  }
}

/** The `listbox`: `<div rindListboxList>`, named by the Label or `aria-label`. */
@Directive({
  selector: "[rindListboxList], [rindComboboxList], [rindTagsInputList]",
  exportAs: "rindListboxList",
})
export class ListboxList {
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
    if (inject(PLATFORM_ID) !== "browser" || process.env.NODE_ENV === "production") return
    // Development: a list needs a name (mui/base-ui#5569). Checked after the render a Label's
    // mount causes, not on the first one.
    afterNextRender(() =>
      queueMicrotask(() => {
        if (!el.isConnected) return
        if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) {
          console.warn(
            `[rind-ui] ${host.name}: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.`,
          )
        }
      }),
    )
  }
}

/** An option: `<div rindListboxItem value="apple">`. */
@Directive({
  selector: "[rindListboxItem], [rindSelectItem], [rindComboboxItem], [rindTagsInputItem]",
  exportAs: "rindListboxItem",
  providers: [{ provide: ITEM, useExisting: forwardRef(() => ListboxItem) }],
})
export class ListboxItem {
  /** The item key. */
  readonly value = input.required<string>()
  /** Used by typeahead, filtering, announcements and form labels (default: the text content). */
  readonly textValue = input<string>()
  /** Disables this option: it cannot be selected. */
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** Extra filter terms (synonyms); never typeahead, announcements or labels. */
  readonly keywords = input<readonly string[]>()
  /** @internal */
  readonly key = computed(() => toKey(this.value()))
  /** Whether the option is selected (`data-state`), for the template. */
  readonly selected: Signal<boolean>

  constructor() {
    const host = injectHost("Item")
    const section = inject(SECTION, { optional: true })
    const el: Element = inject(ElementRef).nativeElement
    injectRegisterItem(
      host.registry(),
      () => ({
        key: this.value(),
        textValue: this.textValue(),
        disabled: this.disabled(),
        keywords: this.keywords(),
        section: section ? section.section() : undefined,
      }),
      el,
    )
    this.selected = computed(() => host.parts().item(this.key())["aria-selected"] === "true")
    bindProps(
      () => {
        const own = host.parts().item(this.key())
        // Not listed by the host (filtered out): rendered, hidden, no role.
        if (host.listed && !host.listed(this.key()))
          return { hidden: true, "data-scope": own["data-scope"], "data-part": "item" }
        return own
      },
      { owns: ["disabled", "keywords", "textvalue", "value"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => {
      ready.set(true)
      // Development: no interactive element inside an option.
      if (process.env.NODE_ENV === "production") return
      const nested = el.querySelector(INTERACTIVE)
      if (nested) {
        console.warn(
          `[rind-ui] ${host.name}: the item "${untracked(this.value)}" contains an interactive <${nested.tagName.toLowerCase()}>; options cannot hold controls.`,
        )
      }
    })
    // Virtualized: the highlighted item renders after the scroll. Focus left on the list, or
    // dropped to the body when the previous item went, moves to it while the list is focused.
    effect(() => {
      if (!ready()) return
      const highlighted = host.parts().item(this.key())["data-highlighted"] !== undefined
      const listFocused = host.parts().list()["data-focus"] !== undefined
      if (!highlighted || !listFocused || !(el instanceof HTMLElement)) return
      const doc = el.ownerDocument
      const active = doc.activeElement
      const onList = active?.getAttribute("role") === "listbox" && active.contains(el)
      const dropped = active === doc.body || active === null
      if (onList || dropped) el.focus({ preventScroll: true })
    })
  }
}

@Directive({
  selector:
    "[rindListboxItemText], [rindSelectItemText], [rindComboboxItemText], [rindTagsInputItemText]",
  exportAs: "rindListboxItemText",
})
export class ListboxItemText {
  constructor() {
    const host = injectHost("ItemText")
    bindProps(() => host.parts().itemText())
  }
}

/** The option's description (its `aria-describedby`). */
@Directive({
  selector:
    "[rindListboxItemDescription], [rindSelectItemDescription], [rindComboboxItemDescription]",
  exportAs: "rindListboxItemDescription",
})
export class ListboxItemDescription {
  constructor() {
    const host = injectHost("ItemDescription")
    const key = injectItemKey("ItemDescription")
    bindProps(() => host.parts().itemDescription(key()))
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready()) return
      const now = key()
      untracked(() => host.mountDescription(now, true))
      onCleanup(() => untracked(() => host.mountDescription(now, false)))
    })
  }
}

/** Shown while its option is selected (`keepMounted`: always, hidden by CSS on `data-state`). */
@Directive({
  selector: "[rindListboxItemIndicator], [rindSelectItemIndicator], [rindComboboxItemIndicator]",
  exportAs: "rindListboxItemIndicator",
})
export class ListboxItemIndicator {
  /** Rendered while not selected too (hidden by CSS on `data-state`). */
  readonly keepMounted = input(false, { transform: booleanAttribute })
  constructor() {
    const host = injectHost("ItemIndicator")
    const key = injectItemKey("ItemIndicator")
    bindProps(
      () => {
        const own = host.parts().itemIndicator(key())
        return !this.keepMounted() && own["data-state"] !== "selected"
          ? absentProps(String(own["data-scope"]), host.instance())
          : own
      },
      { owns: ["keepmounted"] },
    )
  }
}

/**
 * A group of options: `<div rindListboxSection [section]="{ key, label }">`; its label (the
 * content of a `[rindListboxSectionLabel]` element inside, else the label text) heads it.
 */
@Component({
  selector:
    "[rindListboxSection], [rindSelectSection], [rindComboboxSection], [rindTagsInputSection]",
  exportAs: "rindListboxSection",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: SECTION, useExisting: forwardRef(() => ListboxSection) }],
  template: `<span [rindProps]="labelProps()"
      ><ng-content select="[rindListboxSectionLabel]">{{ section().label }}</ng-content></span
    ><ng-content />`,
})
export class ListboxSection {
  /** The section's key and label; the label names it and is the default heading. */
  readonly section = input.required<{ readonly key: string; readonly label: string }>()
  /** @internal */
  protected readonly labelProps: Signal<ReturnType<ListboxParts["sectionLabel"]>>

  constructor() {
    const host = injectHost("Section")
    const node = computed(
      (): SectionNode => ({
        type: "section",
        key: toKey(this.section().key),
        label: this.section().label,
      }),
    )
    this.labelProps = computed(() => host.parts().sectionLabel(node()))
    bindProps(
      () => {
        const n = node()
        // A section the host does not list (all its items filtered out): hidden, still rendered.
        if (
          host.listed &&
          !host
            .collection()
            .sections()
            .some((x) => x.key === n.key)
        )
          return { hidden: true }
        return host.parts().section(n)
      },
      { owns: ["section"] },
    )
  }
}

/** A decorative divider between options; it takes no name. */
@Directive({
  selector:
    "[rindListboxSeparator], [rindSelectSeparator], [rindComboboxSeparator], [rindTagsInputSeparator]",
  exportAs: "rindListboxSeparator",
})
export class ListboxSeparator {
  constructor() {
    const host = injectHost("Separator")
    bindProps(() => host.parts().separator(), { owns: ["aria-label", "aria-labelledby"] })
  }
}

/** Shown while there is no option; render it after the List. */
@Directive({
  selector: "[rindListboxEmpty], [rindSelectEmpty], [rindComboboxEmpty], [rindTagsInputEmpty]",
  exportAs: "rindListboxEmpty",
})
export class ListboxEmpty {
  constructor() {
    const host = injectHost("Empty")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() =>
      host.parts().isEmpty
        ? host.parts().empty()
        : absentProps(String(host.parts().label()["data-scope"]), host.instance()),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => {
      ready.set(true)
      // Development: the empty part is a sibling of the list, never inside it.
      if (process.env.NODE_ENV !== "production" && el.closest('[role="listbox"]')) {
        console.warn(`[rind-ui] ${host.name}: Empty is inside the list; render it after List.`)
      }
    })
    // The flag, not the parts: mounting changes the parts.
    const isEmpty = computed(() => host.parts().isEmpty)
    effect((onCleanup) => {
      if (!ready() || !isEmpty()) return
      untracked(() => host.mount("empty", true))
      onCleanup(() => untracked(() => host.mount("empty", false)))
    })
  }
}

/** The sentinel of an infinite list: in view, it asks for more. */
@Directive({
  selector: "[rindListboxLoadMore], [rindSelectLoadMore], [rindComboboxLoadMore]",
  exportAs: "rindListboxLoadMore",
})
export class ListboxLoadMore {
  constructor() {
    const host = injectHost("LoadMore")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() => host.parts().loadMore())
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      if (typeof IntersectionObserver === "undefined") return
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) host.requestLoadMore()
      })
      observer.observe(el)
      destroy.onDestroy(() => observer.disconnect())
    })
  }
}

/** One run of the data items: a section (or none) and its items, in render order. */
export interface ListboxGroup {
  readonly section: { readonly key: string; readonly label: string } | null
  readonly items: readonly {
    readonly key: string
    readonly label: string
    readonly disabled: boolean
  }[]
}

/** Data mode: the collection's sections and items, grouped for a template's `@for`. */
export function groupsOf(c: Collection<unknown>): readonly ListboxGroup[] {
  const groups: { section: ListboxGroup["section"]; items: ListboxGroup["items"][number][] }[] = []
  for (const node of c) {
    if (node.type === "section") {
      groups.push({ section: { key: node.key, label: node.label }, items: [] })
      continue
    }
    const item = { key: node.key, label: node.textValue, disabled: node.disabled === true }
    const last = groups.at(-1)
    if (last && (last.section?.key ?? null) === node.parentKey) last.items.push(item)
    else groups.push({ section: null, items: [item] })
  }
  return groups
}
