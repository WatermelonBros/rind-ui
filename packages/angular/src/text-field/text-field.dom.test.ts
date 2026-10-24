// The Text Field contract model (React's configurations) against the Angular parts, and markup
// parity with @rind-ui/react (labels, descriptions, counts, password and search types).
import { Component, signal } from "@angular/core"
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
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Field } from "../field/field"
import { RindProvider } from "../provider"
import { TextField } from "./text-field"

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

/** The configuration the next fixture renders. */
let current: Config = {}

@Component({
  imports: [RindProvider, Field, TextField],
  template: `<ng-container rindProvider [environment]="env" [announcer]="announce">
    @if (cfg.inField) {
      <form (submit)="$event.preventDefault()">
        <div rindFieldRoot validationMode="change">
          <label rindFieldLabel>Name</label>
          <div rindTextFieldRoot [defaultValue]="start">
            <input rindTextFieldInput />
            <button rindTextFieldClearTrigger></button>
            <button type="reset">Reset</button>
          </div>
          <p rindFieldErrorMessage></p>
        </div>
      </form>
    } @else {
      <form (submit)="$event.preventDefault()">
        <div
          rindTextFieldRoot
          [readonly]="cfg.readOnly ?? false"
          [disabled]="cfg.disabled ?? false"
          [focusableWhenDisabled]="cfg.focusableWhenDisabled ?? false"
          [value]="cfg.controlled ? state() : undefined"
          [defaultValue]="cfg.controlled ? undefined : start"
          (valueChange)="state.set($event)"
        >
          <label rindTextFieldLabel>Name</label>
          @if (cfg.textarea) {
            <textarea rindTextFieldTextarea [autosize]="cfg.autosize ?? false"></textarea>
          } @else if (cfg.maxLength !== undefined) {
            <input rindTextFieldInput maxlength="8" />
          } @else {
            <input rindTextFieldInput />
          }
          <button rindTextFieldClearTrigger></button>
          <span rindTextFieldCharacterCount [max]="cfg.softMax"></span>
          <p rindTextFieldDescription>Hint</p>
          <p rindTextFieldErrorMessage></p>
          <button type="reset">Reset</button>
        </div>
      </form>
    }
  </ng-container>`,
})
class Story {
  readonly cfg = current
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly announce = announcer()
  readonly start = START
  readonly state = signal(START)
}

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
// Keyboard typing as a committed composition: the shipped keyboard `type` clicks first
// (pointer modality) and the runner replays every `type` as an IME composition (see Vue's).
const keys = async (env: EnvLike, text: string) => {
  const c = textbox(env)
  await c.focus()
  const updates = [...text].map((_, i) => text.slice(0, i + 1))
  // Inside an open composition an INPUT is one more update; it stays open (state composing).
  if ((await c.attr("data-composing")) !== null) await c.compose(updates)
  else await c.compose(updates, text)
}

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
  describe(`angular text-field model: ${name}`, () => {
    testMachine(keyedContract, {
      test: it,
      invariants: silent.invariants,
      setup: () => {
        silent.reset()
        current = cfg
        return mount(Story)
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

type Root = { type?: string; defaultValue?: string; required?: boolean; invalid?: boolean }
let root: Root = {}

@Component({
  selector: "rind-f",
  imports: [TextField],
  template: `<div
    rindTextFieldRoot
    [type]="p.type"
    [defaultValue]="p.defaultValue"
    [required]="p.required ?? false"
    [invalid]="p.invalid"
  >
    <label rindTextFieldLabel>Name</label><input rindTextFieldInput />
    <p rindTextFieldDescription>Hint</p><p rindTextFieldErrorMessage></p>
  </div>`,
})
class Parts {
  readonly p = root
}
@Component({
  selector: "rind-f",
  imports: [TextField],
  template: `<div rindTextFieldRoot type="password">
    <label rindTextFieldLabel>Pw</label><input rindTextFieldInput />
    <button rindTextFieldVisibilityTrigger>Show<span rindTextFieldVisibilityIndicator></span></button>
  </div>`,
})
class Password {}
@Component({
  selector: "rind-f",
  imports: [TextField],
  template: `<div rindTextFieldRoot defaultValue="abc">
    <label rindTextFieldLabel>Bio</label><textarea rindTextFieldTextarea></textarea>
    <span rindTextFieldCharacterCount [max]="10"></span>
  </div>`,
})
class Bio {}
@Component({
  selector: "rind-f",
  imports: [Field, TextField],
  template: `<div rindFieldRoot [invalid]="true">
    <label rindFieldLabel>Name</label>
    <div rindTextFieldRoot><input rindTextFieldInput /></div>
    <p rindFieldDescription>D</p><p rindFieldErrorMessage>Bad</p>
  </div>`,
})
class InField {}

describe("Angular Text Field and Field match React", () => {
  it("standalone, with parts, types, inside a Field", async () => {
    const roots: Root[] = [
      {},
      { type: "password", defaultValue: "pw" },
      { type: "search", defaultValue: "q" },
      { type: "email" },
      { required: true, invalid: true },
    ]
    for (const p of roots) {
      root = p
      await both(
        r(
          R.TextField.Root,
          p as never,
          r(R.TextField.Label, null, "Name"),
          r(R.TextField.Input),
          r(R.TextField.Description, null, "Hint"),
          r(R.TextField.ErrorMessage),
        ),
        Parts,
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
      Password,
    )
    await both(
      r(
        R.TextField.Root,
        { defaultValue: "abc" },
        r(R.TextField.Label, null, "Bio"),
        r(R.TextField.Textarea),
        r(R.TextField.CharacterCount, { max: 10 }),
      ),
      Bio,
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
      InField,
    )
  })
})
