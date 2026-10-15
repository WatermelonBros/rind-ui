// Project "setup-noglobals" (jsdom, Vitest without globals): @rind-ui/testing/setup still
// registers Testing Library's cleanup and rind-ui's reset after each test.
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { installAnnouncementLog } from "../announcements"

it("first test renders and leaves an announcement", () => {
  render(<button type="button">A</button>)
  installAnnouncementLog().push({ message: "left over" } as never) // any entry: reset clears it
  expect(document.querySelectorAll("button")).toHaveLength(1)
})

it("the second test starts with an empty document and reset rind-ui state", () => {
  expect(document.querySelectorAll("button")).toHaveLength(0)
  expect(installAnnouncementLog()).toHaveLength(0)
})
