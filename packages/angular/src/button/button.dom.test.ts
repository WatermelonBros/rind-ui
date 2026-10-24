// The Button contract's model-based test, with React's variants, against the Angular Button.
import { Component, input } from "@angular/core"
import { buttonContract, platforms } from "@rind-ui/core"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { Button } from "./button"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

let presses = 0
const activations = { action: "notifyPress", count: () => presses }
const platform = () => ({ platform: currentRun()?.platform ?? platforms.linux })

@Component({
  imports: [RindProvider, Button],
  template: `<ng-container rindProvider [environment]="env">
    <button
      rindButton
      [type]="type()"
      [disabled]="disabled()"
      [focusableWhenDisabled]="focusableWhenDisabled()"
      [pending]="pending()"
      (press)="pressed()"
    >Save</button>
  </ng-container>`,
})
class Fixture {
  readonly env = platform()
  readonly type = input<"button" | "submit" | "reset">()
  readonly disabled = input(false)
  readonly focusableWhenDisabled = input(false)
  readonly pending = input(false)
  pressed() {
    presses += 1
  }
}

@Component({
  imports: [RindProvider, Button],
  template: `<ng-container rindProvider [environment]="env">
    <div rindButton (press)="pressed()">Save</div>
  </ng-container>`,
})
class OnDiv {
  readonly env = platform()
  pressed() {
    presses += 1
  }
}

const runs = {
  directions: ["ltr", "rtl"] as const,
  platforms: [platforms.apple, platforms.windows],
}
const base = { disabled: undefined, pending: undefined }
const anchor = [{ name: "Save" }] as never
type Props = Record<string, unknown>

function variant(
  name: string,
  props: Props,
  extra = {},
  fixture: typeof Fixture | typeof OnDiv = Fixture,
) {
  describe(`angular button model: ${name}`, () => {
    testMachine(buttonContract, {
      test: it,
      setup: () => mount(fixture, fixture === Fixture ? props : {}),
      activations,
      target: () => screen,
      anchor,
      props: { ...base, ...props } as never,
      a11y,
      ...extra,
    })
  })
}

variant("default", {}, runs)
variant("submit", { type: "submit" })
variant("reset", { type: "reset" })
variant("disabled", { disabled: true })
variant("focusableWhenDisabled", { disabled: true, focusableWhenDisabled: true })
variant("pending", { pending: true })
variant("on a div", {}, {}, OnDiv)

describe("angular button model: pending edges through rerender ($sync:pending)", () => {
  testMachine(buttonContract, {
    test: it,
    setup: () => mount(Fixture, { pending: false }),
    rerender: (next, rendered) =>
      rendered.rerender({ pending: (next as { pending?: boolean }).pending ?? false }),
    target: () => screen,
    anchor,
    props: { ...base, pending: false } as never,
    a11y,
    modalities: ["keyboard", "pointer"],
  })
})

@Component({ imports: [Button], template: `<a rindButton href="/docs">Docs</a>` })
class Link {}

describe("angular button", () => {
  it("<a rindButton href>: a link that keeps link semantics", async () => {
    await mount(Link)
    const link = screen.getByRole("link", { name: "Docs" })
    expect(link.getAttribute("href")).toBe("/docs")
    expect(link.getAttribute("data-scope")).toBe("button")
  })
})
