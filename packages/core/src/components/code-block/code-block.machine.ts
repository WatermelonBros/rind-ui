// Code Block (design §2): the states are the copy's (idle | copying | copied | error), decided
// by the clipboard write's promise, never before it settles (Zag's clipboard reported "copied"
// first). Wrap and expanded are controllable values beside them; `scrollable` is measured by the
// adapter's overflow watch and only decides the tab stop.

import type { AnnouncerEnv, ClipboardEnv, SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import { announceCopy, writeClipboard } from "../clipboard/copy"
import type { CodeBlockMessages } from "./code-block.messages"

export type CodeBlockEvent =
  | { readonly type: "COPY" }
  | { readonly type: "COPY.DONE" }
  | { readonly type: "COPY.FAILED"; readonly error?: unknown }
  | { readonly type: "WRAP.TOGGLE" }
  | { readonly type: "EXPAND.TOGGLE" }
  | { readonly type: "OVERFLOW.CHANGE"; readonly overflow: boolean }

/** What `onCopy` receives. */
export type CodeBlockCopyDetails =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: unknown }

export interface CodeBlockProps {
  /** The source: what Copy writes, never the rendered text. */
  readonly code: string
  readonly messages: CodeBlockMessages
  /** For the announcement's key. */
  readonly id: string
  readonly lang?: string | undefined
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration?: number | undefined
  readonly onCopy?: ((details: CodeBlockCopyDetails) => void) | undefined
  /** The copy button (the clipboard fallback inserts its node next to it). */
  readonly getCopyAnchor?: (() => Element | null) | undefined
  /** Longer than `maxLines`: the collapse toggle applies. */
  readonly collapsible?: boolean | undefined
  readonly wrapped?: boolean | undefined
  readonly defaultWrapped?: boolean | undefined
  readonly onWrappedChange?:
    | ((wrapped: boolean, details: ChangeDetails<CodeBlockEvent>) => void)
    | undefined
  readonly expanded?: boolean | undefined
  readonly defaultExpanded?: boolean | undefined
  readonly onExpandedChange?:
    | ((expanded: boolean, details: ChangeDetails<CodeBlockEvent>) => void)
    | undefined
}

export interface CodeBlockContext {
  /** The content overflows its scroll container (measured on the client; false on the server). */
  readonly scrollable: boolean
}

export const DEFAULT_COPY_FEEDBACK_DURATION = 2000

export const codeBlockMachine = setup({
  types: type<{
    props: CodeBlockProps
    events: CodeBlockEvent
    env: AnnouncerEnv & ClipboardEnv & SchedulerEnv
    context: CodeBlockContext
    values: "wrapped" | "expanded"
  }>(),
  guards: {
    collapsible: ({ props }) => props.collapsible === true,
  },
  actions: {
    toggleWrapped: ({ values, set }) => set("wrapped", !values.wrapped),
    toggleExpanded: ({ values, set }) => set("expanded", !values.expanded),
    setScrollable: ({ event, set }) => {
      if (event.type === "OVERFLOW.CHANGE") set("scrollable", event.overflow)
    },
    reportCopied: ({ props, env }) => {
      announce(env, props, props.messages.copied)
      props.onCopy?.({ ok: true })
    },
    reportFailed: ({ props, env, event }) => {
      announce(env, props, props.messages.copyFailed)
      props.onCopy?.({ ok: false, error: event.type === "COPY.FAILED" ? event.error : undefined })
    },
  },
  effects: {
    prepareAnnouncer: ({ env }) => env.announcer.prepare(),
    /** One write per entry to `copying`; a result after leaving the state is dropped. */
    writeClipboard: ({ props, env, send }) =>
      writeClipboard(env, props.code, props.getCopyAnchor?.(), send),
  },
  delays: {
    feedback: ({ props }) => props.copyFeedbackDuration ?? DEFAULT_COPY_FEEDBACK_DURATION,
  },
}).machine({
  id: "code-block",
  initial: "idle",
  context: () => ({ scrollable: false }),
  values: { wrapped: { fallback: false }, expanded: { fallback: true } },
  effects: ["prepareAnnouncer"],
  on: {
    "WRAP.TOGGLE": { actions: ["toggleWrapped"] },
    "EXPAND.TOGGLE": { guard: "collapsible", actions: ["toggleExpanded"] },
    "OVERFLOW.CHANGE": { actions: ["setScrollable"] },
  },
  states: {
    idle: { on: { COPY: "copying" } },
    copying: {
      effects: ["writeClipboard"],
      on: { "COPY.DONE": "copied", "COPY.FAILED": "error" },
    },
    copied: {
      entry: ["reportCopied"],
      after: { feedback: "idle" },
      // Another press copies again; the feedback timer restarts from the new result.
      on: { COPY: "copying" },
    },
    error: {
      entry: ["reportFailed"],
      after: { feedback: "idle" },
      on: { COPY: "copying" },
    },
  },
})

export type CodeBlockMachine = typeof codeBlockMachine
export type CodeBlockCopyState = "idle" | "copying" | "copied" | "error"

function announce(env: AnnouncerEnv, props: CodeBlockProps, message: string) {
  announceCopy(env, { scope: "code-block", id: props.id, message, lang: props.lang })
}
