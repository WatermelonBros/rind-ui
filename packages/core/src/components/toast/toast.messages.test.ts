import { describe, expect, it } from "vitest"
import { toastAnnouncement, toastMessages } from "./toast.messages"

const say = (data: Parameters<typeof toastAnnouncement>[0], hotkey = "F6") =>
  toastAnnouncement(data, toastMessages, hotkey)

describe("toastAnnouncement", () => {
  it("reka-ui#2611: title and description read as sentences", () => {
    expect(say({ title: "Saved", description: "3 files" })).toBe("Saved. 3 files")
  })

  it("an action adds the hotkey hint", () => {
    expect(say({ title: "Archived", action: { label: "Undo" } })).toBe(
      "Archived. Press F6 to reach the action.",
    )
  })

  it("no null, undefined or brackets when parts are missing", () => {
    const text = say({ description: "3 files", action: { label: "Undo" } })
    expect(text).toBe("3 files. Press F6 to reach the action.")
    expect(say({})).toBe("")
    expect(text).not.toMatch(/null|undefined|[[\]]/)
  })

  it("a title ending in an ellipsis keeps it", () => {
    expect(say({ title: "Syncing…", description: "3 files" })).toBe("Syncing… 3 files")
  })

  it("uses the hotkey's spoken label", () => {
    const messages = { ...toastMessages, hotkeyLabel: (s: string) => s.replace("Alt+", "Option ") }
    expect(toastAnnouncement({ title: "A", action: {} }, messages, "Alt+T")).toBe(
      "A. Press Option T to reach the action.",
    )
  })
})
