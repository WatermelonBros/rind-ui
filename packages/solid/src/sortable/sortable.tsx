/** @jsxImportSource solid-js */
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
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    sortable: SortableMessages
  }
}

/** What every part's `render` receives. */
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

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: SortableRenderState
  readonly send: ReturnType<typeof useMachine<typeof sortableMachine>>["send"]
  readonly items: Accessor<readonly string[]>
  readonly orientation: Accessor<SortableOrientation>
  readonly handleDrags: Accessor<boolean>
  readonly register: (key: string, label: string | undefined, disabled: boolean) => void
  readonly startDrag: (key: string, e: PointerEvent) => void
  readonly isMovable: (key: string) => boolean
}
const SortableContext = createContext<Ctx>()
function useSortable(part: string): Ctx {
  const ctx = useContext(SortableContext)
  if (!ctx) throw new Error(`Sortable.${part} must be inside Sortable.Root`)
  return ctx
}
const ItemContext = createContext<Accessor<string>>()
function useItemKey(part: string): Accessor<string> {
  const key = useContext(ItemContext)
  if (!key) throw new Error(`Sortable.${part} must be inside Sortable.Item`)
  return key
}

type Own<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<SortableRenderState> | undefined
  readonly children?: JSX.Element | ((state: SortableRenderState) => JSX.Element)
}

export type SortableRootProps = Own<Omit<JSX.HTMLAttributes<HTMLUListElement>, "onReorder">> & {
  /** The keys in their current order (controlled: reorder your data in `onReorder`). */
  readonly items: readonly string[]
  readonly onReorder?:
    | ((keys: readonly string[], details: SortableReorderDetails) => void)
    | undefined
  readonly orientation?: SortableOrientation | undefined
  /** Pointer drags start from the Handle (default), or anywhere on the item. */
  readonly handle?: boolean | undefined
  readonly messages?: MessageOverrides<SortableMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}

function Root(props: SortableRootProps) {
  const [own, rest] = splitProps(props, [
    "items",
    "onReorder",
    "orientation",
    "handle",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(() => rest.id)
  const locale = useLocale(() => own.locale)
  const messages = useMessages("sortable", sortableMessages, () => own.messages)
  const [rootEl, setRootEl] = createSignal<HTMLElement | null>(null)
  const [labels, setLabels] = createSignal<ReadonlyMap<string, string>>(new Map())
  const [disabledKeys, setDisabledKeys] = createSignal<ReadonlySet<string>>(new Set())
  const [drag, setDrag] = createSignal<Drag>(null)
  const orientation = () => own.orientation ?? "vertical"
  const { view, send } = useMachine(
    sortableMachine,
    () => ({
      id: instance(),
      items: own.items,
      onReorder: own.onReorder,
      disabledKeys: disabledKeys(),
      labels: labels(),
      messages: messages(),
      lang: locale().locale,
    }),
    env,
  )
  const active = () => view().context.active
  const register = (key: string, label: string | undefined, disabled: boolean) => {
    setLabels((m) => {
      if (m.get(key) === label || label === undefined) return m
      return new Map(m).set(key, label)
    })
    setDisabledKeys((s) => {
      if (s.has(key) === disabled) return s
      const next = new Set(s)
      if (disabled) next.add(key)
      else next.delete(key)
      return next
    })
  }
  const startDrag = (key: string, e: PointerEvent) => {
    const root = untrack(rootEl)
    if (!root || (e.pointerType === "mouse" && e.button !== 0)) return
    const keys = untrack(() => own.items)
    const els = keys
      .map((k) =>
        root.querySelector<HTMLElement>(
          `[data-scope="sortable"][data-part="item"][data-instance="${CSS.escape(untrack(instance))}"][data-value="${CSS.escape(k)}"]`,
        ),
      )
      .filter((el): el is HTMLElement => el !== null)
    const index = keys.indexOf(key)
    if (index < 0) return
    // the room the picked item leaves: its size along the axis plus the list's gap (layout
    // pixels: the same the others' transforms are written in)
    const horizontal = orientation() === "horizontal"
    const picked = els[index]
    const cs = getComputedStyle(root)
    const gap = Number.parseFloat(horizontal ? cs.columnGap : cs.rowGap) || 0
    const room = picked ? (horizontal ? picked.offsetWidth : picked.offsetHeight) + gap : 0
    sortableDrag(e, {
      items: els,
      index,
      axis: horizontal ? "x" : "y",
      root,
      onStart: () => send({ type: "DRAG.START", key }),
      onMove: (delta, target, indicator) => {
        setDrag({ delta, indicator, target, room })
        send({ type: "DRAG.OVER", index: target })
      },
      onEnd: (drop) => {
        setDrag(null)
        send(drop ? { type: "DRAG.END" } : { type: "CANCEL" })
      },
    })
  }
  const dragging = () => view().state === "dragging"
  const api = createMemo(() =>
    sortableConnect({
      instance: instance(),
      state: view().state as "idle" | "moving" | "dragging",
      items: own.items,
      orientation: orientation(),
      active: active(),
      disabled: (k: string) => disabledKeys().has(k),
      label: (k: string) => labels().get(k) ?? k,
      drag: dragging() ? drag() : null,
      ids: { instructions: partId("sortable", instance(), "instructions") },
      messages: messages(),
    }),
  )
  const state = reactive<SortableRenderState>(() => ({
    orientation: orientation(),
    active: active(),
    dragging: dragging(),
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        ref: setRootEl,
        ...(rest.id === undefined ? {} : { id: rest.id }),
      },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <SortableContext.Provider
      value={{
        api,
        state,
        send,
        items: () => own.items,
        orientation,
        handleDrags: () => own.handle ?? true,
        register,
        startDrag,
        isMovable: (k) => !disabledKeys().has(k),
      }}
    >
      {renderPart(own.render, merged, state, children, (p) => (
        <ul {...p}>{children()}</ul>
      ))}
      <span {...normalizeProps(api().instructions())}>{api().instructionsText}</span>
    </SortableContext.Provider>
  )
}

export type SortableItemProps = Own<JSX.LiHTMLAttributes<HTMLLIElement>> & {
  /** The item's key (one of the Root's `items`). */
  readonly value: string
  /** The spoken label (default: the item's text). */
  readonly label?: string | undefined
  /** Cannot be moved; other items can pass it. */
  readonly disabled?: boolean | undefined
}

function Item(props: SortableItemProps) {
  const [local, rest] = splitProps(props, ["render", "value", "label", "disabled", "children"])
  const ctx = useSortable("Item")
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  const disabled = () => local.disabled === true
  // The label: the prop, else the item's text (read after the commit, as it can change).
  afterMount(() => {
    createEffect(() => {
      const node = el()
      const value = local.value
      const label = local.label
      const isDisabled = disabled()
      if (!node) return
      const read = () =>
        ctx.register(value, label ?? node.textContent?.replace(/\s+/g, " ").trim(), isDisabled)
      read()
      if (label !== undefined) return
      const observer = new MutationObserver(read)
      observer.observe(node, { childList: true, characterData: true, subtree: true })
      onCleanup(() => observer.disconnect())
    })
  })
  const merged = createMemo(() => {
    const own = normalizeProps(ctx.api().item(local.value))
    return mergeProps(
      ctx.handleDrags()
        ? own
        : joinHandlers(own, {
            onPointerDown: (e: PointerEvent) => {
              if (!disabled()) ctx.startDrag(local.value, e)
            },
          }),
      rest,
      { ref: setEl },
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <ItemContext.Provider value={() => local.value}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <li {...p}>{children()}</li>
      ))}
    </ItemContext.Provider>
  )
}

const NEXT = { vertical: "ArrowDown", horizontal: "ArrowRight" } as const
const PREV = { vertical: "ArrowUp", horizontal: "ArrowLeft" } as const

export type SortableButtonProps = Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

function Handle(props: SortableButtonProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSortable("Handle")
  const key = useItemKey("Handle")
  const env = useEnvironment()
  const [el, setEl] = createSignal<HTMLButtonElement | null>(null)
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const picked = createMemo(() => ctx.state.active === key() && !ctx.state.dragging)
  // The item moves in the DOM as the order changes: keep focus on its handle.
  afterMount(() => {
    createEffect(() => {
      ctx.items()
      const node = el()
      if (picked() && node && node.ownerDocument.activeElement !== node) {
        node.focus({ preventScroll: false })
      }
    })
  })
  // A press elsewhere drops the keyboard session; the listener lives only while picked up.
  afterMount(() => {
    createEffect(() => {
      if (!picked()) return
      const doc = untrack(el)?.ownerDocument
      const onDown = (e: PointerEvent) => {
        if (!el()?.contains(e.target as Node)) ctx.send({ type: "DROP" })
      }
      doc?.addEventListener("pointerdown", onDown, true)
      onCleanup(() => doc?.removeEventListener("pointerdown", onDown, true))
    })
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(ctx.api().handle(key(), { focused: focused(), modality: modality() })),
          {
            onFocusIn: () => setFocused(true),
            onFocusOut: (e: FocusEvent) => {
              setFocused(false)
              // Moving focus elsewhere drops where it is (the order has already changed live). A
              // blur with no next target is the item moving in the DOM: its handle is refocused.
              if (picked() && e.relatedTarget !== null) ctx.send({ type: "DROP" })
            },
            onKeyDown: (e: KeyboardEvent) => {
              const orientation = ctx.orientation()
              const next = e.key === NEXT[orientation]
              const prev = e.key === PREV[orientation]
              if (!picked()) {
                if ((next || prev) && e.altKey) {
                  e.preventDefault()
                  ctx.send({ type: "QUICK", key: key(), by: next ? 1 : -1 })
                } else if (e.key === " " || e.key === "Enter") {
                  e.preventDefault()
                  ctx.send({ type: "PICK", key: key() })
                }
                return
              }
              if (next || prev) {
                e.preventDefault()
                ctx.send({ type: "MOVE", by: next ? 1 : -1 })
              } else if (e.key === "Home" || e.key === "End") {
                e.preventDefault()
                ctx.send({ type: "MOVE.TO", edge: e.key === "Home" ? "first" : "last" })
              } else if (e.key === " " || e.key === "Enter") {
                e.preventDefault()
                ctx.send({ type: "DROP" })
              } else if (e.key === "Escape") {
                e.preventDefault()
                e.stopPropagation()
                ctx.send({ type: "CANCEL" })
              } else if (e.key === "Tab") {
                ctx.send({ type: "DROP" })
              }
            },
            onPointerDown: (e: PointerEvent) => {
              if (picked()) {
                ctx.send({ type: "DROP" })
                return
              }
              if (ctx.isMovable(key())) ctx.startDrag(key(), e)
            },
            // A pointer press never picks up (Space / Enter do): the click is the drag's.
            onClick: (e: MouseEvent) => e.preventDefault(),
          },
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type SortableIndicatorProps = Own<JSX.LiHTMLAttributes<HTMLLIElement>>

function Indicator(props: SortableIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useSortable("Indicator")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().indicator()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => <li {...p}>{children()}</li>)
}

export type SortableMoveButtonProps = SortableButtonProps & {
  /** Which way it moves its item. */
  readonly direction: "up" | "down"
}

function MoveButton(props: SortableMoveButtonProps) {
  const [local, rest] = splitProps(props, ["render", "direction", "children"])
  const ctx = useSortable("MoveButton")
  const key = useItemKey("MoveButton")
  const merged = createMemo(() => {
    const own = ctx.api().moveButton(key(), local.direction)
    return mergeProps(
      joinHandlers(normalizeProps(own), {
        onClick: () => {
          if (own["aria-disabled"] !== "true") {
            ctx.send({ type: "QUICK", key: key(), by: local.direction === "up" ? -1 : 1 })
          }
        },
      }),
      rest,
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** The parts, by name: `sortable.parts.ts` re-exports them as the `Sortable` namespace. */
export { Handle, Indicator, Item, MoveButton, Root }
