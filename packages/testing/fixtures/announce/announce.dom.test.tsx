import { render, screen } from "@testing-library/react"
import { computeAccessibleDescription, computeAccessibleName } from "dom-accessibility-api"
import { describe, expect, it } from "vitest"
import { createDriver, englishLeaks, pseudo, pseudoMessages } from "../../src/index"
import { streamContract } from "./announce.contract"
import { StreamFixture, streamMessages } from "./announce.react"

describe("announcement log", () => {
  it("a streamed message is announced once, read through the driver", async () => {
    render(<StreamFixture />)
    const stream = createDriver(streamContract, screen, "Stream")
    await stream.stream()
    expect((await stream.announcements()).map((a) => a.message)).toEqual(["Hello there"])
  })

  it("pseudo-localised: no English default reaches assistive technology", async () => {
    render(<StreamFixture messages={pseudoMessages(streamMessages)} />)
    const button = screen.getByRole("button")
    const atStrings = [computeAccessibleName(button), computeAccessibleDescription(button)]
    expect(englishLeaks(streamMessages, atStrings)).toEqual([])
    expect(atStrings[0]).toBe(pseudo("Stream"))
  })

  it("no leak between tests: the next test starts with an empty log", async () => {
    render(<StreamFixture />)
    const stream = createDriver(streamContract, screen, "Stream")
    expect(await stream.env.announcements()).toEqual([])
  })
})
