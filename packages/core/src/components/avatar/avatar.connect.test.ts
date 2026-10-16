import { afterEach, describe, expect, it, vi } from "vitest"
import {
  avatarConnect,
  avatarGroupOverflowProps,
  avatarGroupProps,
  checkAvatarGroupName,
  checkAvatarName,
  checkImageAlt,
  checkImageCount,
} from "./avatar.connect"
import { avatarMessages } from "./avatar.messages"

afterEach(() => vi.restoreAllMocks())

const api = (status: "idle" | "loading" | "loaded" | "error", named = true, hidden = false) =>
  avatarConnect({ instance: "a", status, named, hidden })

describe("avatar connect", () => {
  it('Root is role="img" only when named and not hidden', () => {
    expect(api("loaded").root()["role"]).toBe("img")
    expect(api("loaded", false).root()["role"]).toBeUndefined()
    expect(api("loaded", true, true).root()["role"]).toBeUndefined()
  })

  it("the same Root attributes in every status but data-state (one name)", () => {
    for (const s of ["idle", "loading", "loaded", "error"] as const) {
      const { "data-state": state, ...rest } = api(s).root()
      expect(state).toBe(s)
      expect(rest).toEqual({
        "data-scope": "avatar",
        "data-part": "root",
        "data-instance": "a",
        role: "img",
      })
    }
  })

  it('Image: alt="", hidden only in idle and error, never while loading', () => {
    expect(api("idle").image(false)).toMatchObject({ alt: "", hidden: true, "data-state": "idle" })
    // Server render / first client render: idle with a source stays visible (lazy-safe).
    expect(api("idle").image(true)["hidden"]).toBeUndefined()
    expect(api("loading").image(true)["hidden"]).toBeUndefined()
    expect(api("loaded").image(true)["hidden"]).toBeUndefined()
    expect(api("error").image(true)).toMatchObject({ hidden: true, "data-state": "error" })
  })

  it("no inline styles on any part", () => {
    for (const p of [
      api("loading").root(),
      api("loading").image(true),
      api("loading").fallback(),
    ]) {
      expect(p).not.toHaveProperty("style")
    }
  })

  it("Fallback carries data-state; Group is a group; GroupOverflow is scoped", () => {
    expect(api("error").fallback()).toMatchObject({
      "data-part": "fallback",
      "data-state": "error",
    })
    expect(avatarGroupProps("g")).toMatchObject({ role: "group", "data-part": "group" })
    expect(avatarGroupOverflowProps("g")["data-part"]).toBe("group-overflow")
  })

  it('overflowLabel: "4 more"', () => {
    expect(avatarMessages.overflowLabel(4)).toBe("4 more")
    expect(avatarMessages.overflowLabel(1)).toBe("1 more")
  })
})

describe("development checks", () => {
  it("unnamed, not hidden Root is an error naming the avatar", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    checkAvatarName({}, "a1")
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/avatar "a1".*aria-hidden="true"/))
    error.mockClear()
    checkAvatarName({ "aria-label": "Ada" }, "a1")
    checkAvatarName({ "aria-hidden": "true" }, "a1")
    checkAvatarName({ "aria-hidden": true }, "a1")
    expect(error).not.toHaveBeenCalled()
  })

  it("unnamed Group, second Image, alt differing from the Root name warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    checkAvatarGroupName({})
    checkImageCount(2)
    checkImageAlt("Ada's photo", "Ada")
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockClear()
    checkAvatarGroupName({ "aria-label": "Reviewers" })
    checkImageCount(1)
    checkImageAlt("", "Ada")
    checkImageAlt("Ada", "Ada")
    expect(warn).not.toHaveBeenCalled()
  })
})
