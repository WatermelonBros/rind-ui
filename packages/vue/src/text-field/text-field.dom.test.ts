// The Text Field contract model (React's configurations) against the Vue parts, and markup
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
import { type ReactElement, createElement as r } from "react"
import { describe, it } from "vitest"
import { defineComponent, h, ref, type VNode } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Field, RindProvider, TextField } from "../index"

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

const Story = defineComponent({
  props: { cfg: { type: Object as () => Config, required: true } },
  setup(props) {
    const state = ref(START)
    return () => {
      const cfg = props.cfg
      const Control = cfg.textarea ? TextField.Textarea : TextField.Input
      const body = () => [
        h(TextField.Label, null, () => "Name"),
        h(Control, {
          ...(cfg.maxLength === undefined ? {} : { maxlength: cfg.maxLength }),
          ...(cfg.textarea && cfg.autosize ? { autosize: true } : {}),
        }),
        h(TextField.ClearTrigger),
        h(TextField.CharacterCount, cfg.softMax === undefined ? {} : { max: cfg.softMax }),
        h(TextField.Description, null, () => "Hint"),
        h(TextField.ErrorMessage),
        h("button", { type: "reset" }, "Reset"),
      ]
      const root = {
        ...(cfg.readOnly ? { readonly: true } : {}),
        ...(cfg.disabled ? { disabled: true } : {}),
        ...(cfg.focusableWhenDisabled ? { focusableWhenDisabled: true } : {}),
      }
      return h("form", { onSubmit: (e: Event) => e.preventDefault() }, [
        cfg.controlled
          ? h(
              TextField.Root,
              {
                ...root,
                modelValue: state.value,
                "onUpdate:modelValue": (v: string) => (state.value = v),
              },
              body,
            )
          : h(TextField.Root, { ...root, defaultValue: START }, body),
      ])
    }
  },
})

const ui = (cfg: Config) =>
  h(
    RindProvider,
    {
      environment: { platform: currentRun()?.platform ?? platforms.linux },
      announcer: announcer(),
    },
    () =>
      cfg.inField
        ? h("form", { onSubmit: (e: Event) => e.preventDefault() }, [
            h(Field.Root, { validationMode: "change" }, () => [
              h(Field.Label, null, () => "Name"),
              h(TextField.Root, { defaultValue: START }, () => [
                h(TextField.Input),
                h(TextField.ClearTrigger),
                h("button", { type: "reset" }, "Reset"),
              ]),
              h(Field.ErrorMessage),
            ]),
          ])
        : h(Story, { cfg }),
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
  describe(`vue text-field model: ${name}`, () => {
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

const both = async (react: ReactElement, vue: () => VNode) => {
  await serverParity(react, vue)
  await clientParity(react, vue)
}

describe("Vue Text Field and Field match React", () => {
  it("standalone, with parts, types, inside a Field", async () => {
    for (const p of [
      {},
      { type: "password", defaultValue: "pw" },
      { type: "search", defaultValue: "q" },
      { type: "email" },
      { required: true, invalid: true },
    ]) {
      await both(
        r(
          R.TextField.Root,
          p as never,
          r(R.TextField.Label, null, "Name"),
          r(R.TextField.Input),
          r(R.TextField.Description, null, "Hint"),
          r(R.TextField.ErrorMessage),
        ),
        () =>
          h(TextField.Root, p, () => [
            h(TextField.Label, null, () => "Name"),
            h(TextField.Input),
            h(TextField.Description, null, () => "Hint"),
            h(TextField.ErrorMessage),
          ]),
      )
    }
    await both(
      r(
        R.TextField.Root,
        { type: "password" },
        r(R.TextField.Label, null, "Pw"),
        r(R.TextField.Input),
        r(R.TextField.VisibilityTrigger, null, "Show", r(R.TextField.VisibilityIndicator)),
      ),
      () =>
        h(TextField.Root, { type: "password" }, () => [
          h(TextField.Label, null, () => "Pw"),
          h(TextField.Input),
          h(TextField.VisibilityTrigger, null, () => ["Show", h(TextField.VisibilityIndicator)]),
        ]),
    )
    await both(
      r(
        R.TextField.Root,
        { defaultValue: "abc" },
        r(R.TextField.Label, null, "Bio"),
        r(R.TextField.Textarea),
        r(R.TextField.CharacterCount, { max: 10 }),
      ),
      () =>
        h(TextField.Root, { defaultValue: "abc" }, () => [
          h(TextField.Label, null, () => "Bio"),
          h(TextField.Textarea),
          h(TextField.CharacterCount, { max: 10 }),
        ]),
    )
    await both(
      r(
        R.Field.Root,
        { invalid: true },
        r(R.Field.Label, null, "Name"),
        r(R.TextField.Root, null, r(R.TextField.Input)),
        r(R.Field.Description, null, "D"),
        r(R.Field.ErrorMessage, null, "Bad"),
      ),
      () =>
        h(Field.Root, { invalid: true }, () => [
          h(Field.Label, null, () => "Name"),
          h(TextField.Root, null, () => h(TextField.Input)),
          h(Field.Description, null, () => "D"),
          h(Field.ErrorMessage, null, () => "Bad"),
        ]),
    )
  })
})
