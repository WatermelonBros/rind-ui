/** @jsxImportSource solid-js */
// The Message Thread contract model (React's: read back, scroll back down, jump, in both
// layouts; scrolling needs layout: browser only) against the Solid parts, and markup parity with
// React.
import { messageThreadContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { MessageThread, type MessageThreadRootProps, RindProvider } from "../index"

const browser = !navigator.userAgent.includes("jsdom")

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function variant(anchor: "bottom" | "top") {
  describe.runIf(browser)(`solid message-thread model: anchor ${anchor}`, () => {
    testMachine(messageThreadContract, {
      test: it,
      setup: () =>
        mount(() => (
          <RindProvider environment={{ reducedMotion: true }}>
            <MessageThread.Root count={12} anchor={anchor}>
              <MessageThread.Viewport style={{ height: "200px" }}>
                <For each={Array.from({ length: 12 }, (_, i) => i)}>
                  {(i) => (
                    <MessageThread.Message index={i} from={i % 2 ? "assistant" : "user"}>
                      <p style={{ margin: "0", height: "60px" }}>message {i}</p>
                    </MessageThread.Message>
                  )}
                </For>
              </MessageThread.Viewport>
              <MessageThread.JumpToLatest />
            </MessageThread.Root>
          </RindProvider>
        )),
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
const solid = (p: Record<string, unknown>) => (): JSX.Element => (
  <MessageThread.Root id="chat" {...({ count: 3, ...p } as unknown as MessageThreadRootProps)}>
    <MessageThread.Viewport>
      <For each={FROM}>
        {(from, i) => (
          <MessageThread.Message index={i()} from={from}>
            <p>message {i()}</p>
          </MessageThread.Message>
        )}
      </For>
    </MessageThread.Viewport>
    <MessageThread.JumpToLatest />
  </MessageThread.Root>
)
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

describe("Solid MessageThread matches React", () => {
  it("bottom, top, a longer thread loading older messages", async () => {
    for (const p of [{}, { anchor: "top" }, { total: 40, loadingOlder: true }]) {
      await clientParity(react(p), solid(p))
    }
  })
})
