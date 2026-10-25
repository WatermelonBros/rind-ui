// The Message Thread contract model (React's: read back, scroll back down, jump, in both
// layouts; scrolling needs layout: browser only) against the Angular parts, and markup parity
// with React.
import { Component } from "@angular/core"
import { messageThreadContract, type ThreadAnchor } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { MessageThread } from "./index"

const browser = !navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

/** The anchor the next model fixture renders. */
let layout: ThreadAnchor = "bottom"

@Component({
  selector: "rind-f",
  imports: [RindProvider, MessageThread],
  template: `<ng-container rindProvider [environment]="env">
    <div rindMessageThreadRoot [count]="12" [anchor]="anchor">
      <div rindMessageThreadViewport style="height: 200px">
        @for (i of list; track i) {
          <div rindMessageThreadMessage [index]="i" [from]="i % 2 ? 'assistant' : 'user'">
            <p style="margin: 0; height: 60px">message {{ i }}</p>
          </div>
        }
      </div>
      <button rindMessageThreadJumpToLatest></button>
    </div>
  </ng-container>`,
})
class Model {
  readonly anchor = layout
  readonly list = Array.from({ length: 12 }, (_, i) => i)
  readonly env = { reducedMotion: true }
}

function variant(anchor: ThreadAnchor) {
  describe.runIf(browser)(`angular message-thread model: anchor ${anchor}`, () => {
    testMachine(messageThreadContract, {
      test: it,
      setup: () => {
        layout = anchor
        return mount(Model)
      },
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
/** The configuration the next fixture renders. */
let current: { anchor?: ThreadAnchor; total?: number; loadingOlder?: boolean } = {}

@Component({
  selector: "rind-f",
  imports: [MessageThread],
  template: `<div
    rindMessageThreadRoot
    id="chat"
    [count]="3"
    [anchor]="p.anchor ?? 'bottom'"
    [total]="p.total"
    [loadingOlder]="p.loadingOlder ?? false"
  >
    <div rindMessageThreadViewport>
      @for (from of from; track $index) {
        <div rindMessageThreadMessage [index]="$index" [from]="from"><p>message {{ $index }}</p></div>
      }
    </div>
    <button rindMessageThreadJumpToLatest></button>
  </div>`,
})
class Fixture {
  readonly p = current
  readonly from = FROM
}

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

describe("Angular MessageThread matches React", () => {
  for (const p of [
    {},
    { anchor: "top" },
    { total: 40, loadingOlder: true },
  ] as (typeof current)[]) {
    it(`bottom, top, a longer thread loading older messages ${JSON.stringify(p)}`, async () => {
      current = p
      await both(react(p), Fixture)
    })
  }
})
