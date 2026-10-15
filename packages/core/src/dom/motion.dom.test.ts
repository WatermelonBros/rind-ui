import { expect, it } from "vitest"
import { motionPreference } from "./motion"

it("with @rind-ui/testing/setup's matchMedia stub, motion is not reduced", () => {
  // In a real browser this reads the user's preference; CI browsers do not reduce motion.
  expect(motionPreference().reducedMotion()).toBe(false)
})
