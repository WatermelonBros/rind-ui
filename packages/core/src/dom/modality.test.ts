import { expect, it } from "vitest"
import { modalityTracker } from "./modality"
import { platforms } from "./platform"

it("on the server the modality is keyboard and no global is touched", () => {
  expect(typeof document).toBe("undefined")
  const tracker = modalityTracker(
    () => {
      throw new Error("getRootNode must not be called on the server")
    },
    () => platforms.linux,
  )
  expect(tracker.modality()).toBe("keyboard")
  const off = tracker.subscribe(() => {})
  off()
})
