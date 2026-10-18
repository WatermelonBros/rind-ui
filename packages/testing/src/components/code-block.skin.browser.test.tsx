// The site skins' Code Block (apps/site/skins/code-block.css) on the rendered parts: line numbers
// and tokens keep 4.5:1 on the block and on a highlighted line, and every token type has its own
// colour property.
import { CodeBlock } from "@rind-ui/react"
import { render, cleanup as unmount } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import siteBase from "../../../../apps/site/skins/base.css?inline"
import siteCodeBlock from "../../../../apps/site/skins/code-block.css?inline"
import { cleanup, inject, type Rgba, ratio, rgba } from "../../../theme/src/test-css"

afterEach(() => {
  unmount()
  cleanup()
})

/** An element's (or pseudo-element's) computed colour as 8-bit sRGB + alpha. */
function computed(el: HTMLElement, property: string, pseudo?: string): Rgba {
  el.style.setProperty("--probe", getComputedStyle(el, pseudo).getPropertyValue(property))
  return rgba(el, "--probe")
}

/** `top` (alpha 0-255) composited over the opaque `under`. */
function over(top: Rgba, under: Rgba): Rgba {
  const a = top[3] / 255
  const mix = (i: 0 | 1 | 2) => Math.round(top[i] * a + under[i] * (1 - a))
  return [mix(0), mix(1), mix(2), 255]
}

const code = 'const a = <p id="x">{`t`}</p> // c\nlet n = 1 + f(/r/)\nlet m = obj.p'

function mount(skin: string, style: Record<string, string> = {}) {
  inject(`${siteBase}\n${siteCodeBlock}`)
  const { container } = render(
    <div data-skinned="" data-skin={skin} style={style}>
      <CodeBlock.Root code={code} language="tsx" lineNumbers highlightLines={[2]}>
        <CodeBlock.Content />
      </CodeBlock.Root>
    </div>,
  )
  const q = (s: string) => container.querySelector(s) as HTMLElement
  return { q, container }
}

describe.each(["crisp", "juicy", "bare"])("code-block skin %s", (skin) => {
  it("line numbers and tokens reach 4.5:1 on the block and on a highlighted line", () => {
    const { q, container } = mount(skin)
    const block = computed(q("[data-part=root]"), "background-color")
    const lit = over(computed(q("[data-line='2']"), "background-color"), block)
    for (const n of ["1", "2"]) {
      const gutter = computed(q(`[data-line='${n}']`), "color", "::before")
      expect(ratio(gutter, block), `gutter ${n}`).toBeGreaterThanOrEqual(4.5)
      expect(ratio(gutter, lit), `gutter ${n} highlighted`).toBeGreaterThanOrEqual(4.5)
    }
    const tokens = [...container.querySelectorAll<HTMLElement>("[data-token]")]
    expect(tokens.length).toBeGreaterThan(10)
    for (const t of tokens) {
      const fg = computed(t, "color")
      expect(ratio(fg, block), t.dataset["token"]).toBeGreaterThanOrEqual(4.5)
      expect(ratio(fg, lit), `${t.dataset["token"]} highlighted`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("each token type reads its own property, then its group's", () => {
    const { q } = mount(skin, {
      "--rind-code-token-attr": "rgb(1, 2, 3)",
      "--rind-code-token-function": "rgb(4, 5, 6)",
    })
    expect(getComputedStyle(q("[data-token=attr]")).color).toBe("rgb(1, 2, 3)")
    expect(getComputedStyle(q("[data-token=string]")).color).not.toBe("rgb(1, 2, 3)")
    // tag has no own override here: it follows its group (function).
    expect(getComputedStyle(q("[data-token=tag]")).color).toBe("rgb(4, 5, 6)")
    expect(getComputedStyle(q("[data-token=property]")).color).not.toBe("rgb(1, 2, 3)")
  })
})
