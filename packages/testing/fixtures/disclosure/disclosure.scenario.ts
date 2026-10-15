// One driver test, run unchanged against Testing Library (jsdom and browser mode) and
// Playwright: only the target differs. Plain assertions, so it needs no test runner.
import { createDriver, type Target } from "../../src/index"
import { disclosureContract } from "./disclosure.contract"

const assert = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message)
}

export async function disclosureScenario(target: Target): Promise<void> {
  const details = createDriver(disclosureContract, target, "Details")
  assert(!(await details.isOpen()), "starts closed")

  await details.open()
  assert(await details.contentVisible(), "content visible after open")
  await details.close()

  await details.via("keyboard").open()
  await details.pressEscape()
  assert(!(await details.isOpen()), "Escape closes")

  // A screen reader's press: a bare click with detail 0 and nothing before it.
  await details.via("virtual").open()
  await details.via("virtual").close()

  let message = ""
  // pressEscape is keyboard-only: via("touch") must fail and name the modality.
  await details
    .via("touch")
    .pressEscape()
    .catch((e: Error) => (message = e.message))
  assert(message.includes('has no "touch" implementation'), `missing modality: ${message}`)
}
