// JSON Tree View (add-json-tree-view): a Tree View over `jsonTreeCollection`, rebuilt when the
// value or the expansion changes (only expanded containers have children), plus the JSON text
// parts inside each item and copy (Mod+C on the tree, or the CopyTrigger).
import { NgTemplateOutlet } from "@angular/common"
import {
  Component,
  computed,
  contentChild,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  InjectionToken,
  Injector,
  inject,
  input,
  numberAttribute,
  output,
  type Signal,
  signal,
  TemplateRef,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type CollectionKey,
  clipboardCapability,
  clipboardMessages,
  type JsonNode,
  type JsonTreeViewMessages,
  jsonCopyText,
  jsonExpandedKeys,
  jsonItemConnect,
  jsonTreeCollection,
  jsonTreeViewMessages,
  type MessageOverrides,
  type PartProps,
  toKey,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import {
  injectTreeViewItemKey,
  type TreeViewExpandedDetails,
  TreeViewItem,
  TreeViewItemIndicator,
  TreeViewItemText,
  TreeViewRoot,
  TreeViewRowTemplate,
  TreeViewTree,
} from "../tree-view/tree-view"

export type JsonCopyFormat = "json" | "value" | "pointer"
export type JsonCopyState = "idle" | "copying" | "copied" | "error"

const JSON_TREE = new InjectionToken<JsonTreeViewRoot>("rind-ui.json-tree-view")

function injectJson(part: string): JsonTreeViewRoot {
  const root = inject(JSON_TREE, { optional: true })
  if (!root) throw new Error(`rindJsonTreeView${part} must be inside rindJsonTreeViewRoot`)
  return root
}

/** The JSON node of the enclosing `rindTreeViewItem`. */
function injectNode(part: string): { root: JsonTreeViewRoot; node: () => JsonNode | undefined } {
  const root = injectJson(part)
  const key = injectTreeViewItemKey()
  if (!key) throw new Error(`rindJsonTreeView${part} must be inside an item`)
  return { root, node: () => root.node(key()) }
}

/** Custom markup inside the Root: `<ng-template rindJsonTreeViewContent let-api>`. */
@Directive({ selector: "ng-template[rindJsonTreeViewContent]" })
export class JsonTreeViewContentTemplate {
  readonly template = inject(TemplateRef<{ $implicit: JsonTreeViewRoot }>)
}

/** @internal The element injector inside the Tree View root, for the custom template. */
@Directive({ selector: "[rindJsonTreeViewScope]", exportAs: "rindJsonTreeViewScope" })
export class JsonTreeViewScope {
  readonly injector = inject(Injector)
}

const MAX_EXPAND = 5000

/**
 * A JSON value as a tree: `<div rindJsonTreeViewRoot [data]="value" aria-label="Response">`
 * renders the whole tree; an `ng-template rindJsonTreeViewContent` replaces the default markup
 * with Tree View parts and the JSON parts.
 */
@Component({
  selector: "[rindJsonTreeViewRoot]",
  exportAs: "rindJsonTreeViewRoot",
  imports: [
    NgTemplateOutlet,
    TreeViewRoot,
    TreeViewTree,
    TreeViewRowTemplate,
    TreeViewItemIndicator,
    TreeViewItemText,
    forwardRef(() => JsonTreeViewItem),
    forwardRef(() => JsonTreeViewContent),
    JsonTreeViewScope,
  ],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: JSON_TREE, useExisting: forwardRef(() => JsonTreeViewRoot) }],
  template: `<ng-container
    rindTreeViewRoot
    rindJsonTreeViewScope
    #scope="rindJsonTreeViewScope"
    [id]="instance()"
    [collection]="collection()"
    [expandedValue]="expandedKeys()"
    [selectionMode]="selectionMode()"
    (expandedChangeDetails)="setExpanded($event.value, $event.details)"
  >
    @if (custom(); as c) {
      <ng-container
        *ngTemplateOutlet="c.template; context: { $implicit: this }; injector: scope.injector"
      />
    } @else {
      <div rindTreeViewTree [attr.aria-label]="label()" [attr.aria-labelledby]="labelledBy()">
        <ng-template rindTreeViewRow let-node>
          <div rindJsonTreeViewItem [value]="node.key">
            <span rindTreeViewItemIndicator></span>
            <span rindTreeViewItemText><span rindJsonTreeViewContent></span></span>
          </div>
        </ng-template>
      </div>
    }
  </ng-container>`,
})
export class JsonTreeViewRoot {
  /** The value to show. */
  readonly data = input.required<unknown>()
  /** Levels open on the first value; a new `data` keeps the user's expansion. Default 1. */
  readonly defaultExpandedDepth = input(1, { transform: numberAttribute })
  /** More children than this are grouped in ranges. Default 100. */
  readonly groupSize = input<number>()
  /** Keys previewed after a collapsed container. Default 3. */
  readonly maxPreviewItems = input<number>()
  /** What a copy writes: the subtree as JSON (default), a leaf's raw value, or the pointer. */
  readonly copyFormat = input<JsonCopyFormat>("json")
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration = input<number>()
  /** Controlled expansion (`[(expandedValue)]`). */
  readonly expandedValue = input<readonly string[]>()
  readonly defaultExpandedValue = input<readonly string[]>()
  readonly selectionMode = input<"single" | "multiple" | "none">("none")
  readonly messages = input<MessageOverrides<JsonTreeViewMessages>>()
  /** Default: the provider's locale (the copy announcements' language). */
  readonly locale = input<string>()
  readonly id = input<string>()
  readonly label = input<string | undefined>(undefined, { alias: "aria-label" })
  readonly labelledBy = input<string | undefined>(undefined, { alias: "aria-labelledby" })
  readonly expandedValueChange = output<readonly string[]>()
  readonly expandedChangeDetails = output<{
    value: readonly string[]
    details: TreeViewExpandedDetails
  }>()

  /** @internal */
  protected readonly custom = contentChild(JsonTreeViewContentTemplate)
  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly collection: Signal<ReturnType<typeof jsonTreeCollection>>
  /** @internal */
  readonly expandedKeys: Signal<readonly string[]>
  /** @internal */
  readonly expanded: Signal<ReadonlySet<string>>
  /** @internal */
  readonly jsonMessages: Signal<JsonTreeViewMessages>
  /** @internal */
  readonly copyLabel: Signal<string>
  readonly copyState = signal<JsonCopyState>("idle")
  /** @internal */
  readonly copyFrom: (near: Element) => void
  private readonly inner = signal<readonly string[] | null>(null)
  private readonly el: HTMLElement = inject(ElementRef).nativeElement

  constructor() {
    this.instance = injectRootId(() => this.id())
    const env = injectEnvironment(announcerCapability, clipboardCapability)
    const locale = injectLocale(() => this.locale())
    this.jsonMessages = injectMessages("json-tree-view", jsonTreeViewMessages, () =>
      this.messages(),
    )
    const copyMessages = injectMessages("clipboard", clipboardMessages, () => undefined)
    this.copyLabel = computed(() => copyMessages().copy)
    // The first value's expansion only: later values keep the user's by key.
    const initial = computed(() =>
      untracked(
        () =>
          this.defaultExpandedValue() ??
          jsonExpandedKeys(this.data(), this.defaultExpandedDepth(), {
            groupSize: this.groupSize(),
            max: MAX_EXPAND,
          }),
      ),
    )
    this.expandedKeys = computed(() => this.expandedValue() ?? this.inner() ?? initial())
    this.expanded = computed(() => new Set(this.expandedKeys()))
    this.collection = computed(() =>
      jsonTreeCollection(this.data(), { expanded: this.expanded(), groupSize: this.groupSize() }),
    )

    let timer: ReturnType<typeof env.scheduler.setTimeout> | undefined
    inject(DestroyRef).onDestroy(() => {
      if (timer !== undefined) env.scheduler.clearTimeout(timer)
    })
    const settle = (ok: boolean) => {
      this.copyState.set(ok ? "copied" : "error")
      env.announcer.announce({
        message: ok ? copyMessages().copied : copyMessages().copyFailed,
        priority: "polite",
        key: `json-tree-view-${this.instance()}`,
        lang: locale().locale,
      })
      if (timer !== undefined) env.scheduler.clearTimeout(timer)
      timer = env.scheduler.setTimeout(() => {
        timer = undefined
        this.copyState.set("idle")
      }, untracked(this.copyFeedbackDuration) ?? 2000)
    }
    const rootEl = this.el
    /** The focused item, else the highlighted one (the tree's Tab stop). */
    const current = (): JsonNode | undefined => {
      const active = rootEl.ownerDocument.activeElement
      const item =
        (active?.closest('[role="treeitem"][data-key]') as HTMLElement | null) ??
        rootEl.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"][data-key]')
      const key = item?.getAttribute("data-key")
      return key == null ? undefined : this.node(toKey(key))
    }
    const textOf = (n: JsonNode | undefined) => {
      if (!n) throw new Error("[rind-ui] json-tree-view: no item to copy")
      return jsonCopyText(n, untracked(this.copyFormat))
    }
    this.copyFrom = (near) => {
      if (untracked(this.copyState) === "copying") return
      let text: string
      try {
        text = textOf(current())
      } catch {
        settle(false)
        return
      }
      this.copyState.set("copying")
      env.clipboard.writeText(text, { near }).then(
        () => settle(true),
        () => settle(false),
      )
    }
    // Mod+C on the tree: the native copy event's clipboardData (synchronous, no permission).
    const onCopy = (e: Event) => {
      const target = e.target as Element | null
      if (!target?.closest('[role="tree"]')) return
      // A text selection is the user's: the browser copies it.
      const selection = rootEl.ownerDocument.getSelection()
      if (selection && !selection.isCollapsed && rootEl.contains(selection.anchorNode)) return
      e.preventDefault()
      const data = (e as ClipboardEvent).clipboardData
      if (!data) {
        this.copyFrom(target)
        return
      }
      try {
        data.setData("text/plain", textOf(current()))
        settle(true)
      } catch {
        settle(false)
      }
    }
    bindProps(
      () => ({
        "data-scope": "tree-view",
        "data-part": "root",
        "data-instance": this.instance(),
        "data-json-tree-view": "",
        "data-copy-state": this.copyState(),
        onCopy,
      }),
      {
        owns: [
          "aria-label",
          "aria-labelledby",
          "copyfeedbackduration",
          "copyformat",
          "data",
          "defaultexpandeddepth",
          "defaultexpandedvalue",
          "expandedvalue",
          "groupsize",
          "id",
          "locale",
          "maxpreviewitems",
          "messages",
          "selectionmode",
        ],
      },
    )
  }

  /** @internal The JSON node at `key`. */
  node(key: CollectionKey): JsonNode | undefined {
    return this.collection().get(key)?.value as JsonNode | undefined
  }

  /** @internal Tree View's expansion change (or `expandAll`). */
  setExpanded(keys: readonly string[], details: TreeViewExpandedDetails) {
    // The same keys again (a re-sync after a new collection): nothing changed.
    const now = untracked(this.expanded)
    if (keys.length === now.size && keys.every((k) => now.has(k))) return
    this.inner.set(keys)
    this.expandedValueChange.emit(keys)
    this.expandedChangeDetails.emit({ value: keys, details })
  }

  /**
   * Expands every container down to `depth` levels (default: one deeper than the deepest open
   * one), stopping before 5000 rows would be visible.
   */
  expandAll(options?: { readonly depth?: number | undefined }) {
    let deepest = -1
    for (const key of untracked(this.expandedKeys)) {
      const level = untracked(this.collection).get(toKey(key))?.level
      if (level !== undefined && level > deepest) deepest = level
    }
    const keys = jsonExpandedKeys(untracked(this.data), options?.depth ?? deepest + 2, {
      groupSize: untracked(this.groupSize),
      max: MAX_EXPAND,
    })
    this.setExpanded([...new Set([...untracked(this.expandedKeys), ...keys])], { reason: "all" })
  }

  /** Copies the highlighted item in `copyFormat` through the clipboard. */
  copy() {
    this.copyFrom(this.el)
  }
}

/**
 * A Tree View item with the JSON attributes (`data-type`, `data-key`, `data-range`, …):
 * `<div rindJsonTreeViewItem [value]="node.key">`.
 */
@Directive({
  selector: "[rindJsonTreeViewItem]",
  exportAs: "rindJsonTreeViewItem",
  hostDirectives: [{ directive: TreeViewItem, inputs: ["value"] }],
})
export class JsonTreeViewItem {
  constructor() {
    const root = injectJson("Item")
    const item = inject(TreeViewItem)
    bindProps(() => {
      const n = root.node(item.key())
      return n
        ? jsonItemConnect({
            instance: root.instance(),
            node: n,
            messages: root.jsonMessages(),
          }).item()
        : {}
    })
  }
}

type Pick = (api: ReturnType<typeof jsonItemConnect>) => { attrs: PartProps; text: string | null }

/** One JSON text part: its attributes, and its text unless it has content. */
function injectJsonPart(name: string, pick: Pick): Signal<string> {
  const { root, node } = injectNode(name)
  const picked = computed(() => {
    const n = node()
    return n
      ? pick(
          jsonItemConnect({
            instance: root.instance(),
            node: n,
            messages: root.jsonMessages(),
            maxPreviewItems: root.maxPreviewItems(),
          }),
        )
      : undefined
  })
  bindProps(() => picked()?.attrs ?? {})
  return computed(() => picked()?.text ?? "")
}

/** The property name or index (a range: its bounds). */
@Component({
  selector: "[rindJsonTreeViewKey]",
  exportAs: "rindJsonTreeViewKey",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class JsonTreeViewKey {
  protected readonly text = injectJsonPart("Key", (a) => ({ attrs: a.key(), text: a.keyText }))
}

/** `aria-hidden`; ":" (its content replaces it). */
@Component({
  selector: "[rindJsonTreeViewSeparator]",
  exportAs: "rindJsonTreeViewSeparator",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class JsonTreeViewSeparator {
  protected readonly text = injectJsonPart("Separator", (a) => ({
    attrs: a.separator(),
    text: ":",
  }))
}

/** A leaf's value, escaped; strings carry `data-quoted`. */
@Component({
  selector: "[rindJsonTreeViewValue]",
  exportAs: "rindJsonTreeViewValue",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class JsonTreeViewValue {
  protected readonly text = injectJsonPart("Value", (a) => ({
    attrs: a.value(),
    text: a.valueText,
  }))
}

/** `aria-hidden`; a container's glyph summary ("{4}", "[3]"). */
@Component({
  selector: "[rindJsonTreeViewSummary]",
  exportAs: "rindJsonTreeViewSummary",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class JsonTreeViewSummary {
  protected readonly text = injectJsonPart("Summary", (a) => ({
    attrs: a.summary(),
    text: a.summaryGlyph,
  }))
}

/** Visually hidden; the spoken summary ("object, 4 entries"). */
@Component({
  selector: "[rindJsonTreeViewSummaryText]",
  exportAs: "rindJsonTreeViewSummaryText",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class JsonTreeViewSummaryText {
  protected readonly text = injectJsonPart("SummaryText", (a) => ({
    attrs: a.summaryTextPart(),
    text: a.summaryText,
  }))
}

/** `aria-hidden`; a collapsed container's first keys. */
@Component({
  selector: "[rindJsonTreeViewPreview]",
  exportAs: "rindJsonTreeViewPreview",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class JsonTreeViewPreview {
  protected readonly text = injectJsonPart("Preview", (a) => ({
    attrs: a.preview(),
    text: a.previewText,
  }))
}

/** An item's default text: Key, Separator, then Value or Summary, SummaryText and Preview. */
@Component({
  selector: "[rindJsonTreeViewContent]",
  imports: [
    JsonTreeViewKey,
    JsonTreeViewSeparator,
    JsonTreeViewValue,
    JsonTreeViewSummary,
    JsonTreeViewSummaryText,
    JsonTreeViewPreview,
  ],
  encapsulation: ViewEncapsulation.None,
  // A space after the ":" separator: "name: Ada".
  template: `@if (node(); as n) {@if (n.label !== null || n.type === "range") {<span
          rindJsonTreeViewKey
        ></span>@if (n.type !== "range") {<span rindJsonTreeViewSeparator></span>}{{ " " }}}@if (
        container()
      ) {<span rindJsonTreeViewSummary></span><span rindJsonTreeViewSummaryText></span>@if (
          !expanded() && n.count > 0
        ) {<span rindJsonTreeViewPreview></span>}} @else if (n.type !== "range") {<span
          rindJsonTreeViewValue
        ></span>}}`,
  host: { style: "display: contents" },
})
export class JsonTreeViewContent {
  protected readonly node: () => JsonNode | undefined
  protected readonly container: Signal<boolean>
  protected readonly expanded: Signal<boolean>
  constructor() {
    const { root, node } = injectNode("Content")
    this.node = node
    this.container = computed(() => {
      const n = node()
      return n
        ? jsonItemConnect({ instance: "", node: n, messages: root.jsonMessages() }).isContainer
        : false
    })
    this.expanded = computed(() => {
      const n = node()
      return n ? root.expanded().has(n.key) : false
    })
  }
}

/** Copies the highlighted item in `copyFormat`; the result is announced. */
@Component({
  selector: "[rindJsonTreeViewCopyTrigger]",
  exportAs: "rindJsonTreeViewCopyTrigger",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ label() }}</ng-content>",
})
export class JsonTreeViewCopyTrigger {
  protected readonly label: Signal<string>
  constructor() {
    const root = injectJson("CopyTrigger")
    this.label = root.copyLabel
    bindProps(() => ({
      type: "button",
      "data-scope": "json-tree-view",
      "data-part": "copy-trigger",
      "data-instance": root.instance(),
      "data-copy-state": root.copyState(),
      onClick: (e: MouseEvent) => root.copyFrom(e.currentTarget as Element),
    }))
  }
}

/** The JSON Tree View's parts, for a standalone component's `imports`. */
export const JsonTreeView = [
  JsonTreeViewRoot,
  JsonTreeViewContentTemplate,
  JsonTreeViewItem,
  JsonTreeViewKey,
  JsonTreeViewSeparator,
  JsonTreeViewValue,
  JsonTreeViewSummary,
  JsonTreeViewSummaryText,
  JsonTreeViewPreview,
  JsonTreeViewCopyTrigger,
] as const
