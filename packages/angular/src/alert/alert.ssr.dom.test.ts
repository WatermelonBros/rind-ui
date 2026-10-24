// A hydrated Alert was present at load: it stays silent (Node's server platform: jsdom only).
import { Component } from "@angular/core"
import { PENDING_ANNOUNCEMENTS } from "@rind-ui/core"
import { installAnnouncementLog } from "@rind-ui/testing"
import { waitFor } from "@testing-library/dom"
import { describe, expect, it } from "vitest"
import { hydrate } from "../../fixtures/hydrate"
import { Alert } from "./alert"

@Component({
  selector: "rind-hydrate",
  imports: [Alert],
  template: `<div rindAlertRoot><div rindAlertTitle>Couldn't save</div></div>`,
})
class Hydrated {}

describe("angular alert hydration", () => {
  it("a hydrated alert was present at load: silent", async () => {
    const before = installAnnouncementLog().length
    await hydrate(Hydrated)
    await waitFor(() => expect(Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) ?? 0).toBe(0))
    expect(installAnnouncementLog().length).toBe(before)
  })
})
