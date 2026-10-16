// add-aspect-ratio 1.1: Aspect Ratio is a recipe (native CSS `aspect-ratio`), never a part.
import { describe, it } from "vitest"
import type * as react from "./index"

describe("@rind-ui/react", () => {
  it("has no AspectRatio export", () => {
    // @ts-expect-error there is no AspectRatio component: use the CSS property
    type Missing = typeof react.AspectRatio
    const none: Missing | undefined = undefined
    void none
  })
})
