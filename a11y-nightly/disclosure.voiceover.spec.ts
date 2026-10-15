// Golden flow: the disclosure fixture with VoiceOver and Playwright's WebKit (not Safari:
// Playwright drives its own WebKit build, which VoiceOver reads the same way).
import { release } from "node:os"
import { voiceOverTest as test } from "@guidepup/playwright"
import { expect } from "@playwright/test"
import { missingPhrases, story } from "./phrases"

test("disclosure: trigger state is spoken, content follows when open", async ({
  page,
  browserName,
  voiceOver,
}) => {
  test.info().annotations.push({
    type: "versions",
    description: JSON.stringify({
      screenReader: `VoiceOver ${voiceOver.version}`,
      browser: `${browserName} ${page.context().browser()?.version() ?? "?"}`,
      os: `macOS (Darwin ${release()})`,
    }),
  })
  await page.goto(story("foundations-disclosure-fixture--closed"))
  await page.locator("#storybook-root button").waitFor()
  await voiceOver.navigateToWebContent()
  await voiceOver.next()
  await voiceOver.act()
  await voiceOver.next()
  const spoken = await voiceOver.spokenPhraseLog()
  test.info().annotations.push({ type: "spoken", description: JSON.stringify(spoken) })
  expect(missingPhrases(spoken, ["Details", "collapsed", "expanded", "Body text"])).toEqual([])
})
