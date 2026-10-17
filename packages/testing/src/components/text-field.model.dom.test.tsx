// Model-based tests: the Text Field contract over the configurations of design §6, and
// broken variants that must fail readably (tasks 6.1, 6.2).
import { platforms, textFieldContract, textFieldMessages } from "@rind-ui/core"
import { Field, RindProvider, TextField } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useLayoutEffect, useRef, useState } from "react"
import { describe, expect, it } from "vitest"
import {
  currentRun,
  domEnv,
  installAnnouncementLog,
  testMachine,
  textFieldStepInvariants,
} from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Config = {
  readonly textarea?: boolean
  readonly autosize?: boolean
  readonly maxLength?: number
  readonly softMax?: number
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly focusableWhenDisabled?: boolean
  readonly controlled?: boolean
  readonly inField?: boolean
  readonly value?: string | undefined
}

// The oracle runs the real machine, so it needs every prop the machine reads.
/** A non-empty start: the ClearTrigger exists (the contract's CLEAR guard ignores emptiness). */
const START = "abc"
const base = {
  messages: textFieldMessages,
  id: "tf",
  escapeClears: undefined,
  onSubmit: undefined,
  clearInput: () => {},
  disabled: undefined,
  readOnly: undefined,
  focusableWhenDisabled: undefined,
  limit: undefined,
  threshold: undefined,
  count: undefined,
  value: undefined,
  onValueChange: undefined,
} as const

const announcer = () => {
  const log = installAnnouncementLog()
  return {
    announce: (a: (typeof log)[number]) => {
      log.push(a)
    },
    prepare: () => () => {},
    cancel: () => {},
  }
}

function Story({ cfg }: { cfg: Config }) {
  const Control = cfg.textarea ? TextField.Textarea : TextField.Input
  const extra = cfg.textarea && cfg.autosize ? { autosize: true } : {}
  const body = (
    <>
      <TextField.Label>Name</TextField.Label>
      <Control {...(cfg.maxLength === undefined ? {} : { maxLength: cfg.maxLength })} {...extra} />
      <TextField.ClearTrigger />
      <TextField.CharacterCount {...(cfg.softMax === undefined ? {} : { max: cfg.softMax })} />
      <TextField.Description>Hint</TextField.Description>
      <TextField.ErrorMessage />
      {/* Inside the Root: the runner's "focus stays in the component" sees a reset as inside. */}
      <button type="reset">Reset</button>
    </>
  )
  const root = {
    ...(cfg.readOnly ? { readOnly: true } : {}),
    ...(cfg.disabled ? { disabled: true } : {}),
    ...(cfg.focusableWhenDisabled ? { focusableWhenDisabled: true } : {}),
  }
  const [state, setState] = useState(START)
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {cfg.inField ? (
        <Field.Root validationMode="change">
          <TextField.Root {...root} defaultValue={START}>
            {body}
          </TextField.Root>
        </Field.Root>
      ) : cfg.controlled ? (
        <TextField.Root {...root} value={state} onValueChange={setState}>
          {body}
        </TextField.Root>
      ) : (
        <TextField.Root {...root} defaultValue={START}>
          {body}
        </TextField.Root>
      )}
    </form>
  )
}

const ui = (cfg: Config) => (
  <RindProvider
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
    announcer={announcer()}
  >
    <Story cfg={cfg} />
  </RindProvider>
)

/** The Field's own label-less variant: the story labels itself through the inner Label. */
const inFieldUi = () => (
  <RindProvider
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
    announcer={announcer()}
  >
    <form onSubmit={(e) => e.preventDefault()}>
      <Field.Root validationMode="change">
        <Field.Label>Name</Field.Label>
        <TextField.Root defaultValue={START}>
          <TextField.Input />
          <TextField.ClearTrigger />
          <button type="reset">Reset</button>
        </TextField.Root>
        <Field.ErrorMessage />
      </Field.Root>
    </form>
  </RindProvider>
)

/**
 * The runner replays every `type` on a text part as an IME composition and expects nothing to
 * change (ime-never-commits). For a Text Field a composition legitimately changes value,
 * count and description, so the text-entry actions are re-expressed as single key presses
 * (which that replay drops). See the report.
 */
type PartLike = {
  press(key: string): Promise<void>
  exists(): Promise<boolean>
  compose(updates: readonly string[], commit?: string): Promise<void>
  attr(name: string): Promise<string | null>
  click(): Promise<void>
  type(text: string): Promise<void>
  focus(): Promise<void>
}
type EnvLike = {
  part(name: string): PartLike
  find(by: { role: string; name: string }): PartLike
}
const textbox = (env: EnvLike) => env.find({ role: "textbox", name: "Name" })
// Keyboard typing cannot be driven by the shipped contract (see the report): `Part.type`
// clicks first (pointer modality: no data-focus-visible after a keyboard step), and
// `press` only knows a closed key set. A committed one-character composition is the
// keyboard path; `find` is not rewritten by the runner's IME replay (a composition there
// is a value change, which ime-never-commits forbids).
const keys = async (env: EnvLike, text: string) => {
  const c = textbox(env)
  await c.focus()
  const updates = [...text].map((_, i) => text.slice(0, i + 1))
  // Inside an open composition an INPUT is one more update; it stays open (state composing).
  if ((await c.attr("data-composing")) !== null) await c.compose(updates)
  else await c.compose(updates, text)
}

// Only the `type` override remains: the shipped keyboard `type` clicks first (pointer
// modality, so no data-focus-visible after a keyboard step) and the runner replays every
// `type` as an IME composition that must change nothing, which a Text Field legitimately does.
const keyedContract = {
  ...textFieldContract,
  events: {
    ...textFieldContract.events,
    "VISIBILITY.TOGGLE": { skip: "a plain field renders no VisibilityTrigger (password tests)" },
    "VISIBILITY.HIDE": { skip: "a plain field has no visibility (password tests)" },
  },
  actions: {
    ...textFieldContract.actions,
    type: {
      ...textFieldContract.actions.type,
      pointer: async (env: EnvLike, text: string) => textbox(env).type(text),
      keyboard: keys,
    },
  },
} as unknown as typeof textFieldContract

const silent = textFieldStepInvariants()

function config(name: string, cfg: Config, extra: Record<string, unknown> = {}) {
  describe(`text-field model: ${name}`, () => {
    testMachine(keyedContract, {
      test: it,
      invariants: silent.invariants,
      setup: () => {
        silent.reset()
        return render(cfg.inField ? inFieldUi() : ui(cfg))
      },
      target: () => screen,
      anchor: [{ name: "Name" }],
      props: {
        ...base,
        ...(cfg.disabled ? { disabled: true } : {}),
        ...(cfg.readOnly ? { readOnly: true } : {}),
        ...(cfg.focusableWhenDisabled ? { focusableWhenDisabled: true } : {}),
        // The parent applies each proposal itself (state in the story): no prop steps.
        ...(cfg.controlled ? { value: START } : {}),
        ...(cfg.maxLength !== undefined
          ? { limit: cfg.maxLength }
          : cfg.softMax !== undefined
            ? { limit: cfg.softMax }
            : {}),
      } as never,
      a11y,
      ...extra,
    })
  })
}

config("uncontrolled", {})
config("controlled, applying every proposal", { controlled: true })
config("textarea with autosize", { textarea: true, autosize: true })
config("with maxLength", { maxLength: 8 })
config("with a soft max", { softMax: 8 })
config("read-only", { readOnly: true })
config("focusable-disabled", { disabled: true, focusableWhenDisabled: true })
config("inside a Field, validationMode change", { inField: true })

// ---- 6.2: broken variants fail with a readable report naming the invariant ---------------

/** `input` events that left the field empty: one per Clear, none from typing or composing. */
let emptyInputs = 0
const clearActivations = { action: "clear", count: () => emptyInputs }

/** The exported invariants; the story's text is "abc", composing "かな" and typing "x" add to it. */
const composed = textFieldStepInvariants({ composedText: /^[abcかなx]*$/ })

/** Implicit submissions of the story's form (Enter in the input), recorded, never navigating. */
let submits = 0
/** A story frame: a form counting empty `input` events, with a Reset button inside the Root. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <RindProvider announcer={announcer()}>
      <form
        // Enter (the SUBMIT edge) submits implicitly: a real submit would reload the frame.
        onSubmit={(e) => {
          e.preventDefault()
          submits += 1
        }}
        onInput={(e) => {
          if ((e.target as HTMLInputElement).value === "") emptyInputs += 1
        }}
      >
        <TextField.Root defaultValue={START} {...frameRoot.current}>
          <TextField.Label>Name</TextField.Label>
          {children}
          <button type="reset">Reset</button>
        </TextField.Root>
      </form>
    </RindProvider>
  )
}
const frameRoot: { current: { readOnly?: boolean } } = { current: {} }

/** A ClearTrigger impostor: same data attributes (instance copied from the Root), no guard. */
function AlwaysClear() {
  const el = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const instance = el.current?.closest("[data-part=root]")?.getAttribute("data-instance")
    if (instance) el.current?.setAttribute("data-instance", instance)
  }, [])
  return (
    <button
      ref={el}
      type="button"
      data-scope="text-field"
      data-part="clear-trigger"
      aria-label="Clear"
    />
  )
}

/** Runs the model with `test` collecting instead of registering; returns each path's error. */
async function failuresOf(
  story: () => React.ReactElement,
  props: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  silent.reset()
  testMachine(keyedContract, {
    test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
    setup: () => {
      emptyInputs = 0
      return render(story())
    },
    target: () => domEnv({ timeout: 200 }),
    anchor: [{ name: "Name" }],
    props: { ...base, ...props } as never,
    invariants: composed.invariants,
    modalities: ["keyboard"],
    ...extra,
  } as never)
  const out: { name: string; error: string | null }[] = []
  for (const t of tests) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    document.body.innerHTML = ""
    installAnnouncementLog().length = 0
    out.push({ name: t.name, error })
  }
  return out
}

/** The paths that failed for the named invariant (a missing Reset button is not a finding). */
const named = (results: { error: string | null }[], invariant: string) =>
  results.filter((r) => r.error?.includes(invariant))

describe("a correct Text Field passes the same checks", () => {
  it("no failure", { timeout: 60_000 }, async () => {
    frameRoot.current = {}
    const results = await failuresOf(
      () => (
        <Frame>
          <TextField.Input />
          <TextField.ClearTrigger />
        </Frame>
      ),
      {},
      { activations: clearActivations },
    )
    expect(results.filter((r) => r.error !== null)).toEqual([])
    // Enter reached the form (implicit submission), recorded without navigating the frame.
    expect(submits).toBeGreaterThan(0)
  })
})

describe("broken Text Fields fail with the invariant's name", () => {
  it("writes the value during composition (kobalte#737)", { timeout: 60_000 }, async () => {
    frameRoot.current = {}
    const results = await failuresOf(
      () => (
        <Frame>
          <TextField.Input
            // Broken: rewrites the DOM value on every composing input.
            onInput={(e) => {
              if ((e.nativeEvent as InputEvent).isComposing) e.currentTarget.value += "!"
            }}
          />
        </Frame>
      ),
      {},
    )
    expect(named(results, "text-field-value-only-from-composition").length).toBeGreaterThan(0)
  })

  it("announces while composing", { timeout: 60_000 }, async () => {
    frameRoot.current = {}
    const results = await failuresOf(
      () => (
        <Frame>
          <TextField.Input
            // Broken: speaks on every composing input.
            onInput={(e) => {
              if ((e.nativeEvent as InputEvent).isComposing)
                installAnnouncementLog().push({
                  message: "1 character remaining",
                  priority: "polite",
                })
            }}
          />
        </Frame>
      ),
      {},
    )
    expect(named(results, "text-field-silent-while-composing").length).toBeGreaterThan(0)
  })

  it("renders a ClearTrigger while read-only", { timeout: 60_000 }, async () => {
    frameRoot.current = { readOnly: true }
    const results = await failuresOf(
      () => (
        <Frame>
          <TextField.Input />
          <AlwaysClear />
        </Frame>
      ),
      { readOnly: true },
    )
    frameRoot.current = {}
    expect(named(results, "text-field-clear-trigger-when-clearable").length).toBeGreaterThan(0)
  })

  it("synthesizes a second input on a programmatic write (a Clear)", {
    timeout: 60_000,
  }, async () => {
    frameRoot.current = {}
    const results = await failuresOf(
      () => (
        <Frame>
          <TextField.Input
            // Broken: a Clear's input event is followed by a second one.
            onChange={(e) => {
              const el = e.currentTarget
              if (el.value === "")
                queueMicrotask(() => el.dispatchEvent(new Event("input", { bubbles: true })))
            }}
          />
          <TextField.ClearTrigger />
        </Frame>
      ),
      {},
      { activations: clearActivations },
    )
    expect(results.filter((r) => r.error?.includes("activation-parity")).length).toBeGreaterThan(0)
  })
})
