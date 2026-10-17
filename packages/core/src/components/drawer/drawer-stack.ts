// The document's open drawers (design §3): sizes, swiping, and the swipe progress mirrored
// to the backdrop, the indent parts and ancestor drawers as a CSS variable — never through
// machines. Drawers are known only while open (base-ui#5915); nesting comes from the layer
// stack's parentage, so a dialog between two drawers does not break the chain and is never
// counted (base-ui#4492).

import { getLayerStack, type LayerId } from "../../dom/layer-stack"
import type { DomEnv } from "../../env/capabilities"

export interface NestedMetrics {
  readonly count: number
  readonly frontmostSize: number
  readonly swiping: boolean
}

export interface DrawerEntry {
  readonly modal: boolean
  /** Border-box size on the drawer's axis. */
  readonly size: () => number
  readonly swiping: () => boolean
  readonly backdrop?: () => HTMLElement | null
  readonly onNested: (metrics: NestedMetrics) => void
}

export interface DrawerStack {
  register(id: LayerId, entry: DrawerEntry): () => void
  /** A drawer's swipe progress (0 at rest): mirrored, never sent to a machine. */
  progress(id: LayerId, value: number): void
  /** Indent parts: written after mount (hydration-safe); returns the cleanup. */
  registerIndent(el: HTMLElement): () => void
  /** A drawer's size changed: its ancestors' metrics are recomputed. */
  refresh(): void
  /** Any modal drawer open (the indent's `data-active`). */
  active(): boolean
  subscribe(listener: () => void): () => void
}

// Versioned: two copies of rind-ui on a page share one registry only when compatible.
const KEY = Symbol.for("rind-ui.drawer-stack@1")
const PROGRESS = "--rind-drawer-swipe-progress"

function create(doc: Document): DrawerStack {
  // Insertion order is opening order: the last is the frontmost.
  const open = new Map<LayerId, DrawerEntry & { progress: number }>()
  const indents = new Set<HTMLElement>()
  const listeners = new Set<() => void>()
  const last = new Map<LayerId, string>()

  /** The drawers whose layer descends from `id` (through any layer kind in between). */
  const descendants = (id: LayerId) => {
    const layers = getLayerStack(doc)
    const out: LayerId[] = []
    for (const other of open.keys()) {
      if (other === id) continue
      for (let p = layers.get(other)?.parentId; p !== undefined; p = layers.get(p)?.parentId) {
        if (p === id) {
          out.push(other)
          break
        }
      }
    }
    return out
  }

  const notify = () => {
    for (const [id, entry] of open) {
      const kids = descendants(id)
      const front = kids.at(-1)
      const frontEntry = front === undefined ? undefined : open.get(front)
      const metrics: NestedMetrics = {
        count: kids.length,
        frontmostSize: frontEntry ? Math.round(frontEntry.size()) : 0,
        swiping: frontEntry?.swiping() ?? false,
      }
      const key = JSON.stringify(metrics)
      if (last.get(id) === key) continue
      last.set(id, key)
      entry.onNested(metrics)
    }
    for (const l of listeners) l()
  }

  const mirror = () => {
    const front = [...open.values()].at(-1)
    const value = String(front?.progress ?? 0)
    for (const el of indents) el.style.setProperty(PROGRESS, value)
  }

  return {
    register(id, entry) {
      open.set(id, { ...entry, progress: 0 })
      notify()
      mirror()
      return () => {
        entry.backdrop?.()?.style.removeProperty(PROGRESS)
        open.delete(id)
        last.delete(id)
        notify()
        mirror()
      }
    },
    progress(id, value) {
      const entry = open.get(id)
      if (!entry) return
      const was = entry.progress
      entry.progress = value
      entry.backdrop?.()?.style.setProperty(PROGRESS, String(value))
      mirror()
      // Starting or ending a swipe changes the parents' `data-nested-swiping`.
      if ((was === 0) !== (value === 0)) notify()
    },
    registerIndent(el) {
      indents.add(el)
      mirror()
      return () => {
        indents.delete(el)
        el.style.removeProperty(PROGRESS)
      }
    },
    refresh: notify,
    active: () => [...open.values()].some((e) => e.modal),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** The drawer registry of the environment's document (one per document, any rind-ui copy). */
export function drawerStack(env: DomEnv): DrawerStack {
  const node = env.dom.getRootNode()
  const doc = "body" in node ? node : node.ownerDocument
  const existing: unknown = Reflect.get(doc, KEY)
  // Sound: only this module writes the key.
  if (existing) return existing as DrawerStack
  const stack = create(doc)
  Reflect.set(doc, KEY, stack)
  return stack
}
