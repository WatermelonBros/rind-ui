// The Message Thread contract model (React's: read back, scroll back down, jump, in both
// layouts; scrolling needs layout: browser only) against the Vue parts, and markup parity with
// React.
import { messageThreadContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { MessageThread, RindProvider } from "../index"

const browser = !navigator.userAgent.includes("jsdom")

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function variant(anchor: "bottom" | "top") {
  describe.runIf(browser)(`vue message-thread model: anchor ${anchor}`, () => {
    testMachine(messageThreadContract, {
      test: it,
      setup: () =>
        mount(() =>
          h(RindProvider, { environment: { reducedMotion: true } }, () =>
            h(MessageThread.Root, { count: 12, anchor }, () => [
              h(MessageThread.Viewport, { style: { height: "200px" } }, () =>
                Array.from({ length: 12 }, (_, i) =>
                  h(
                    MessageThread.Message,
                    { key: i, index: i, from: i % 2 ? "assistant" : "user" },
                    () => h("p", { style: { margin: 0, height: "60px" } }, `message ${i}`),
                  ),
                ),
              ),
              h(MessageThread.JumpToLatest),
            ]),
          ),
        ),
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
const vue = (p: Record<string, unknown>) => () =>
  h(MessageThread.Root, { id: "chat", count: 3, ...p }, () => [
    h(MessageThread.Viewport, null, () =>
      FROM.map((from, i) =>
        h(MessageThread.Message, { key: i, index: i, from }, () => h("p", `message ${i}`)),
      ),
    ),
    h(MessageThread.JumpToLatest),
  ])
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

describe("Vue MessageThread matches React", () => {
  it("bottom, top, a longer thread loading older messages", async () => {
    for (const p of [{}, { anchor: "top" }, { total: 40, loadingOlder: true }]) {
      await serverParity(react(p), vue(p))
      await clientParity(react(p), vue(p))
    }
  })
})
