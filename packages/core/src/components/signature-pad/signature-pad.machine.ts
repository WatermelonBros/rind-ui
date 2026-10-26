// Signature Pad (add-signature-pad design §2): idle and drawing. The stroke in progress lives
// in the context, outside the value (Zag 156940f): the value changes only when a stroke ends,
// on clear, on undo and on form reset. One pointer owns a stroke (signature_pad#787); a stroke
// that ends by cancel is still ink.

import type { AnnouncerEnv, LocaleEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs } from "../../machine/types"
import {
  EMPTY_SIGNATURE,
  isSignatureEmpty,
  keepPoint,
  type SignaturePoint,
  type SignatureStroke,
  type SignatureValue,
} from "./signature-pad.geometry"
import { type SignaturePadMessages, signaturePadMessages } from "./signature-pad.messages"

/** A point as the input reports it: in the stroke space, before the stroke's clock. */
export interface SignatureInputPoint {
  readonly x: number
  readonly y: number
  readonly pressure: number
  /** The event's timestamp (ms). */
  readonly time: number
}

export type SignaturePadEvent =
  | {
      readonly type: "POINTER.DOWN"
      readonly pointerId: number
      readonly point: SignatureInputPoint
      /** The Control's CSS box: the stroke space when the pad is empty. */
      readonly box: { readonly width: number; readonly height: number }
    }
  | {
      readonly type: "POINTER.MOVE"
      readonly pointerId: number
      readonly points: readonly SignatureInputPoint[]
    }
  | { readonly type: "POINTER.UP"; readonly pointerId: number }
  | { readonly type: "POINTER.CANCEL"; readonly pointerId: number }
  | { readonly type: "CLEAR" }
  | { readonly type: "UNDO" }
  /** The form's reset: back to `defaultValue`. */
  | { readonly type: "RESET" }
  /** The controlled `value` prop changed (onProps). */
  | { readonly type: "VALUE.SYNCED" }

export interface SignaturePadProps {
  readonly value?: SignatureValue | undefined
  readonly defaultValue?: SignatureValue | undefined
  readonly onValueChange?: ((value: SignatureValue) => void) | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** Points closer than this to the previous one are dropped (stroke-space px, default 1). */
  readonly minDistance?: number | undefined
  readonly messages?: SignaturePadMessages | undefined
  /** For the announcement's key. */
  readonly id: string
  /** The announcements' language (the Root's `locale`); the environment's by default. */
  readonly lang?: string | undefined
}

export interface SignaturePadEnv extends AnnouncerEnv, LocaleEnv {
  /** Mirrors the value on the hidden form input; `dispatch`: fire input and change. */
  readonly syncInput?: ((value: SignatureValue, dispatch: boolean) => void) | undefined
}

export interface SignaturePadContext {
  /** The stroke being drawn (never part of the value until it ends). */
  readonly stroke: SignatureStroke | null
  readonly pointerId: number | null
  /** When the stroke began (the first event's timestamp). */
  readonly startedAt: number
  /** The stroke space for a stroke started on an empty pad. */
  readonly box: { readonly width: number; readonly height: number } | null
  /** A controlled proposal not yet answered. */
  readonly pending: { readonly value: SignatureValue; readonly user: boolean } | null
}

type Types = {
  props: SignaturePadProps
  events: SignaturePadEvent
  env: SignaturePadEnv
  context: SignaturePadContext
  values: "value"
}
type Args = ActionArgs<Types>

const controlled = (props: SignaturePadProps) => props.value !== undefined
const latest = (args: Args): SignatureValue =>
  args.context.pending?.value ?? args.values.value ?? EMPTY_SIGNATURE

/** The one write: proposes `next`; uncontrolled, mirrors it on the input unless refused. */
function write(args: Args, next: SignatureValue, user: boolean) {
  const { props, set, env } = args
  set("value", next)
  if (controlled(props)) {
    set("pending", { value: next, user })
    return
  }
  const after = args.values.value ?? EMPTY_SIGNATURE
  env.syncInput?.(after, user && after === next)
}

function say(args: Args, message: string) {
  const { env, props } = args
  env.announcer.announce({
    message,
    priority: "polite",
    key: `signature-pad-${props.id}`,
    lang: props.lang ?? env.locale.locale(),
  })
}

const messagesOf = (props: SignaturePadProps) => props.messages ?? signaturePadMessages

const pointOf = (p: SignatureInputPoint, startedAt: number): SignaturePoint => ({
  x: p.x,
  y: p.y,
  pressure: p.pressure,
  t: Math.max(0, p.time - startedAt),
})

export const signaturePadMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    canDraw: ({ props }) => props.disabled !== true && props.readOnly !== true,
    ownPointer: ({ context, event }) =>
      "pointerId" in event && event.pointerId === context.pointerId,
    hasStrokes: ({ context, props, values }) =>
      props.disabled !== true &&
      props.readOnly !== true &&
      !isSignatureEmpty(context.pending?.value ?? values.value),
  },
  actions: {
    begin: ({ event, set }) => {
      if (event.type !== "POINTER.DOWN") return
      set("pointerId", event.pointerId)
      set("startedAt", event.point.time)
      set("box", event.box)
      set("stroke", { points: [pointOf(event.point, event.point.time)] })
    },
    extend: ({ context, event, props, set }) => {
      if (event.type !== "POINTER.MOVE" || !context.stroke) return
      const min = props.minDistance ?? 1
      const points = [...context.stroke.points]
      for (const p of event.points) {
        const next = pointOf(p, context.startedAt)
        if (keepPoint(points[points.length - 1], next, min)) points.push(next)
      }
      if (points.length !== context.stroke.points.length) set("stroke", { points })
    },
    /** The stroke ends (up or cancel): it is ink, committed to a new value. */
    commit: (args) => {
      const { context, set } = args
      const stroke = context.stroke
      set("stroke", null)
      set("pointerId", null)
      if (!stroke || stroke.points.length === 0) return
      const was = latest(args)
      const space =
        isSignatureEmpty(was) && context.box
          ? { width: context.box.width, height: context.box.height }
          : { width: was.width, height: was.height }
      write(args, { ...space, strokes: [...was.strokes, stroke] }, true)
    },
    clear: (args) => {
      write(args, EMPTY_SIGNATURE, true)
      say(args, messagesOf(args.props).cleared)
    },
    undo: (args) => {
      const was = latest(args)
      const strokes = was.strokes.slice(0, -1)
      write(args, strokes.length === 0 ? EMPTY_SIGNATURE : { ...was, strokes }, true)
      say(args, messagesOf(args.props).undone)
    },
    restoreDefault: (args) => {
      args.set("stroke", null)
      args.set("pointerId", null)
      write(args, args.props.defaultValue ?? EMPTY_SIGNATURE, false)
    },
    applySynced: (args) => {
      const { context, env, set, values } = args
      const pending = context.pending
      const value = values.value ?? EMPTY_SIGNATURE
      set("pending", null)
      env.syncInput?.(value, pending !== null && pending.value === value && pending.user)
    },
    revert: (args) => {
      args.set("pending", null)
      args.env.syncInput?.(args.values.value ?? EMPTY_SIGNATURE, false)
    },
  },
  effects: {
    prepareAnnouncer: ({ env }) => env.announcer.prepare(),
  },
}).machine({
  id: "signature-pad",
  initial: "idle",
  context: () => ({ stroke: null, pointerId: null, startedAt: 0, box: null, pending: null }),
  values: { value: { fallback: EMPTY_SIGNATURE } },
  onProps: { value: "VALUE.SYNCED" },
  effects: ["prepareAnnouncer"],
  on: {
    RESET: { target: "idle", actions: ["restoreDefault"] },
    "VALUE.SYNCED": { actions: ["applySynced"] },
    $reverted: { actions: ["revert"] },
  },
  states: {
    idle: {
      on: {
        "POINTER.DOWN": { guard: "canDraw", target: "drawing", actions: ["begin"] },
        CLEAR: { guard: "hasStrokes", actions: ["clear"] },
        UNDO: { guard: "hasStrokes", actions: ["undo"] },
      },
    },
    drawing: {
      on: {
        "POINTER.MOVE": { guard: "ownPointer", actions: ["extend"] },
        "POINTER.UP": { guard: "ownPointer", target: "idle", actions: ["commit"] },
        "POINTER.CANCEL": { guard: "ownPointer", target: "idle", actions: ["commit"] },
      },
    },
  },
})

export type SignaturePadMachine = typeof signaturePadMachine
export type SignaturePadState = "idle" | "drawing"
