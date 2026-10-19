// Model-based tests (add-message-thread 5.2): read back (wheel or Home), scroll back down,
// jump, in both layouts, LTR; the invariants (never live, articles named and positioned,
// jump iff detached) and axe after every step. Scrolling needs layout: browser only.
import { messageThreadContract } from "@rind-ui/core"
import { MessageThread, type MessageThreadRootProps, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, testMachine } from "../index"

const browser = !navigator.userAgent.includes("jsdom")

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function variant(anchor: NonNullable<MessageThreadRootProps["anchor"]>) {
  describe.runIf(browser)(`message-thread model: anchor ${anchor}`, () => {
    testMachine(messageThreadContract, {
      test: it,
      setup: () =>
        render(
          <RindProvider environment={{ reducedMotion: true }}>
            <MessageThread.Root count={12} anchor={anchor}>
              <MessageThread.Viewport style={{ height: 200 }}>
                {Array.from({ length: 12 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a static thread.
                  <MessageThread.Message key={i} index={i} from={i % 2 ? "assistant" : "user"}>
                    <p style={{ margin: 0, height: 60 }}>message {i}</p>
                  </MessageThread.Message>
                ))}
              </MessageThread.Viewport>
              <MessageThread.JumpToLatest />
            </MessageThread.Root>
          </RindProvider>,
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
