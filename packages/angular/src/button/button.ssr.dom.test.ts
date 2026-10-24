// The Button's server HTML (Node's server platform: jsdom only).
import { Component } from "@angular/core"
import { describe, expect, it } from "vitest"
import { serverHtml } from "../../fixtures/parity"
import { Button } from "./button"

@Component({
  selector: "rind-server",
  imports: [Button],
  template: `<button rindButton>Save</button>`,
})
class Server {}

@Component({
  selector: "rind-server-disabled",
  imports: [Button],
  template: `<button rindButton disabled>Save</button>`,
})
class ServerDisabled {}

describe("angular button server render", () => {
  it("server render: a native button of type button; disabled already in the HTML", async () => {
    const out = await serverHtml(Server)
    expect(out).toMatch(/^<button /)
    expect(out).toContain('type="button"')
    expect(out).toContain('data-scope="button"')
    expect(out).not.toMatch(/role=|aria-disabled|disabled|data-pending|data-disabled/)
    expect(await serverHtml(ServerDisabled)).toMatch(/ disabled/)
  })
})
