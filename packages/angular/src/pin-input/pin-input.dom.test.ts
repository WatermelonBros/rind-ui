// The Pin Input contract model (React's matrix) against the Angular parts, and markup parity.
import { Component, signal } from "@angular/core"
import {
  type PinValidationType,
  pinInputContract,
  pinInputMessages,
  platforms,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Field } from "../field/field"
import { RindProvider } from "../provider"
import { PinInput } from "./pin-input"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface Config {
  readonly length?: number
  readonly defaultValue?: string
  readonly validationType?: PinValidationType
  readonly sanitize?: (t: string) => string
  readonly mask?: boolean
  readonly autocomplete?: string
  readonly readonly?: boolean
  readonly disabled?: boolean
  readonly required?: boolean
  readonly controlled?: boolean
  readonly inField?: boolean
  readonly rtl?: boolean
  /** The parity tree (no form, no styles). */
  readonly plain?: boolean
}
const oracle = (cfg: Config) => ({
  length: cfg.length ?? 6,
  validationType: cfg.validationType,
  pattern: undefined,
  sanitize: cfg.sanitize,
  value: undefined,
  defaultValue: cfg.defaultValue ?? "12",
  onValueChange: undefined,
  onValueInvalid: undefined,
  onValueComplete: undefined,
  autoSubmit: undefined,
  disabled: undefined,
  readOnly: cfg.readonly,
  messages: pinInputMessages,
  id: "pin",
  writeCaret: () => {},
  resync: () => {},
  requestSubmit: undefined,
})
/** The configuration the next fixture renders. */
let current: Config = {}

const INPUTS = `[length]="length"
      [validationType]="cfg.validationType"
      [sanitize]="cfg.sanitize"
      [mask]="cfg.mask ?? false"
      [autocomplete]="cfg.autocomplete ?? 'one-time-code'"
      [readonly]="cfg.readonly ?? false"
      [disabled]="cfg.disabled ?? false"
      [required]="cfg.required ?? false"`
const CONTROL = `<div rindPinInputControl [style]="controlStyle">
        <input rindPinInputInput />
        @for (i of slots; track i) {
          <div rindPinInputSlot [index]="i" style="width: 40px; height: 40px"></div>
        }
      </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Field, PinInput],
  template: `<ng-container rindProvider [environment]="env">
    @if (cfg.plain) {
      <div rindPinInputRoot ${INPUTS} [defaultValue]="cfg.defaultValue ?? ''">
        <label rindPinInputLabel>Code</label>
        <div rindPinInputControl>
          <input rindPinInputInput />
          @for (i of slots; track i) {
            <div rindPinInputSlot [index]="i"></div>
          }
        </div>
      </div>
    } @else {
      <form (submit)="$event.preventDefault()" [attr.dir]="cfg.rtl ? 'rtl' : null">
        @if (cfg.inField) {
          <div rindFieldRoot>
            <label rindFieldLabel>Verification code</label>
            <div rindPinInputRoot ${INPUTS} [defaultValue]="start">
              ${CONTROL}
              <button type="reset">Reset</button>
            </div>
            <div rindFieldErrorMessage></div>
          </div>
        } @else if (cfg.controlled) {
          <div rindPinInputRoot ${INPUTS} [value]="value()" (valueChange)="value.set($event)">
            <label rindPinInputLabel>Verification code</label>
            ${CONTROL}
            <button type="reset">Reset</button>
          </div>
        } @else {
          <div rindPinInputRoot ${INPUTS} [defaultValue]="start">
            <label rindPinInputLabel>Verification code</label>
            ${CONTROL}
            <button type="reset">Reset</button>
          </div>
        }
      </form>
    }
  </ng-container>`,
})
class Code {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly cfg = current
  readonly length = current.length ?? (current.plain ? 4 : 6)
  readonly slots = Array.from({ length: this.length }, (_, i) => i)
  readonly start = current.defaultValue ?? "12"
  readonly value = signal(this.start)
  readonly controlStyle = { display: "flex", gap: "4px", width: `${this.length * 44}px` }
}

function config(name: string, cfg: Config) {
  describe(`angular pin-input model: ${name}`, () => {
    testMachine(pinInputContract, {
      test: it,
      setup: () => {
        current = cfg
        return mount(Code)
      },
      target: () => screen,
      anchor: [{ name: "Verification code" }],
      props: oracle(cfg) as never,
      a11y,
      ...(inJsdom ? { modalities: ["keyboard"] } : {}),
    } as never)
  })
}
config("numeric, length 6", {})
config("alphanumeric, uppercased", {
  validationType: "alphanumeric",
  sanitize: (t: string) => t.toUpperCase(),
  defaultValue: "AB",
})
config("masked PIN, length 4", { length: 4, mask: true, autocomplete: "off" })
config("controlled, applying every proposal", { controlled: true })
config("read-only", { readonly: true })
config("inside a Field with an ErrorMessage", { inField: true })
config("right-to-left page", { rtl: true })

describe("Angular Pin Input matches React", () => {
  it("numeric, masked, read-only, disabled, required", async () => {
    const reactTree = (p: Record<string, unknown>) =>
      r(
        R.PinInput.Root,
        { length: 4, ...p } as never,
        r(R.PinInput.Label, null, "Code"),
        r(
          R.PinInput.Control,
          null,
          r(R.PinInput.Input),
          [0, 1, 2, 3].map((i) => r(R.PinInput.Slot, { key: i, index: i })),
        ),
      )
    for (const [react, cfg] of [
      [{}, {}],
      [
        { defaultValue: "12", mask: true, autoComplete: "off" },
        { defaultValue: "12", mask: true, autocomplete: "off" },
      ],
      [
        { defaultValue: "1234", readOnly: true },
        { defaultValue: "1234", readonly: true },
      ],
      [
        { disabled: true, required: true },
        { disabled: true, required: true },
      ],
    ] as const) {
      current = { ...cfg, plain: true }
      await both(reactTree(react), Code)
    }
  })
})
