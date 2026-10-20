// QR Code (design §4): the value is a controllable string; `ready` / `downloading` make a
// double click a no-op by construction. The encoding is a prop (memoised by value in the
// adapter), so render, server and client agree. The only DOM work is in two effects: the
// export while `downloading`, and the overlay measurement while `ready`.

import type { Modality } from "../../contract/env"
import { sanitizeFileName, saveBlob } from "../../dom/download"
import { exportQr, type QrMime, type QrOverlayOutcome } from "../../dom/qr-export"
import type { DomEnv, SchedulerEnv } from "../../env/capabilities"
import { partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import { overlayCoverage, type QrCoverage, warnOverlayCoverage } from "./qr-code.coverage"
import { type QrEncoded, qrModules } from "./qr-code.encoding"

export type { QrMime, QrOverlayOutcome }

export interface QrDownloadOptions {
  /** Default `"image/png"`. */
  readonly mimeType?: QrMime | undefined
  /** 0–1 for lossy types. */
  readonly quality?: number | undefined
  /** Default `"qr-code"` plus the type's extension. Path separators and controls are removed. */
  readonly fileName?: string | undefined
  /** Width of the exported image in CSS pixels. Default 1024. */
  readonly size?: number | undefined
}

export interface QrDownloadDetails {
  readonly fileName: string
  readonly mimeType: QrMime
  readonly overlay: QrOverlayOutcome
}

export type QrCodeEvent =
  | { readonly type: "VALUE.SET"; readonly value: string }
  | ({ readonly type: "DOWNLOAD"; readonly modality: Modality } & QrDownloadOptions)
  | { readonly type: "DOWNLOAD.DONE"; readonly details: QrDownloadDetails }
  | { readonly type: "DOWNLOAD.FAILED" }
  | { readonly type: "PARTS.CHANGED"; readonly valueText: boolean; readonly overlay: boolean }
  | { readonly type: "OVERLAY.MEASURED"; readonly coverage: QrCoverage }
  /** onProps: the encoding changed (a new controlled value or new option values). */
  | { readonly type: "ENCODING.CHANGED" }

export interface QrCodeProps {
  readonly value?: string | undefined
  readonly defaultValue?: string | undefined
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<QrCodeEvent>) => void)
    | undefined
  /** The adapter's memoised encoder (by value and option values, see `createQrEncoder`). */
  readonly encode: (value: string) => QrEncoded
  /** The option values' key: a change re-measures the overlay. */
  readonly encodingKey: string
  /** The instance's root id (part ids derive from it). */
  readonly root: string
  readonly onDownload?: ((details: QrDownloadDetails) => void) | undefined
}

export interface QrCodeContext {
  readonly request: QrDownloadOptions | undefined
  readonly lastDownload: QrDownloadDetails | undefined
  readonly coverage: QrCoverage | undefined
  readonly parts: { readonly valueText: boolean; readonly overlay: boolean }
}

const EXTENSIONS: Readonly<Record<QrMime, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
}

/** The ids of the parts the effects read. */
export const qrCodeIds = (root: string) => ({
  frame: partId("qr-code", root, "frame"),
  pattern: partId("qr-code", root, "pattern"),
  overlay: partId("qr-code", root, "overlay"),
  valueText: partId("qr-code", root, "value-text"),
})

export const qrCodeMachine = /* @__PURE__ */ setup({
  types: type<{
    props: QrCodeProps
    events: QrCodeEvent
    env: DomEnv & SchedulerEnv
    context: QrCodeContext
    values: "value"
  }>(),
  guards: {
    isDownloadable: ({ props, values }) => props.encode(values.value).status === "ready",
  },
  actions: {
    setValue: ({ event, set }) => {
      if (event.type === "VALUE.SET") set("value", event.value)
    },
    setRequest: ({ event, set }) => {
      if (event.type !== "DOWNLOAD") return
      const { type: _t, modality: _m, ...request } = event
      set("request", request)
    },
    recordDownload: ({ event, set, props }) => {
      if (event.type !== "DOWNLOAD.DONE") return
      set("lastDownload", event.details)
      props.onDownload?.(event.details)
    },
    setParts: ({ event, set }) => {
      if (event.type === "PARTS.CHANGED") {
        set("parts", { valueText: event.valueText, overlay: event.overlay })
      }
    },
    setCoverage: ({ event, set }) => {
      if (event.type === "OVERLAY.MEASURED") set("coverage", event.coverage)
    },
  },
  effects: {
    /** Exports the symbol and saves it; reports done or failed, never throws. */
    exportImage: ({ env, props, values, context, send }) => {
      const encoded = props.encode(values.value)
      const request = context.request ?? {}
      if (encoded.status !== "ready" || typeof document === "undefined") {
        send({ type: "DOWNLOAD.FAILED" })
        return undefined
      }
      let cancelled = false
      const ids = qrCodeIds(props.root)
      const mimeType = request.mimeType ?? "image/png"
      const fileName = sanitizeFileName(
        request.fileName ?? `qr-code.${EXTENSIONS[mimeType]}`,
        `qr-code.${EXTENSIONS[mimeType]}`,
      )
      const frame = env.dom.getById(ids.frame)
      exportQr({
        modules: encoded.result.modules,
        quietZone: encoded.quietZone,
        mimeType,
        quality: request.quality,
        size: request.size ?? 1024,
        frame,
        pattern: env.dom.getById(ids.pattern),
        overlay: env.dom.getById(ids.overlay),
      })
        .then(({ blob, overlay }) => {
          if (cancelled) return
          const doc = frame?.ownerDocument ?? document
          saveBlob(doc, blob, fileName, (revoke) => env.scheduler.setTimeout(revoke, 0))
          send({ type: "DOWNLOAD.DONE", details: { fileName, mimeType, overlay } })
        })
        .catch(() => {
          if (!cancelled) send({ type: "DOWNLOAD.FAILED" })
        })
      return () => {
        cancelled = true
      }
    },
    /** Measures the overlay against the frame (browser only) and reports the coverage. */
    watchOverlay: ({ env, props, values, send }) => {
      if (typeof ResizeObserver === "undefined") return undefined
      const ids = qrCodeIds(props.root)
      const frame = env.dom.getById(ids.frame)
      const overlay = env.dom.getById(ids.overlay)
      if (!frame || !overlay) return undefined
      const encoded = props.encode(values.value)
      let last = ""
      const measure = () => {
        const coverage = overlayCoverage(
          frame.getBoundingClientRect(),
          overlay.getBoundingClientRect(),
          qrModules(encoded),
          encoded.quietZone,
        )
        const key = JSON.stringify(coverage)
        if (key === last) return
        last = key
        send({ type: "OVERLAY.MEASURED", coverage })
        if (encoded.status === "ready") warnOverlayCoverage(coverage, encoded.result)
      }
      const observer = new ResizeObserver(measure)
      observer.observe(frame)
      observer.observe(overlay)
      measure()
      return () => observer.disconnect()
    },
  },
}).machine({
  id: "qr-code",
  initial: "ready",
  context: () => ({
    request: undefined,
    lastDownload: undefined,
    coverage: undefined,
    parts: { valueText: false, overlay: false },
  }),
  values: { value: { fallback: "" } },
  onProps: { value: "ENCODING.CHANGED", encodingKey: "ENCODING.CHANGED" },
  on: {
    "VALUE.SET": { actions: ["setValue"] },
    "PARTS.CHANGED": { actions: ["setParts"] },
    "OVERLAY.MEASURED": { actions: ["setCoverage"] },
  },
  states: {
    ready: {
      effects: ["watchOverlay"],
      on: {
        DOWNLOAD: { guard: "isDownloadable", target: "downloading", actions: ["setRequest"] },
        // The overlay appeared or the module count changed: measure again.
        "VALUE.SET": { target: "ready", reenter: true, actions: ["setValue"] },
        "PARTS.CHANGED": { target: "ready", reenter: true, actions: ["setParts"] },
        "ENCODING.CHANGED": { target: "ready", reenter: true },
      },
    },
    downloading: {
      effects: ["exportImage"],
      on: {
        "DOWNLOAD.DONE": { target: "ready", actions: ["recordDownload"] },
        "DOWNLOAD.FAILED": { target: "ready" },
      },
    },
  },
})

export type QrCodeMachine = typeof qrCodeMachine
