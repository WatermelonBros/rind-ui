// The Toggle contract's model-based test, unchanged from React's, against the Angular parts.
import { Component, input, signal } from "@angular/core"
import { platforms, toggleContract } from "@rind-ui/core"
import { currentRun, getToggle, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { Toggle } from "./toggle"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const base = { pressed: undefined, defaultPressed: undefined, onPressedChange: undefined }
const anchor = [{ name: "Bold" }] as never
const platform = () => ({ platform: currentRun()?.platform ?? platforms.linux })

@Component({
  imports: [RindProvider, Toggle],
  template: `<ng-container rindProvider [environment]="env"><button rindToggleRoot>Bold</button></ng-container>`,
})
class Uncontrolled {
  readonly env = platform()
}

@Component({
  imports: [RindProvider, Toggle],
  template: `<ng-container rindProvider [environment]="env">
    <button rindToggleRoot defaultPressed>Bold</button>
  </ng-container>`,
})
class StartingOn {
  readonly env = platform()
}

@Component({
  imports: [RindProvider, Toggle],
  template: `<ng-container rindProvider [environment]="env">
    <button rindToggleRoot [pressed]="pressed()">Bold</button>
  </ng-container>`,
})
class Controlled {
  readonly env = platform()
  readonly pressed = input(false)
}

describe("angular toggle model: uncontrolled", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => mount(Uncontrolled),
    target: () => screen,
    anchor,
    props: base as never,
    a11y,
  })
})

describe("angular toggle model: starting on", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => mount(StartingOn),
    target: () => screen,
    anchor,
    props: { ...base, defaultPressed: true } as never,
    a11y,
  })
})

describe("angular toggle model: controlled ([pressed])", () => {
  testMachine(toggleContract, {
    test: it,
    setup: () => mount(Controlled, { pressed: false }),
    rerender: (next, rendered) =>
      rendered.rerender({ pressed: (next as { pressed: boolean }).pressed }),
    target: () => screen,
    anchor,
    props: { ...base, pressed: false } as never,
    a11y,
  })
})

@Component({
  imports: [Toggle],
  template: `<a
    href="#"
    class="mine"
    data-variant="outline"
    rindToggleRoot
    #t="rindToggleRoot"
    [(pressed)]="pressed"
    (pressedChangeDetails)="propose($event.value, $event.details)"
    (click)="clicks = clicks + 1"
  >Bold <span rindToggleIndicator>@if (t.state().pressed) {on} @else {off}</span></a>`,
})
class Parts {
  readonly pressed = signal(false)
  readonly changes: boolean[] = []
  veto = false
  clicks = 0
  propose(value: boolean, details: { cancel(): void }) {
    this.changes.push(value)
    if (this.veto) details.cancel()
  }
}

describe("angular toggle parts", () => {
  it("[(pressed)], cancel vetoes, any host element keeps behaviour, indicator follows", async () => {
    const { ref } = await mount(Parts)
    const t = getToggle(screen, { name: /Bold/ })
    const el = screen.getByRole("button", { name: /Bold/ })
    expect(el.tagName).toBe("A")
    expect(el.getAttribute("data-variant")).toBe("outline")
    expect(el.classList.contains("mine")).toBe(true)
    await t.setPressed(true)
    await vi.waitFor(() => expect(el.getAttribute("aria-pressed")).toBe("true"))
    expect(ref.instance.pressed()).toBe(true)
    await vi.waitFor(() => expect(el.textContent).toContain("on"))
    ref.instance.veto = true
    el.click()
    await Promise.resolve()
    expect(el.getAttribute("aria-pressed")).toBe("true")
    expect(ref.instance.changes).toEqual([true, false])
    expect(ref.instance.clicks).toBeGreaterThan(0)
  })
})
