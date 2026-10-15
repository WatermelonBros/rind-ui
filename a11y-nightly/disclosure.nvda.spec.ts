// Golden flow: the disclosure fixture with NVDA and Chrome.
import { release } from "node:os"
import { nvdaTest as test } from "@guidepup/playwright"
import { expect } from "@playwright/test"
import { missingPhrases, story } from "./phrases"

test("disclosure: trigger state is spoken, content follows when open", async ({
  page,
  browserName,
  nvda,
}) => {
  test.info().annotations.push({
    type: "versions",
    description: JSON.stringify({
      screenReader: `NVDA ${nvda.version}`,
      browser: `${browserName} ${page.context().browser()?.version() ?? "?"}`,
      os: `Windows (${release()})`,
    }),
  })
  await page.goto(story("foundations-disclosure-fixture--closed"))
  await page.locator("#storybook-root button").waitFor()
  await nvda.navigateToWebContent()
  await nvda.next()
  await nvda.act()
  await nvda.next()
  const spoken = await nvda.spokenPhraseLog()
  test.info().annotations.push({ type: "spoken", description: JSON.stringify(spoken) })
  expect(missingPhrases(spoken, ["Details", "collapsed", "expanded", "Body text"])).toEqual([])
})
