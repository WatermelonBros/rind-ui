// The shared element, type, substitution and disabled rules (openspec button-like-element),
// as an exhaustive table over tag × disabled × focusableWhenDisabled × type × role.
import { describe, expect, it } from "vitest"
import type { LinkEnv } from "../../dom/link"
import { platforms } from "../../dom/platform"
import type { ModalityEnv } from "../../env/capabilities"
import { type ButtonLikeInput, buttonLikeKind, buttonLikeProps } from "./button-like"

const modality: ModalityEnv["modality"] = {
  modality: () => "pointer",
  subscribe: () => () => {},
  focusCause: () => "other",
  markFocus: () => {},
  unmarkFocus: () => {},
  recentFocus: () => [],
}
const env: LinkEnv = { platform: platforms.linux, modality }

const tags = [
  { tag: "button", href: undefined, kind: "native" },
  { tag: "input", href: undefined, kind: "native" },
  { tag: "a", href: "/docs", kind: "link" },
  { tag: "a", href: undefined, kind: "generic" },
  { tag: "div", href: undefined, kind: "generic" },
  { tag: "span", href: undefined, kind: "generic" },
] as const
const types = [undefined, "submit", "reset"] as const
const roles = ["button", "checkbox", "switch"] as const
const bools = [false, true] as const

const rows = tags.flatMap((t) =>
  bools.flatMap((disabled) =>
    bools.flatMap((focusableWhenDisabled) =>
      types.flatMap((type) =>
        roles.map((role) => ({ ...t, disabled, focusableWhenDisabled, type, role })),
      ),
    ),
  ),
)

describe("buttonLikeKind", () => {
  it("a+href is a link, a without href is generic, button and input are native", () => {
    expect(buttonLikeKind("button", undefined)).toBe("native")
    expect(buttonLikeKind("input", undefined)).toBe("native")
    expect(buttonLikeKind("a", "/x")).toBe("link")
    expect(buttonLikeKind("area", "/x")).toBe("link")
    expect(buttonLikeKind("a", undefined)).toBe("generic")
    expect(buttonLikeKind("div", "/x")).toBe("generic")
  })
})

describe("buttonLikeProps table", () => {
  it.each(rows)("%o", ({ tag, href, kind, disabled, focusableWhenDisabled, type, role }) => {
    const input: ButtonLikeInput = { tag, href, role, disabled, focusableWhenDisabled, type }
    const p = buttonLikeProps(input, env)
    expect(buttonLikeKind(tag, href)).toBe(kind)

    // `type` only on a native element (a different meaning on <a>).
    if (kind === "native") expect(p["type"]).toBe(type ?? "button")
    else expect(p["type"]).toBeUndefined()

    if (kind === "native") {
      // Native semantics: no role, no aria-disabled when enabled or natively disabled.
      expect(p["role"]).toBeUndefined()
      expect(p["tabindex"]).toBeUndefined()
      expect(p["disabled"]).toBe(disabled && !focusableWhenDisabled ? true : undefined)
      expect(p["aria-disabled"]).toBe(disabled && focusableWhenDisabled ? "true" : undefined)
    } else if (kind === "generic") {
      expect(p["role"]).toBe(role)
      expect(p["disabled"]).toBeUndefined()
      expect(p["aria-disabled"]).toBe(disabled ? "true" : undefined)
      expect(p["tabindex"]).toBe(disabled && !focusableWhenDisabled ? -1 : 0)
    } else if (disabled) {
      // Link branch, disabled (Bits UI): no href, explicit role link.
      expect(p["href"]).toBeUndefined()
      expect(p["role"]).toBe("link")
      expect(p["aria-disabled"]).toBe("true")
      expect(p["tabindex"]).toBe(focusableWhenDisabled ? 0 : -1)
    } else {
      expect(p["href"]).toBe("/docs")
      expect(p["role"]).toBeUndefined()
      expect(p["aria-disabled"]).toBeUndefined()
      expect(p["tabindex"]).toBeUndefined()
    }
    expect(p["data-disabled"]).toBe(disabled ? "" : undefined)
  })

  it("an enabled native button has neither role nor aria-disabled", () => {
    const p = buttonLikeProps(
      { tag: "button", role: "button", disabled: false, focusableWhenDisabled: false },
      env,
    )
    expect("role" in p && p["role"] !== undefined).toBe(false)
    expect(p["aria-disabled"]).toBeUndefined()
  })

  it("never sets an inline pointer-events style (ariakit#845)", () => {
    for (const r of rows) {
      const p = buttonLikeProps(r, env)
      expect(p["style"]).toBeUndefined()
    }
  })
})
