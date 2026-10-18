// add-date-field 8.1: the Date Field stylesheet on the real component: a bordered group,
// 24px segments, the ring on the focused segment, muted placeholders (colour, not opacity),
// forced-colors rules.

import { render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { DateField, RindProvider } from "../../react/src/index"
import { fixedDateClock } from "../../testing/src/index"
import dateField from "./date-field.css?inline"
import { cleanup, files, inject } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${dateField}`,
  )

const mountField = (root: Record<string, unknown> = {}) => {
  sheet()
  const view = render(
    <RindProvider
      locale="en-US"
      environment={{ dateClock: fixedDateClock("2026-10-17T12:00:00Z", "UTC") }}
    >
      <DateField.Root {...root}>
        <DateField.Label>Birthday</DateField.Label>
        <DateField.Input>
          {(segments) =>
            segments.map((s, i) => <DateField.Segment key={`${s.type}${i}`} segment={s} />)
          }
        </DateField.Input>
      </DateField.Root>
    </RindProvider>,
  )
  const q = (sel: string) => view.container.querySelector<HTMLElement>(sel) as HTMLElement
  return { q, view }
}

const editable = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-part="segment"][data-editable]'))

describe("Date Field stylesheet", () => {
  it("the group is a bordered field; segments are borderless, tabular and at least 24px", () => {
    const { q } = mountField()
    const group = getComputedStyle(q('[data-part="input"]'))
    expect(group.borderTopStyle).toBe("solid")
    expect(Number.parseFloat(group.borderTopWidth)).toBeGreaterThan(0)
    expect(group.alignItems).toBe("center")
    expect(group.unicodeBidi).toBe("isolate")
    const segs = editable()
    expect(segs.length).toBeGreaterThanOrEqual(3)
    for (const s of segs) {
      expect(s.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
      expect(getComputedStyle(s).borderTopStyle).toBe("none")
      expect(getComputedStyle(s).fontVariantNumeric).toContain("tabular-nums")
    }
  })

  it("the focused segment shows the ring after keyboard focus", async () => {
    const { q } = mountField()
    expect(q('[data-part="label"]').textContent).toBe("Birthday")
    await userEvent.tab()
    const focused = document.activeElement as HTMLElement
    expect(focused.getAttribute("data-part")).toBe("segment")
    await expect.poll(() => focused.hasAttribute("data-focus-visible")).toBe(true)
    expect(getComputedStyle(focused).outlineStyle).toBe("solid")
    expect(getComputedStyle(focused).backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("placeholders use a muted colour, not opacity; nothing is transparent text", () => {
    const { q } = mountField()
    const segs = editable()
    const ph = segs.find((s) => s.hasAttribute("data-placeholder")) as HTMLElement
    expect(ph).toBeTruthy()
    const text = getComputedStyle(q('[data-part="root"]')).color
    expect(getComputedStyle(ph).color).not.toBe(text)
    for (const el of [
      ...segs,
      ...document.querySelectorAll<HTMLElement>('[data-part="segment"]'),
    ]) {
      const s = getComputedStyle(el)
      expect(s.color).not.toBe("rgba(0, 0, 0, 0)")
      expect(s.opacity).toBe("1")
    }
    const pm = getComputedStyle(ph, "::placeholder")
    expect(pm.opacity).toBe("1")
  })

  it("literals ignore pointer events", () => {
    const { q } = mountField()
    const lit = q('[data-type="literal"]')
    expect(getComputedStyle(lit).pointerEvents).toBe("none")
  })

  it("soft and invalid change the group", () => {
    const base = getComputedStyle(mountField().q('[data-part="input"]')).backgroundColor
    cleanup()
    expect(
      getComputedStyle(mountField({ "data-variant": "soft" }).q('[data-part="input"]'))
        .backgroundColor,
    ).not.toBe(base)
    cleanup()
    const w = getComputedStyle(
      mountField({ "data-tone": "danger" }).q('[data-part="input"]'),
    ).borderTopWidth
    expect(Number.parseFloat(w)).toBeGreaterThan(
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--rind-border-width"),
      ),
    )
  })

  it("forced colors: boundary, ring and GrayText placeholder rules exist", () => {
    const css = dateField.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*CanvasText[\s\S]*Highlight[\s\S]*GrayText/,
    )
    expect(css).not.toMatch(/row-reverse|(?<![-\w])order:/)
  })

  it("range mode: one bordered group; the ends' inputs draw nothing; the separator is muted", () => {
    sheet()
    render(
      <RindProvider
        locale="en-US"
        environment={{ dateClock: fixedDateClock("2026-10-17T12:00:00Z", "UTC") }}
      >
        <DateField.Root selectionMode="range">
          <DateField.Label>Stay</DateField.Label>
          <DateField.Input />
        </DateField.Root>
      </RindProvider>,
    )
    const groups = document.querySelectorAll<HTMLElement>('[data-part="input"]')
    const outer = groups[0] as HTMLElement
    expect(Number.parseFloat(getComputedStyle(outer).borderTopWidth)).toBeGreaterThan(0)
    for (const inner of Array.from(groups).slice(1)) {
      expect(getComputedStyle(inner).borderTopWidth).toBe("0px")
    }
    const sep = document.querySelector<HTMLElement>('[data-part="separator"]') as HTMLElement
    expect(getComputedStyle(sep).color).not.toBe(getComputedStyle(outer).color)
  })
})
