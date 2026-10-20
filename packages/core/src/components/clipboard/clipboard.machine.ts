// Clipboard (design §2): the states are the copy's (idle | copying | copied | error), decided by
// the clipboard write's promise, never before it settles (Zag reports "copied" first). A copy
// from the read-only Input is the browser's own, so it is `copied` without a write, and only
// when the whole value was selected (a partial copy is not "the value copied").

import type { AnnouncerEnv, ClipboardEnv, SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ClipboardMessages } from "./clipboard.messages"
import { announceCopy, writeClipboard } from "./copy"

export type ClipboardEvent =
  /** A press on the Trigger. */
  | { readonly type: "COPY" }
  | { readonly type: "COPY.DONE" }
  | { readonly type: "COPY.FAILED"; readonly error?: unknown }
  /** A native `copy` in the Input; `whole`: the selection covered the whole, non-empty value. */
  | { readonly type: "INPUT.COPY"; readonly whole: boolean }

/** Where a copy came from. */
export type ClipboardCopySource = "trigger" | "input"

/** What `onCopy` receives, once per result. */
export type ClipboardCopyDetails =
  | { readonly ok: true; readonly source: ClipboardCopySource }
  | { readonly ok: false; readonly error: unknown; readonly source: ClipboardCopySource }

export type ClipboardCopyState = "idle" | "copying" | "copied" | "error"

export interface ClipboardProps {
  /** What a press copies; read when the write starts. */
  readonly value: string
  readonly messages: ClipboardMessages
  /** For the announcement's key. */
  readonly id: string
  readonly lang?: string | undefined
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration?: number | undefined
  readonly disabled?: boolean | undefined
  readonly onCopy?: ((details: ClipboardCopyDetails) => void) | undefined
  /** The Trigger (the clipboard fallback inserts its node next to it). */
  readonly getCopyAnchor?: (() => Element | null) | undefined
}

export const DEFAULT_CLIPBOARD_FEEDBACK_DURATION = 2000

export const clipboardMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ClipboardProps
    events: ClipboardEvent
    env: AnnouncerEnv & ClipboardEnv & SchedulerEnv
  }>(),
  guards: {
    enabled: ({ props }) => props.disabled !== true,
    whole: ({ event }) => event.type === "INPUT.COPY" && event.whole,
  },
  actions: {
    reportCopied: ({ props, env, event }) => {
      announce(env, props, props.messages.copied)
      props.onCopy?.({ ok: true, source: event.type === "INPUT.COPY" ? "input" : "trigger" })
    },
    reportFailed: ({ props, env, event }) => {
      announce(env, props, props.messages.copyFailed)
      props.onCopy?.({
        ok: false,
        error: event.type === "COPY.FAILED" ? event.error : undefined,
        source: "trigger",
      })
    },
  },
  effects: {
    prepareAnnouncer: ({ env }) => env.announcer.prepare(),
    /** One write per entry to `copying`; a result after leaving the state is dropped. */
    writeClipboard: ({ props, env, send }) =>
      writeClipboard(env, props.value, props.getCopyAnchor?.(), send),
  },
  delays: {
    feedback: ({ props }) => props.copyFeedbackDuration ?? DEFAULT_CLIPBOARD_FEEDBACK_DURATION,
  },
}).machine({
  id: "clipboard",
  initial: "idle",
  effects: ["prepareAnnouncer"],
  states: {
    idle: {
      on: {
        COPY: { guard: "enabled", target: "copying" },
        "INPUT.COPY": { guard: "whole", target: "copied" },
      },
    },
    // A press while the write is pending is ignored: one write at a time (VueUse#5539).
    copying: {
      effects: ["writeClipboard"],
      on: { "COPY.DONE": "copied", "COPY.FAILED": "error" },
    },
    copied: {
      entry: ["reportCopied"],
      after: { feedback: "idle" },
      // Another copy reports again; the feedback timer restarts from the new result.
      on: {
        COPY: { guard: "enabled", target: "copying" },
        "INPUT.COPY": { guard: "whole", target: "copied", reenter: true },
      },
    },
    error: {
      entry: ["reportFailed"],
      after: { feedback: "idle" },
      on: {
        COPY: { guard: "enabled", target: "copying" },
        "INPUT.COPY": { guard: "whole", target: "copied" },
      },
    },
  },
})

export type ClipboardMachine = typeof clipboardMachine

function announce(env: AnnouncerEnv, props: ClipboardProps, message: string) {
  announceCopy(env, { scope: "clipboard", id: props.id, message, lang: props.lang })
}
