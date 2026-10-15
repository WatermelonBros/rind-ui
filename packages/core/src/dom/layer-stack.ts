// One ordered record of the open overlay layers per document, with explicit parentage: the
// single source of "topmost", "topmost modal", "nested" and "inside" for dismiss, focus
// containment, outside hiding and scroll lock. Stored on the document under a versioned
// global key, so two copies of @rind-ui/core in one page share it (radix#1088, radix#2961,
// react-spectrum#8784 came from per-copy module state).

import { registerReset } from "./resets"

declare const process: { env: { NODE_ENV?: string } }

/** A layer's identity; ids from the adapter (one per component instance). */
export type LayerId = string & { readonly __brand: "LayerId" }
/** Brands an id (stable per component instance) as a layer id. */
export const layerId = (id: string): LayerId => id as LayerId

export type LayerKind =
  | "dialog"
  | "alertdialog"
  | "drawer"
  | "popover"
  | "menu"
  | "listbox"
  | "tooltip"

export interface LayerOptions {
  readonly id: LayerId
  readonly kind: LayerKind
  /** Layers of one family count as nested in each other (Dialog and Alert Dialog: "dialog"). */
  readonly family?: string | undefined
  readonly modal: boolean
  /** The parent layer, from the adapter's layer context. */
  readonly parent?: LayerId | undefined
  /** The opening element: a parent by DOM containment when none is declared. */
  readonly opener?: (() => Element | null) | undefined
  /** Content, backdrop, positioner and, optionally, the trigger: all inside the layer. */
  readonly elements: () => readonly Element[]
  /** Elements whose presses count as outside although they belong to the layer (backdrop). */
  readonly surfaces?: (() => readonly Element[]) | undefined
  /** The parent is being released: the owner closes with reason `parent-dismissed`. */
  readonly onParentDismissed?: (() => void) | undefined
}

export interface LayerMeta {
  /** Position among the open layers, bottom first. */
  readonly index: number
  /** Ancestor layers by parentage. */
  readonly depth: number
  /** Inside an open layer of the same family. */
  readonly nested: boolean
  /** Has open descendants of the same family. */
  readonly hasNested: boolean
  readonly nestedCount: number
}

export interface LayerHandle {
  readonly id: LayerId
  /** The parent layer (declared, or by the opener's containment), if any. */
  readonly parentId: LayerId | undefined
  isTopmost(): boolean
  /** In this layer's elements or in a descendant layer's. */
  contains(target: EventTarget | null): boolean
  meta(): LayerMeta
  /** Close: dismiss descendants (`parent-dismissed`), leave the open set, become exiting. */
  release(): void
  /** Presence finished: forget the exiting entry. */
  dispose(): void
}

export interface LayerStack {
  /** Idempotent per id. */
  push(options: LayerOptions): LayerHandle
  topmost(): LayerHandle | undefined
  topmostModal(): LayerHandle | undefined
  /** Open layers, bottom first. */
  layers(): readonly LayerHandle[]
  /** Released layers still animating out (until `dispose()`). */
  exiting(): readonly LayerHandle[]
  /** The open layer with this id. */
  get(id: LayerId): LayerHandle | undefined
  /** A point over an exiting layer's elements (inert content is not hit-tested). */
  isExitingAt(x: number, y: number): boolean
  /**
   * `element` contains `target`, or `target` is in a layer whose opener, or whose ancestor
   * layers' openers or elements, are inside `element` (a portalled popup of a Field's control).
   */
  isLogicallyInside(target: EventTarget | null, element: Element): boolean
  /** The open layer `target` is in (the deepest one), if any. */
  layerOf(target: EventTarget | null): LayerHandle | undefined
  /** The options a layer was registered with (dismiss and focus modules read them). */
  options(id: LayerId): LayerOptions | undefined
  subscribe(listener: () => void): () => void
  /** Tells subscribers a layer's elements changed (its content mounted after it opened). */
  refresh(): void
}

const VERSION = 1
const KEY = Symbol.for(`rind-ui.layer-stack@${VERSION}`)

interface Entry {
  options: LayerOptions
  state: "open" | "exiting"
  readonly parent: Entry | undefined
  readonly handle: LayerHandle
}

const isNode = (t: EventTarget | null): t is Node => t !== null && "nodeType" in t

function createStack(): LayerStack {
  let entries: Entry[] = []
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const l of [...listeners]) l()
  }
  const open = () => entries.filter((e) => e.state === "open")
  const family = (e: Entry) => e.options.family ?? e.options.kind
  const ancestors = (e: Entry) => {
    const out: Entry[] = []
    for (let p = e.parent; p; p = p.parent) out.push(p)
    return out
  }
  const descendants = (e: Entry) => open().filter((d) => ancestors(d).includes(e))
  const ownContains = (e: Entry, target: Node) =>
    e.options.elements().some((el) => el === target || el.contains(target))
  const contains = (e: Entry, target: EventTarget | null) =>
    isNode(target) && [e, ...descendants(e)].some((x) => ownContains(x, target))
  /** The deepest open layer whose own elements hold `target`. */
  const entryOf = (target: EventTarget | null) => {
    if (!isNode(target)) return undefined
    const holding = open().filter((e) => ownContains(e, target))
    return holding.sort((a, b) => ancestors(b).length - ancestors(a).length)[0]
  }

  const stack: LayerStack = {
    push(options) {
      const existing = entries.find((e) => e.options.id === options.id)
      if (existing?.state === "open") {
        existing.options = options
        return existing.handle
      }
      // A re-registration (Strict Mode, reopen during exit) replaces the exiting entry.
      if (existing) entries = entries.filter((e) => e !== existing)
      const declared = options.parent
        ? open().find((e) => e.options.id === options.parent)
        : undefined
      const parent = declared ?? (options.opener ? entryOf(options.opener()) : undefined)
      const entry: Entry = {
        options,
        state: "open",
        parent,
        handle: {
          id: options.id,
          parentId: parent?.options.id,
          isTopmost: () => entry.state === "open" && open().at(-1) === entry,
          contains: (target) => contains(entry, target),
          meta: () => {
            const kin = descendants(entry).filter((d) => family(d) === family(entry))
            return {
              index: open().indexOf(entry),
              depth: ancestors(entry).length,
              nested: ancestors(entry).some(
                (a) => a.state === "open" && family(a) === family(entry),
              ),
              hasNested: kin.length > 0,
              nestedCount: kin.length,
            }
          },
          release: () => {
            if (entry.state !== "open") return
            // Children first, topmost first, so each closes before its parent.
            for (const child of descendants(entry).reverse()) {
              child.options.onParentDismissed?.()
              // The owner closes by itself; a child that did not is released anyway.
              child.handle.release()
            }
            entry.state = "exiting"
            notify()
          },
          dispose: () => {
            if (!entries.includes(entry)) return
            entries = entries.filter((e) => e !== entry)
            notify()
          },
        },
      }
      entries.push(entry)
      notify()
      return entry.handle
    },
    topmost: () => open().at(-1)?.handle,
    topmostModal: () => open().findLast((e) => e.options.modal)?.handle,
    layers: () => open().map((e) => e.handle),
    exiting: () => entries.filter((e) => e.state === "exiting").map((e) => e.handle),
    get: (id) => open().find((e) => e.options.id === id)?.handle,
    isExitingAt(x, y) {
      return entries.some(
        (e) =>
          e.state === "exiting" &&
          e.options.elements().some((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
          }),
      )
    },
    isLogicallyInside(target, element) {
      if (!isNode(target)) return false
      if (element.contains(target)) return true
      const layer = entryOf(target)
      if (!layer) return false
      return [layer, ...ancestors(layer)].some((e) => {
        const opener = e.options.opener?.() ?? null
        if (opener && element.contains(opener)) return true
        return e !== layer && e.options.elements().some((el) => element.contains(el))
      })
    },
    layerOf: (target) => entryOf(target)?.handle,
    options: (id) => entries.find((e) => e.options.id === id)?.options,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    refresh: notify,
  }
  return stack
}

// Tests share one document: every test starts with an empty stack.
registerReset(() => {
  if (typeof document !== "undefined") Reflect.deleteProperty(document, KEY)
})

interface Stored {
  readonly version: number
  readonly stack: LayerStack
}
/** Stacks for documents whose stored stack has another shape (an incompatible copy). */
const fallback = new WeakMap<Document, LayerStack>()

/** The document's layer stack, shared by every copy of @rind-ui/core in the page. */
export function getLayerStack(doc: Document): LayerStack {
  const stored = Reflect.get(doc, KEY) as Stored | undefined
  if (!stored) {
    const stack = createStack()
    Reflect.set(doc, KEY, { version: VERSION, stack } satisfies Stored)
    return stack
  }
  if (stored.version === VERSION && typeof stored.stack?.push === "function") return stored.stack
  let own = fallback.get(doc)
  if (!own) {
    // Once per document, when the separate stack is created.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[rind-ui] another copy of @rind-ui/core stored an incompatible layer stack on this document; layers of the two copies will not see each other",
      )
    }
    own = createStack()
    fallback.set(doc, own)
  }
  return own
}
