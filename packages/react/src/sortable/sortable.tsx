"use client"

import {
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
  type ComponentPropsWithRef,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    sortable: SortableMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What every part's `render` receives. */
export interface SortableRenderState {
  readonly orientation: SortableOrientation
  /** The picked-up or dragged key, or null. */
  readonly active: string | null
  readonly dragging: boolean
}

type Api = ReturnType<typeof sortableConnect>
type Drag = { readonly delta: { x: number; y: number }; readonly indicator: number } | null

interface Ctx {
  readonly api: Api
  readonly state: SortableRenderState
  readonly send: ReturnType<typeof useMachine<typeof sortableMachine>>["send"]
  readonly items: readonly string[]
  readonly orientation: SortableOrientation
  readonly handleDrags: boolean
  readonly register: (key: string, label: string | undefined, disabled: boolean) => void
  readonly startDrag: (key: string, e: React.PointerEvent) => void
  readonly isMovable: (key: string) => boolean
}
const SortableContext = createContext<Ctx | null>(null)
function useSortable(part: string): Ctx {
  const ctx = useContext(SortableContext)
  if (!ctx) throw new Error(`Sortable.${part} must be inside Sortable.Root`)
  return ctx
}
const ItemContext = createContext<string | null>(null)
function useItemKey(part: string): string {
  const key = useContext(ItemContext)
  if (key === null) throw new Error(`Sortable.${part} must be inside Sortable.Item`)
  return key
}

export type SortableRootProps = Omit<ComponentPropsWithRef<"ul">, "onReorder"> & {
  /** The keys in their current order (controlled: reorder your data in `onReorder`). */
  readonly items: readonly string[]
  readonly onReorder?: (keys: readonly string[], details: SortableReorderDetails) => void
  readonly orientation?: SortableOrientation
  /** Pointer drags start from the Handle (default), or anywhere on the item. */
  readonly handle?: boolean
  readonly messages?: MessageOverrides<SortableMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
  readonly render?: RenderProp<SortableRenderState>
}

function Root({
  items,
  onReorder,
  orientation = "vertical",
  handle = true,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: SortableRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("sortable", sortableMessages, ownMessages)
  const rootEl = useRef<HTMLElement | null>(null)
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map())
  const [disabledKeys, setDisabledKeys] = useState<ReadonlySet<string>>(new Set())
  const [drag, setDrag] = useState<Drag>(null)
  const { view, send } = useMachine(
    sortableMachine,
    { id: instance, items, onReorder, disabledKeys, labels, messages, lang: locale },
    env,
  )
  const active = view.context.active
  const register = useCallback((key: string, label: string | undefined, disabled: boolean) => {
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
  }, [])
  const itemsRef = useRef(items)
  itemsRef.current = items
  const startDrag = useCallback(
    (key: string, e: React.PointerEvent) => {
      const root = rootEl.current
      if (!root || (e.pointerType === "mouse" && e.button !== 0)) return
      const els = itemsRef.current
        .map((k) =>
          root.querySelector<HTMLElement>(
            `[data-scope="sortable"][data-part="item"][data-instance="${CSS.escape(instance)}"][data-value="${CSS.escape(k)}"]`,
          ),
        )
        .filter((el): el is HTMLElement => el !== null)
      const index = itemsRef.current.indexOf(key)
      if (index < 0) return
      sortableDrag(e.nativeEvent, {
        items: els,
        index,
        axis: orientation === "horizontal" ? "x" : "y",
        root,
        onStart: () => send({ type: "DRAG.START", key }),
        onMove: (delta, target, indicator) => {
          setDrag({ delta, indicator })
          send({ type: "DRAG.OVER", index: target })
        },
        onEnd: (drop) => {
          setDrag(null)
          send(drop ? { type: "DRAG.END" } : { type: "CANCEL" })
        },
      })
    },
    [instance, orientation, send],
  )
  const api = sortableConnect({
    instance,
    state: view.state as "idle" | "moving" | "dragging",
    items,
    orientation,
    active,
    disabled: (k) => disabledKeys.has(k),
    label: (k) => labels.get(k) ?? k,
    drag: view.state === "dragging" ? drag : null,
    ids: { instructions: partId("sortable", instance, "instructions") },
    messages,
  })
  const state: SortableRenderState = {
    orientation,
    active,
    dragging: view.state === "dragging",
  }
  const props = mergeProps(
    {
      ...normalizeProps(api.root()),
      ref: composeRefs(rootEl, ref),
      ...(id === undefined ? {} : { id }),
    },
    rest,
  )
  return (
    <SortableContext
      value={{
        api,
        state,
        send,
        items,
        orientation,
        handleDrags: handle,
        register,
        startDrag,
        isMovable: (k) => !disabledKeys.has(k),
      }}
    >
      {renderPart("ul", { ...props, children }, render, state)}
      <span {...normalizeProps(api.instructions())}>{api.instructionsText}</span>
    </SortableContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<SortableRenderState>
}

export type SortableItemProps = PartProps<"li"> & {
  /** The item's key (one of the Root's `items`). */
  readonly value: string
  /** The spoken label (default: the item's text). */
  readonly label?: string
  /** Cannot be moved; other items can pass it. */
  readonly disabled?: boolean
}

function Item({
  render,
  value,
  label,
  disabled = false,
  ref,
  children,
  ...rest
}: SortableItemProps) {
  const ctx = useSortable("Item")
  const el = useRef<HTMLElement | null>(null)
  const { register } = ctx
  // The label: the prop, else the item's text (read after the commit, as it can change).
  useIsoLayoutEffect(() => {
    register(value, label ?? el.current?.textContent?.replace(/\s+/g, " ").trim(), disabled)
  })
  const props = mergeProps(
    ctx.handleDrags
      ? normalizeProps(ctx.api.item(value))
      : joinHandlers(normalizeProps(ctx.api.item(value)), {
          onPointerDown: (e: React.PointerEvent) => {
            if (!disabled) ctx.startDrag(value, e)
          },
        }),
    rest,
    { ref: composeRefs(el, ref) },
  )
  return (
    <ItemContext value={value}>
      {renderPart("li", { ...props, children }, render, ctx.state)}
    </ItemContext>
  )
}

const NEXT = { vertical: "ArrowDown", horizontal: "ArrowRight" } as const
const PREV = { vertical: "ArrowUp", horizontal: "ArrowLeft" } as const

function Handle({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useSortable("Handle")
  const key = useItemKey("Handle")
  const env = useEnvironment()
  const el = useRef<HTMLButtonElement | null>(null)
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const picked = ctx.state.active === key && !ctx.state.dragging
  // The item moves in the DOM as the order changes: keep focus on its handle.
  useIsoLayoutEffect(() => {
    if (picked && el.current && el.current.ownerDocument.activeElement !== el.current) {
      el.current.focus({ preventScroll: false })
    }
  })
  const { send, orientation } = ctx
  // A press elsewhere drops the keyboard session; the listener lives only while picked up.
  useEffect(() => {
    if (!picked) return
    const doc = el.current?.ownerDocument
    const onDown = (e: PointerEvent) => {
      if (!el.current?.contains(e.target as Node)) send({ type: "DROP" })
    }
    doc?.addEventListener("pointerdown", onDown, true)
    return () => doc?.removeEventListener("pointerdown", onDown, true)
  }, [picked, send])
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.handle(key, { focused, modality })), {
        onFocus: () => setFocused(true),
        onBlur: (e: React.FocusEvent) => {
          setFocused(false)
          // Moving focus elsewhere drops where it is (the order has already changed live). A
          // blur with no next target is the item moving in the DOM: its handle is refocused.
          if (picked && e.relatedTarget !== null) send({ type: "DROP" })
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          const next = e.key === NEXT[orientation]
          const prev = e.key === PREV[orientation]
          if (!picked) {
            if ((next || prev) && e.altKey) {
              e.preventDefault()
              send({ type: "QUICK", key, by: next ? 1 : -1 })
            } else if (e.key === " " || e.key === "Enter") {
              e.preventDefault()
              send({ type: "PICK", key })
            }
            return
          }
          if (next || prev) {
            e.preventDefault()
            send({ type: "MOVE", by: next ? 1 : -1 })
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault()
            send({ type: "MOVE.TO", edge: e.key === "Home" ? "first" : "last" })
          } else if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            send({ type: "DROP" })
          } else if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            send({ type: "CANCEL" })
          } else if (e.key === "Tab") {
            send({ type: "DROP" })
          }
        },
        onPointerDown: (e: React.PointerEvent) => {
          if (picked) {
            send({ type: "DROP" })
            return
          }
          if (ctx.isMovable(key)) ctx.startDrag(key, e)
        },
        // A pointer press never picks up (Space / Enter do): the click is the drag's.
        onClick: (e: React.MouseEvent) => e.preventDefault(),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

function Indicator({ render, ...rest }: PartProps<"li">) {
  const ctx = useSortable("Indicator")
  return renderPart("li", mergeProps(normalizeProps(ctx.api.indicator()), rest), render, ctx.state)
}

export type SortableMoveButtonProps = PartProps<"button"> & {
  /** Which way it moves its item. */
  readonly direction: "up" | "down"
}

function MoveButton({ render, direction, children, ...rest }: SortableMoveButtonProps) {
  const ctx = useSortable("MoveButton")
  const key = useItemKey("MoveButton")
  const own = ctx.api.moveButton(key, direction)
  const props = mergeProps(
    joinHandlers(normalizeProps(own), {
      onClick: () => {
        if (own["aria-disabled"] !== "true") {
          ctx.send({ type: "QUICK", key, by: direction === "up" ? -1 : 1 })
        }
      },
    }),
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

export const Sortable = { Root, Item, Handle, Indicator, MoveButton }
