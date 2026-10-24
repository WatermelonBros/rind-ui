// The Message Thread contract model (React's: read back, scroll back down, jump, in both
// layouts; scrolling needs layout: browser only) against the Svelte parts, and DOM parity with
// React.
import { messageThreadContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Thread from "../../fixtures/message-thread/thread.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const browser = !navigator.userAgent.includes("jsdom")

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function variant(anchor: "bottom" | "top") {
  describe.runIf(browser)(`svelte message-thread model: anchor ${anchor}`, () => {
    testMachine(messageThreadContract, {
      test: it,
      setup: () => mount(Thread, { model: true, root: { anchor } } as never),
      target: () => domEnv(),
      anchor: [{ name: "Conversation" }],
      props: { count: 12, anchor, lastFromUser: false } as never,
      modalities: ["pointer", "keyboard", "virtual"],
      a11y,
    } as never)
  })
}

variant("bottom")
variant("top")

const FROM = ["user", "assistant", "user"] as const
const react = (p: Record<string, unknown>) =>
  r(
    R.MessageThread.Root,
    { id: "chat", count: 3, ...p },
    r(
      R.MessageThread.Viewport,
      null,
      ...FROM.map((from, i) =>
        r(R.MessageThread.Message, { key: i, index: i, from }, r("p", null, `message ${i}`)),
      ),
    ),
    r(R.MessageThread.JumpToLatest),
  )

describe("Svelte MessageThread matches React", () => {
  it("bottom, top, a longer thread loading older messages", async () => {
    for (const p of [{}, { anchor: "top" }, { total: 40, loadingOlder: true }]) {
      await clientParity(react(p), Thread, { root: { id: "chat", ...p } } as never)
    }
  })
})
