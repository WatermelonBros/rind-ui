// Form (design §2): what needs the whole form. Fields keep validating and displaying
// themselves; the Form groups an attempt, focuses the first invalid Field in tree order,
// holds a submission for pending async checks, and announces one summary.

import type { AnnouncerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ValidationBehavior, ValidationMode } from "../field/field.machine"
import type { FormMessages } from "./form.messages"

/** What a Field gives its Form when it registers. */
export interface FormField {
  readonly id: string
  readonly name?: string | undefined
  /** The Field's root element: tree order is document order, never registration order. */
  element(): Element | null
  /** Records a submit attempt on the Field (it validates and displays, quietly). */
  attempt(): void
  /** What the Field displays now. */
  status(): "none" | "validating" | "valid" | "invalid"
  /** Focuses the Field's control with a focus ring. */
  focus(): void
  value(): unknown
}

export type FormErrors = Readonly<Record<string, string | readonly string[]>>

export interface FormSubmitDetails {
  readonly event: SubmitEvent | null
  readonly submitter: HTMLElement | null
}

export type FormEvent =
  | {
      readonly type: "SUBMIT.ATTEMPT"
      /** The native submit to cancel (null: the attempt came from `invalid` events). */
      readonly submitEvent: SubmitEvent | null
      readonly submitter: HTMLElement | null
    }
  | { readonly type: "VALIDATE" }
  | { readonly type: "FIELD.SETTLED" }
  | { readonly type: "RESET" }
  | { readonly type: "ERRORS.PROP" }
  | { readonly type: "DECIDE" }

export interface FormProps {
  readonly validationMode?: ValidationMode | undefined
  readonly validationBehavior?: ValidationBehavior | undefined
  readonly errors?: FormErrors | undefined
  readonly onFormSubmit?:
    | ((values: Readonly<Record<string, unknown>>, details: FormSubmitDetails) => void)
    | undefined
  readonly messages: FormMessages
  /** The registered Fields, read live. */
  readonly fields: () => readonly FormField[]
  /** `form.requestSubmit(submitter)` (a held submission once every check settled). */
  readonly requestSubmit: (submitter: HTMLElement | null) => void
}

export interface FormContext {
  /** The last attempt failed (`data-invalid`), until the next attempt or reset. */
  failed: boolean
  /** The attempt being decided. */
  submitEvent: SubmitEvent | null
  submitter: HTMLElement | null
  /** A programmatic `validate()`: errors displayed, no focus, no submission. */
  programmatic: boolean
  submissions: number
}

/** Fields in document order (the order a user reads them), whatever their registration. */
export function inTreeOrder<F extends { element(): Element | null }>(fields: readonly F[]): F[] {
  return [...fields].sort((a, b) => {
    const x = a.element()
    const y = b.element()
    if (!x || !y) return 0
    return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  })
}

const invalidFields = (props: FormProps) =>
  inTreeOrder(props.fields().filter((f) => f.status() === "invalid"))

export const formMachine = setup({
  types: type<{
    props: FormProps
    events: FormEvent
    env: AnnouncerEnv
    context: FormContext
  }>(),
  guards: {
    anyValidating: ({ props }) => props.fields().some((f) => f.status() === "validating"),
    anyInvalid: ({ props }) => props.fields().some((f) => f.status() === "invalid"),
    programmatic: ({ context }) => context.programmatic,
    /**
     * The attempt came from native `invalid` events and no Field is invalid: a plain
     * control outside any Field failed, so the browser blocked the submission.
     */
    blockedNatively: ({ context }) => context.submitEvent === null && !context.programmatic,
    hasServerErrors: ({ props }) => Object.keys(props.errors ?? {}).length > 0,
  },
  actions: {
    remember: ({ event, set }) => {
      if (event.type !== "SUBMIT.ATTEMPT") return
      set("submitEvent", event.submitEvent)
      set("submitter", event.submitter)
      set("programmatic", false)
    },
    rememberProgrammatic: ({ set }) => {
      set("submitEvent", null)
      set("programmatic", true)
    },
    attemptAll: ({ props }) => {
      for (const f of props.fields()) f.attempt()
    },
    decide: ({ send }) => send({ type: "DECIDE" }),
    cancel: ({ context }) => context.submitEvent?.preventDefault(),
    markFailed: ({ set }) => set("failed", true),
    markPassed: ({ set }) => set("failed", false),
    /** One focus move per attempt: to the first invalid Field in tree order. */
    focusFirst: ({ props }) => invalidFields(props)[0]?.focus(),
    /** Two or more invalid Fields: one polite summary (one Field speaks for itself). */
    announceSummary: ({ props, env }) => {
      const count = invalidFields(props).length
      if (count < 2) return
      env.announcer.announce({
        message: props.messages.invalidSummary(count),
        priority: "polite",
        key: "form-summary",
      })
    },
    proceed: ({ context, props, set }) => {
      set("submissions", context.submissions + 1)
      if (!props.onFormSubmit) return
      // Values are read from the Fields now; the native submission is replaced.
      context.submitEvent?.preventDefault()
      const values: Record<string, unknown> = {}
      for (const f of inTreeOrder(props.fields())) if (f.name) values[f.name] = f.value()
      props.onFormSubmit(values, { event: context.submitEvent, submitter: context.submitter })
    },
    resubmit: ({ context, props }) => {
      const s = context.submitter as (HTMLElement & { disabled?: boolean }) | null
      props.requestSubmit(s?.isConnected && !s.disabled ? s : null)
    },
    /** Server errors after a submission: focus the first Field (tree order) that has one. */
    focusFirstServer: ({ props }) => {
      const errors = props.errors ?? {}
      const withError = props.fields().filter((f) => f.name !== undefined && f.name in errors)
      inTreeOrder(withError)[0]?.focus()
    },
    announceServerSummary: ({ props, env }) => {
      const errors = props.errors ?? {}
      const count = props.fields().filter((f) => f.name !== undefined && f.name in errors).length
      if (count < 2) return
      env.announcer.announce({
        message: props.messages.invalidSummary(count),
        priority: "polite",
        key: "form-summary",
      })
    },
    clearFailed: ({ set }) => set("failed", false),
  },
}).machine({
  id: "form",
  initial: "idle",
  onProps: { errors: "ERRORS.PROP" },
  context: () => ({
    failed: false,
    submitEvent: null,
    submitter: null,
    programmatic: false,
    submissions: 0,
  }),
  on: {
    "SUBMIT.ATTEMPT": { actions: ["remember", "attemptAll", "decide"] },
    VALIDATE: { actions: ["rememberProgrammatic", "attemptAll", "decide"] },
    RESET: { target: "idle", actions: ["clearFailed"] },
    DECIDE: [
      // validate(): errors displayed, nothing focused or submitted.
      { guard: { and: ["programmatic", "anyInvalid"] }, target: "idle", actions: ["markFailed"] },
      { guard: "programmatic", target: "idle", actions: ["markPassed"] },
      { guard: "anyValidating", target: "validating", actions: ["cancel"] },
      {
        guard: "anyInvalid",
        target: "idle",
        actions: ["cancel", "markFailed", "focusFirst", "announceSummary"],
      },
      { guard: "blockedNatively", target: "idle", actions: ["markFailed"] },
      { target: "awaiting-server", actions: ["markPassed", "proceed"] },
    ],
  },
  states: {
    idle: {},
    validating: {
      on: {
        "FIELD.SETTLED": [
          { guard: "anyValidating" },
          {
            guard: "anyInvalid",
            target: "idle",
            actions: ["markFailed", "focusFirst", "announceSummary"],
          },
          // Every check settled valid: request the submission again, same submitter.
          { target: "idle", actions: ["resubmit"] },
        ],
      },
    },
    "awaiting-server": {
      on: {
        "ERRORS.PROP": {
          guard: "hasServerErrors",
          target: "idle",
          actions: ["markFailed", "focusFirstServer", "announceServerSummary"],
        },
      },
    },
  },
})

export type FormMachine = typeof formMachine
