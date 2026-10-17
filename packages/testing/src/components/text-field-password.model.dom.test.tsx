// Model-based tests: the Password Input contract over the configurations of design §4
// (task 5.1), in every modality.
import { platforms, textFieldContract, textFieldMessages } from "@rind-ui/core"
import { Field, RindProvider, TextField } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useState } from "react"
import { describe, it } from "vitest"
import { currentRun, installAnnouncementLog, testMachine } from "../index"

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
  readonly newPassword?: boolean
}

const START = "abc"
// The oracle runs the real machine, so it needs every prop the machine reads.
const base = {
  messages: textFieldMessages,
  id: "pw",
  clearInput: () => {},
  keepSelection: () => {},
  watchForm: undefined,
  disabled: undefined,
  readOnly: undefined,
  focusableWhenDisabled: undefined,
  limit: undefined,
  threshold: undefined,
  count: undefined,
  value: undefined,
  onValueChange: undefined,
  visible: undefined,
  defaultVisible: undefined,
  onVisibleChange: undefined,
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
  const [visible, setVisible] = useState(false)
  const root = {
    defaultValue: START,
    ...(cfg.readOnly ? { readOnly: true } : {}),
    ...(cfg.disabled ? { disabled: true } : {}),
    ...(cfg.controlled ? { visible, onVisibleChange: setVisible } : {}),
  }
  const parts = (
    <>
      <TextField.Input {...(cfg.newPassword ? { autoComplete: "new-password" } : {})} />
      <TextField.VisibilityTrigger>
        <TextField.VisibilityIndicator />
      </TextField.VisibilityTrigger>
      {/* Inside the Root: the runner's "focus stays in the component" sees them as inside. */}
      <button type="submit">Submit</button>
      <button type="reset">Reset</button>
    </>
  )
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {cfg.inField ? (
        // aria validation: the form still submits (the hide-on-submit path), the error shows.
        <Field.Root invalid validationBehavior="aria">
          <Field.Label>Password</Field.Label>
          <TextField.Root type="password" {...root}>
            {parts}
          </TextField.Root>
          <Field.ErrorMessage>Wrong password</Field.ErrorMessage>
        </Field.Root>
      ) : (
        <TextField.Root type="password" {...root}>
          <TextField.Label>Password</TextField.Label>
          {parts}
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
type EnvLike = { find(by: { label: string }): PartLike }
const field = (env: EnvLike) => env.find({ label: "Password" })
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
  describe(`text-field password model: ${name}`, () => {
    testMachine(keyedContract, {
      test: it,
      setup: () => render(ui(cfg)),
      target: () => screen,
      anchor: [{ name: "Password" }],
      props: {
        ...base,
        ...(cfg.disabled ? { disabled: true } : {}),
        ...(cfg.readOnly ? { readOnly: true } : {}),
        // Controlled, the story's parent applies every proposal: the oracle runs uncontrolled.
      } as never,
      a11y,
    })
  })
}

config("uncontrolled", {})
config("controlled, applying every proposal", { controlled: true })
config("new-password", { newPassword: true })
config("read-only (toggle allowed)", { readOnly: true })
config("disabled (toggle refused)", { disabled: true })
config("inside an invalid Field, in a form with submit and reset", { inField: true })
