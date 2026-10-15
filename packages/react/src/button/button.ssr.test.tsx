// The server render carries every Button attribute (openspec button-like-element, no DOM here).
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Button } from "../index"

const html = (node: React.ReactNode) => renderToString(node)

describe("Button server render", () => {
  it("enabled: a native button of type button, no role or aria-disabled", () => {
    const out = html(<Button>Save</Button>)
    expect(out).toMatch(/^<button /)
    expect(out).toContain('type="button"')
    expect(out).toContain('data-scope="button"')
    expect(out).toContain('data-part="root"')
    expect(out).toContain('data-state="idle"')
    expect(out).not.toMatch(/role=|aria-disabled|disabled|data-pending|data-disabled/)
  })

  it("keeps type submit and reset", () => {
    expect(html(<Button type="submit">S</Button>)).toContain('type="submit"')
    expect(html(<Button type="reset">S</Button>)).toContain('type="reset"')
  })

  it("disabled: the HTML already has disabled (base-ui#1843)", () => {
    const out = html(<Button disabled>Save</Button>)
    expect(out).toMatch(/ disabled=""/)
    expect(out).toContain("data-disabled")
    expect(out).not.toContain("aria-disabled")
  })

  it("focusableWhenDisabled: aria-disabled, no disabled attribute", () => {
    const out = html(
      <Button disabled focusableWhenDisabled>
        Save
      </Button>,
    )
    expect(out).toContain('aria-disabled="true"')
    expect(out).not.toMatch(/ disabled=/)
  })

  it("pending: data-state pending, aria-disabled, no native disabled, submit becomes button", () => {
    const out = html(
      <Button type="submit" pending>
        Save
      </Button>,
    )
    expect(out).toContain('data-state="pending"')
    expect(out).toContain("data-pending")
    expect(out).toContain('aria-disabled="true"')
    expect(out).toContain('type="button"')
    expect(out).not.toMatch(/ disabled=/)
    expect(out).toContain("data-disabled")
  })

  it("render <a href>: link, no type, no role", () => {
    const out = html(
      <Button render={<a href="/docs" />} type="submit">
        Docs
      </Button>,
    )
    expect(out).toMatch(/^<a /)
    expect(out).toContain('href="/docs"')
    expect(out).not.toMatch(/ type=|role=|aria-disabled/)
  })

  it("disabled render <a href>: no href, role link, aria-disabled, tabindex -1", () => {
    const out = html(
      <Button render={<a href="/docs" />} disabled>
        Docs
      </Button>,
    )
    expect(out).not.toContain("href=")
    expect(out).toContain('role="link"')
    expect(out).toContain('aria-disabled="true"')
    expect(out).toContain('tabindex="-1"')
  })

  it("render <div>: role button and tabindex 0, no type", () => {
    const out = html(<Button render={<div />}>Div</Button>)
    expect(out).toMatch(/^<div /)
    expect(out).toContain('role="button"')
    expect(out).toContain('tabindex="0"')
    expect(out).not.toMatch(/ type=/)
  })

  it("disabled render <div>: aria-disabled and tabindex -1", () => {
    const out = html(
      <Button render={<div />} disabled>
        Div
      </Button>,
    )
    expect(out).toContain('aria-disabled="true"')
    expect(out).toContain('tabindex="-1"')
  })

  it("never sets an inline pointer-events style when disabled or pending (ariakit#845)", () => {
    const trees = [
      () => <Button disabled>A</Button>,
      () => <Button pending>A</Button>,
      () => (
        <Button render={<div />} disabled>
          A
        </Button>
      ),
      () => (
        <Button render={<a href="/a" />} disabled>
          A
        </Button>
      ),
    ]
    for (const tree of trees) {
      expect(html(tree())).not.toMatch(/style=|pointer-events/)
    }
  })

  it("forwards form attributes", () => {
    const out = html(
      <Button type="submit" name="n" value="v" form="f" formAction="/x">
        S
      </Button>,
    )
    expect(out).toContain('name="n"')
    expect(out).toContain('value="v"')
    expect(out).toContain('form="f"')
    expect(out).toMatch(/formaction="\/x"/i)
  })
})
