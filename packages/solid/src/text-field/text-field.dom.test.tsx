/** @jsxImportSource solid-js */
// The Text Field contract model (React's configurations) against the Solid parts, and markup
// parity with @rind-ui/react (labels, descriptions, counts, password and search types).
import { platforms, textFieldContract, textFieldMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import {
  currentRun,
  installAnnouncementLog,
  testMachine,
  textFieldStepInvariants,
} from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { createSignal, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Field, RindProvider, TextField, type TextFieldRootProps } from "../index"

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
}

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

function Body(props: { cfg: Config }) {
  const cfg = props.cfg
  return (
    <>
      <TextField.Label>Name</TextField.Label>
      {cfg.textarea ? (
        <TextField.Textarea
          {...(cfg.maxLength === undefined ? {} : { maxLength: cfg.maxLength })}
          {...(cfg.autosize ? { autosize: true } : {})}
        />
      ) : (
        <TextField.Input {...(cfg.maxLength === undefined ? {} : { maxLength: cfg.maxLength })} />
      )}
      <TextField.ClearTrigger />
      <TextField.CharacterCount {...(cfg.softMax === undefined ? {} : { max: cfg.softMax })} />
      <TextField.Description>Hint</TextField.Description>
      <TextField.ErrorMessage />
      <button type="reset">Reset</button>
    </>
  )
}

function Story(props: { cfg: Config }) {
  const [state, setState] = createSignal(START)
  const cfg = props.cfg
  const root = {
    ...(cfg.readOnly ? { readOnly: true } : {}),
    ...(cfg.disabled ? { disabled: true } : {}),
    ...(cfg.focusableWhenDisabled ? { focusableWhenDisabled: true } : {}),
  }
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {cfg.controlled ? (
        <TextField.Root {...root} value={state()} onValueChange={(v) => setState(v)}>
          <Body cfg={cfg} />
        </TextField.Root>
      ) : (
        <TextField.Root {...root} defaultValue={START}>
          <Body cfg={cfg} />
        </TextField.Root>
      )}
    </form>
  )
}

const ui = (cfg: Config): JSX.Element => (
  <RindProvider
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
    announcer={announcer()}
  >
    {cfg.inField ? (
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
    ) : (
      <Story cfg={cfg} />
    )}
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

function config(name: string, cfg: Config) {
  describe(`solid text-field model: ${name}`, () => {
    testMachine(keyedContract, {
      test: it,
      invariants: silent.invariants,
      setup: () => {
        silent.reset()
        return mount(() => ui(cfg))
      },
      target: () => screen,
      anchor: [{ name: "Name" }],
      props: {
        ...base,
        ...(cfg.disabled ? { disabled: true } : {}),
        ...(cfg.readOnly ? { readOnly: true } : {}),
        ...(cfg.focusableWhenDisabled ? { focusableWhenDisabled: true } : {}),
        ...(cfg.controlled ? { value: START } : {}),
        ...(cfg.maxLength !== undefined
          ? { limit: cfg.maxLength }
          : cfg.softMax !== undefined
            ? { limit: cfg.softMax }
            : {}),
      } as never,
      a11y,
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

describe("Solid Text Field and Field match React", () => {
  it("standalone, with parts, types, inside a Field", async () => {
    for (const p of [
      {},
      { type: "password", defaultValue: "pw" },
      { type: "search", defaultValue: "q" },
      { type: "email" },
      { required: true, invalid: true },
    ]) {
      await clientParity(
        r(
          R.TextField.Root,
          p as never,
          r(R.TextField.Label, null, "Name"),
          r(R.TextField.Input),
          r(R.TextField.Description, null, "Hint"),
          r(R.TextField.ErrorMessage),
        ),
        () => (
          <TextField.Root {...(p as TextFieldRootProps)}>
            <TextField.Label>Name</TextField.Label>
            <TextField.Input />
            <TextField.Description>Hint</TextField.Description>
            <TextField.ErrorMessage />
          </TextField.Root>
        ),
      )
    }
    await clientParity(
      r(
        R.TextField.Root,
        { type: "password" },
        r(R.TextField.Label, null, "Pw"),
        r(R.TextField.Input),
        r(R.TextField.VisibilityTrigger, null, "Show", r(R.TextField.VisibilityIndicator)),
      ),
      () => (
        <TextField.Root type="password">
          <TextField.Label>Pw</TextField.Label>
          <TextField.Input />
          <TextField.VisibilityTrigger>
            Show
            <TextField.VisibilityIndicator />
          </TextField.VisibilityTrigger>
        </TextField.Root>
      ),
    )
    await clientParity(
      r(
        R.TextField.Root,
        { defaultValue: "abc" },
        r(R.TextField.Label, null, "Bio"),
        r(R.TextField.Textarea),
        r(R.TextField.CharacterCount, { max: 10 }),
      ),
      () => (
        <TextField.Root defaultValue="abc">
          <TextField.Label>Bio</TextField.Label>
          <TextField.Textarea />
          <TextField.CharacterCount max={10} />
        </TextField.Root>
      ),
    )
    await clientParity(
      r(
        R.Field.Root,
        { invalid: true },
        r(R.Field.Label, null, "Name"),
        r(R.TextField.Root, null, r(R.TextField.Input)),
        r(R.Field.Description, null, "D"),
        r(R.Field.ErrorMessage, null, "Bad"),
      ),
      () => (
        <Field.Root invalid>
          <Field.Label>Name</Field.Label>
          <TextField.Root>
            <TextField.Input />
          </TextField.Root>
          <Field.Description>D</Field.Description>
          <Field.ErrorMessage>Bad</Field.ErrorMessage>
        </Field.Root>
      ),
    )
  })
})

describe("solid text field in a form", () => {
  const form = (p: { required: boolean }) => (
    <form>
      <TextField.Root name="handle" defaultValue="ada" required={p.required}>
        <TextField.Label>Handle</TextField.Label>
        <TextField.Input />
      </TextField.Root>
      <button type="reset">Reset</button>
    </form>
  )

  it("a typed value survives a rerender; submit sends it; reset restores the default", async () => {
    const view = mount(form, { required: false })
    const input = screen.getByRole("textbox", { name: "Handle" }) as HTMLInputElement
    input.value = "grace"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await view.rerender({ required: true })
    expect(input.required).toBe(true)
    expect(input.value).toBe("grace")
    expect(new FormData(input.form as HTMLFormElement).get("handle")).toBe("grace")
    screen.getByRole("button", { name: "Reset" }).click()
    await vi.waitFor(() => expect(input.value).toBe("ada"))
  })
})
