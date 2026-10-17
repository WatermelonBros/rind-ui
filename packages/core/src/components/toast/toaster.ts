// The toaster store (design §1): toasts created from anywhere, no component mounted. It owns
// one toast service per show (a re-show during exit is a new record: sonner#791), starts
// them when a region attaches (with the region's environment), forwards the region-level
// pause reasons, holds toasts beyond the limit (zag#2403) and settles promises.

import type { SwipeDirection } from "../../dom/swipe"
import type { VisibilityEnv } from "../../env/capabilities"
import { createService } from "../../machine/service"
import type { Service } from "../../machine/types"
import { type ToastEnv, toastMachine } from "./toast.machine"
import type { ToastMessages } from "./toast.messages"
import type {
  ToastData,
  ToastDismissReason,
  ToastId,
  ToastInput,
  ToastInstance,
  ToastPauseReason,
  ToastType,
} from "./toast.types"

export type ToastPlacement =
  | "top-start"
  | "top-center"
  | "top-end"
  | "bottom-start"
  | "bottom-center"
  | "bottom-end"

export interface ToasterOptions {
  /** Default "bottom-end". */
  readonly placement?: ToastPlacement | undefined
  /** Presented at most (default 3); older ones are held, never dropped. */
  readonly limit?: number | undefined
  /** ms (default 5000). */
  readonly duration?: number | undefined
  /** px between toasts (default 14). */
  readonly gap?: number | undefined
  /** Always expanded (default false). */
  readonly expand?: boolean | undefined
  /** Default "F6". */
  readonly hotkey?: string | undefined
  /** Default: the placement's edge and the inline end. */
  readonly swipeDirections?: readonly SwipeDirection[] | undefined
}

/** What a region gives the store while it is mounted. */
export type ToasterEnv = ToastEnv & VisibilityEnv

/** A shown toast as regions and tests read it. */
export interface ToastSnapshot {
  readonly instance: ToastInstance
  readonly data: ToastData
  /** `idle` before a region starts it; `dismissed` while it exits. */
  readonly state: "idle" | "timing" | "paused" | "persistent" | "dismissed"
  readonly dismissReason: ToastDismissReason | null
  readonly reasons: ReadonlySet<ToastPauseReason>
  /** Beyond the limit: held (inert, paused). */
  readonly limited: boolean
  readonly swiping: boolean
  readonly swipeDirection: SwipeDirection | null
  readonly height: number
}

export interface PromiseToastOptions<T> {
  readonly loading: ToastInput | string
  readonly success?: ToastInput | string | ((value: T) => ToastInput | string)
  readonly error?: ToastInput | string | ((reason: unknown) => ToastInput | string)
}

/** The store's options with their defaults applied. */
export interface ResolvedToasterOptions {
  readonly placement: ToastPlacement
  readonly limit: number
  readonly duration: number
  readonly gap: number
  readonly expand: boolean
  readonly hotkey: string
  readonly swipeDirections: readonly SwipeDirection[] | undefined
}

export interface Toaster {
  readonly options: ResolvedToasterOptions
  show(input: ToastInput | string): ToastId
  info(input: ToastInput | string): ToastId
  success(input: ToastInput | string): ToastId
  warning(input: ToastInput | string): ToastId
  error(input: ToastInput | string): ToastId
  loading(input: ToastInput | string): ToastId
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    options: PromiseToastOptions<T>,
    shared?: ToastInput,
  ): { readonly id: ToastId; readonly result: Promise<T> }
  update(id: ToastId, patch: Partial<ToastInput> | ((data: ToastData) => Partial<ToastInput>)): void
  /** One toast, or every toast. */
  dismiss(id?: ToastId): void
  /** The `api` pause reason, for one toast or the whole store, until `resume`. */
  pause(id?: ToastId): void
  resume(id?: ToastId): void
  get(id: ToastId): ToastSnapshot | undefined
  /** Newest first, including those exiting (state `dismissed`). */
  toasts(): readonly ToastSnapshot[]
  subscribe(listener: () => void): () => void
  /** Used by regions: binds the store to an environment while a region is mounted. */
  attach(env: ToasterEnv, region?: { readonly messages?: ToastMessages | undefined }): () => void
  /** Used by regions: a region-level pause reason (hover, focus) holds or ends. */
  regionReason(reason: "hover" | "focus", on: boolean): void
  /** Used by regions: a dismissed toast's exit ended; the record goes. */
  remove(instance: ToastInstance): void
  /** Used by regions: the service of a shown toast (its parts send to it). */
  service(instance: ToastInstance): Service<typeof toastMachine> | undefined
}

interface ToastRecord {
  readonly instance: ToastInstance
  data: ToastData
  service: Service<typeof toastMachine> | null
  /** Reasons applied before the service exists. */
  readonly pending: Set<ToastPauseReason>
  limited: boolean
}

let seq = 0
const newId = () => `toast-${++seq}` as ToastId
const newInstance = () => `t${++seq}` as ToastInstance

const toInput = (input: ToastInput | string): ToastInput =>
  typeof input === "string" ? { title: input } : input

/** Creates a store; module-level is fine (`export const toaster = createToaster()`). */
export function createToaster(options: ToasterOptions = {}): Toaster {
  const o: ResolvedToasterOptions = {
    placement: options.placement ?? "bottom-end",
    limit: options.limit ?? 3,
    duration: options.duration ?? 5000,
    gap: options.gap ?? 14,
    expand: options.expand ?? false,
    hotkey: options.hotkey ?? "F6",
    swipeDirections: options.swipeDirections,
  }
  // Newest first.
  let records: ToastRecord[] = []
  const listeners = new Set<() => void>()
  const regionReasons = new Set<ToastPauseReason>()
  let env: ToasterEnv | null = null
  let messages: ToastMessages | undefined
  let attached = 0
  let storePaused = false
  let cache: readonly ToastSnapshot[] | null = null

  const notify = () => {
    cache = null
    for (const l of listeners) l()
  }

  const live = (r: ToastRecord) => r.service?.getSnapshot().state !== "dismissed"

  const pause = (r: ToastRecord, reason: ToastPauseReason) => {
    if (r.service) r.service.send({ type: "PAUSE", reason })
    else r.pending.add(reason)
  }
  const resume = (r: ToastRecord, reason: ToastPauseReason) => {
    if (r.service) r.service.send({ type: "RESUME", reason })
    else r.pending.delete(reason)
  }

  /** Presented: the newest `limit` live toasts; the others are held and paused. */
  const applyLimit = () => {
    let shown = 0
    for (const r of records) {
      if (!live(r)) continue
      const limited = shown >= o.limit
      if (!limited) shown += 1
      if (limited === r.limited) continue
      r.limited = limited
      if (limited) pause(r, "limited")
      else resume(r, "limited")
    }
  }

  const start = (r: ToastRecord, e: ToasterEnv) => {
    const service = createService(
      toastMachine,
      {
        data: r.data,
        duration: o.duration,
        swipeDirections: o.swipeDirections ?? [],
        hotkey: o.hotkey,
        messages,
        onDismissed: () => {
          applyLimit()
          // With no region to play the exit, the record goes at once.
          if (attached === 0) removeRecord(r.instance)
        },
      },
      e,
    )
    r.service = service
    service.subscribe(notify)
    service.start()
    for (const reason of r.pending) service.send({ type: "PAUSE", reason })
    for (const reason of regionReasons) service.send({ type: "PAUSE", reason })
    r.pending.clear()
    service.send({ type: "START" })
  }

  const removeRecord = (instance: ToastInstance) => {
    const r = records.find((x) => x.instance === instance)
    if (!r) return
    r.service?.stop()
    records = records.filter((x) => x !== r)
    applyLimit()
    notify()
  }

  const find = (id: ToastId) => records.find((r) => r.data.id === id && live(r))

  const show = (input: ToastInput | string, type?: ToastType): ToastId => {
    const i = toInput(input)
    const id = (i.id as ToastId | undefined) ?? newId()
    const data: ToastData = { ...i, id, type: type ?? i.type ?? "info" }
    const visible = find(id)
    if (visible) {
      // Same id while visible: updated in place, its lifetime restarted.
      visible.data = data
      visible.service?.send({ type: "UPDATE", data })
      notify()
      return id
    }
    // A new record (also when a toast with that id is exiting).
    const r: ToastRecord = {
      instance: newInstance(),
      data,
      service: null,
      pending: new Set(storePaused ? ["api"] : []),
      limited: false,
    }
    if (attached === 0) r.pending.add("unmounted")
    records = [r, ...records]
    applyLimit()
    if (env) start(r, env)
    notify()
    return id
  }

  const update: Toaster["update"] = (id, patch) => {
    const r = find(id)
    if (!r) return
    const p = typeof patch === "function" ? patch(r.data) : patch
    const data: ToastData = { ...r.data, ...p, id, type: p.type ?? r.data.type }
    r.data = data
    r.service?.send({ type: "UPDATE", data })
    notify()
  }

  const dismiss = (id?: ToastId) => {
    for (const r of [...records]) {
      if (id !== undefined && r.data.id !== id) continue
      if (!live(r)) continue
      if (r.service) r.service.send({ type: "DISMISS" })
      else removeRecord(r.instance)
    }
  }

  const snapshot = (r: ToastRecord): ToastSnapshot => {
    const s = r.service?.getSnapshot()
    return {
      instance: r.instance,
      data: r.data,
      state: (s?.state ?? "idle") as ToastSnapshot["state"],
      dismissReason: s?.context.dismissReason ?? null,
      reasons: s?.context.reasons ?? r.pending,
      limited: r.limited,
      swiping: s?.context.swiping ?? false,
      swipeDirection: s?.context.swipeDirection ?? null,
      height: s?.context.height ?? 0,
    }
  }

  const toaster: Toaster = {
    options: o,
    show: (input) => show(input),
    info: (input) => show(input, "info"),
    success: (input) => show(input, "success"),
    warning: (input) => show(input, "warning"),
    error: (input) => show(input, "error"),
    loading: (input) => show(input, "loading"),
    promise(promise, opts, shared = {}) {
      const id = show({ ...shared, ...toInput(opts.loading), type: "loading" })
      const instance = find(id)?.instance
      // Only the record this promise created: a dismissed or re-shown toast is left alone.
      const mine = () => {
        const r = find(id)
        return r !== undefined && r.instance === instance
      }
      const settle = (next: ToastInput | string | undefined, type: ToastType) => {
        if (!mine()) return
        if (next === undefined) return dismiss(id)
        const i = toInput(next)
        update(id, { ...shared, ...i, type: i.type ?? type, duration: i.duration })
      }
      const result = typeof promise === "function" ? promise() : promise
      result.then(
        (value) =>
          settle(
            typeof opts.success === "function" ? opts.success(value) : opts.success,
            "success",
          ),
        (reason: unknown) =>
          settle(typeof opts.error === "function" ? opts.error(reason) : opts.error, "error"),
      )
      return { id, result }
    },
    update,
    dismiss,
    pause(id) {
      if (id === undefined) storePaused = true
      for (const r of records) if (id === undefined || r.data.id === id) pause(r, "api")
      notify()
    },
    resume(id) {
      if (id === undefined) storePaused = false
      for (const r of records) if (id === undefined || r.data.id === id) resume(r, "api")
      notify()
    },
    get: (id) => {
      const r = records.find((x) => x.data.id === id)
      return r ? snapshot(r) : undefined
    },
    toasts() {
      cache ??= records.map(snapshot)
      return cache
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    attach(e, region) {
      attached += 1
      messages = region?.messages ?? messages
      const first = env === null
      env = e
      if (first) for (const r of [...records].reverse()) if (!r.service) start(r, e)
      for (const r of records) resume(r, "unmounted")
      const offVisibility = e.visibility.subscribe((hidden) => setRegion("hidden", hidden))
      setRegion("hidden", e.visibility.hidden())
      notify()
      return () => {
        offVisibility()
        attached -= 1
        if (attached > 0) return
        // No region: every lifetime pauses until one mounts again (sonner#786).
        for (const r of records) pause(r, "unmounted")
        setRegion("hidden", false)
        notify()
      }
    },
    regionReason: (reason, on) => setRegion(reason, on),
    remove: removeRecord,
    service: (instance) => records.find((r) => r.instance === instance)?.service ?? undefined,
  }

  function setRegion(reason: ToastPauseReason, on: boolean) {
    if (regionReasons.has(reason) === on) return
    if (on) regionReasons.add(reason)
    else regionReasons.delete(reason)
    for (const r of records) {
      if (on) pause(r, reason)
      else resume(r, reason)
    }
    notify()
  }

  return toaster
}
