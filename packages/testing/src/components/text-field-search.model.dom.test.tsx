// Model-based tests: the Search Field contract over the configurations of design §3
// (task 5.1), in every modality. Escape inside a Dialog is a scenario test (an empty
// field's Escape closes the Dialog, which ends the story).
import { platforms, textFieldContract, textFieldMessages } from "@rind-ui/core"
import { Field, RindProvider, TextField } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useState } from "react"
import { describe, it } from "vitest"
import {
  currentRun,
  installAnnouncementLog,
  testMachine,
  textFieldKeyStepInvariants,
} from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Config = {
  readonly controlled?: boolean
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly inField?: boolean
}

const START = "abc"
// The oracle runs the real machine, so it needs every prop the machine reads.
const base = {
  messages: textFieldMessages,
  id: "sf",
  clearInput: () => {},
  onSubmit: undefined,
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

let submits = 0
const keyInvariants = textFieldKeyStepInvariants({ submits: () => submits })
let stopKeys: () => void = () => {}

function Story({ cfg }: { cfg: Config }) {
  const [value, setValue] = useState(START)
  const root = {
    onSubmit: () => {
      submits += 1
    },
    ...(cfg.readOnly ? { readOnly: true } : {}),
    ...(cfg.disabled ? { disabled: true } : {}),
    ...(cfg.controlled ? { value, onValueChange: setValue } : { defaultValue: START }),
  }
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {cfg.inField ? (
        <Field.Root validationMode="change" validationBehavior="aria">
          <Field.Label>Search books</Field.Label>
          <TextField.Root type="search" {...root}>
            <TextField.Input minLength={3} />
            <TextField.ClearTrigger />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
      ) : (
        <TextField.Root type="search" {...root}>
          <TextField.Label>Search books</TextField.Label>
          <TextField.Input />
          <TextField.ClearTrigger />
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

type PartLike = {
  focus(): Promise<void>
  attr(name: string): Promise<string | null>
  compose(updates: readonly string[], commit?: string): Promise<void>
  type(text: string): Promise<void>
}
type EnvLike = { find(by: { role: string; name: string }): PartLike }
const field = (env: EnvLike) => env.find({ role: "searchbox", name: "Search books" })
// As Text Field's model: keyboard typing is a committed one-character composition on a part
// the runner's IME replay does not rewrite (see text-field.model.dom.test.tsx).
const keys = async (env: EnvLike, text: string) => {
  const c = field(env)
  await c.focus()
  const updates = [...text].map((_, i) => text.slice(0, i + 1))
  if ((await c.attr("data-composing")) !== null) await c.compose(updates)
  else await c.compose(updates, text)
}
const keyedContract = {
  ...textFieldContract,
  actions: {
    ...textFieldContract.actions,
    type: {
      ...textFieldContract.actions.type,
      pointer: async (env: EnvLike, text: string) => field(env).type(text),
      keyboard: keys,
    },
  },
} as unknown as typeof textFieldContract

function config(name: string, cfg: Config) {
  describe(`text-field search model: ${name}`, () => {
    testMachine(keyedContract, {
      test: it,
      invariants: keyInvariants.invariants,
      setup: () => {
        stopKeys()
        stopKeys = keyInvariants.reset()
        submits = 0
        return render(ui(cfg))
      },
      target: () => screen,
      anchor: [{ name: "Search books" }],
      props: {
        ...base,
        ...(cfg.disabled ? { disabled: true } : {}),
        ...(cfg.readOnly ? { readOnly: true } : {}),
        // Controlled, the story's parent applies every proposal: the oracle starts from START.
        defaultValue: START,
      } as never,
      a11y,
    })
  })
}

config("standalone with a ClearTrigger", {})
config("controlled, applying every proposal", { controlled: true })
config("read-only", { readOnly: true })
config("disabled", { disabled: true })
config("inside a Field with minLength", { inField: true })
