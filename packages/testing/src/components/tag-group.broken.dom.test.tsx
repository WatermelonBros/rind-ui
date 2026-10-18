// A consumer wrapper that strips aria-describedby from the tags fails the keyboard run at the
// step that focuses a removable tag, naming the missing removal hint (spec "Wrapper drops the
// hint"); the default parts pass.
import { createListCollection, platforms, tagGroupContract, tagGroupIds } from "@rind-ui/core"
import { RindProvider, TagGroup } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, domEnv, testMachine } from "../index"

const ITEMS = ["Rome", "Paris", "Oslo"].map((label) => ({ key: label.toLowerCase(), label }))
const collection = createListCollection({
  items: ITEMS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})

/** The broken wrapper: after every render, tags lose their description. */
function DropHint() {
  useLayoutEffect(() => {
    for (const row of document.querySelectorAll('[role="row"][aria-describedby]')) {
      row.removeAttribute("aria-describedby")
    }
  })
  return null
}

async function failuresOf(broken: boolean) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(tagGroupContract, {
    test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
    setup: () =>
      render(
        <RindProvider
          environment={{ platform: currentRun()?.platform ?? platforms.linux }}
          dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
        >
          <TagGroup.Root items={ITEMS} onRemove={() => {}}>
            <TagGroup.Label>Cities</TagGroup.Label>
            <TagGroup.List>
              <TagGroup.Tags />
            </TagGroup.List>
          </TagGroup.Root>
          <button type="button">After</button>
          {broken ? <DropHint /> : null}
        </RindProvider>,
      ),
    target: () => domEnv({ timeout: 300 }),
    anchor: [{ name: "Cities" }],
    props: {
      collection,
      ids: tagGroupIds("o"),
      instance: "o",
      strategy: "roving",
      selectionMode: "none",
      focusableWhenDisabled: true,
      loop: true,
      onRemove: () => {},
    },
    modalities: ["keyboard"],
  } as never)
  const out: (string | null)[] = []
  for (const t of tests) {
    out.push(
      await t.fn().then(
        () => null,
        (e: Error) => e.message,
      ),
    )
    document.body.innerHTML = ""
  }
  return out
}

describe("tag group broken variant", () => {
  it("the default parts pass", { timeout: 60_000 }, async () => {
    expect((await failuresOf(false)).filter(Boolean)).toEqual([])
  })

  it("stripping the tags' description fails, naming the tag and the removal hint", {
    timeout: 60_000,
  }, async () => {
    const errors = (await failuresOf(true)).filter(Boolean)
    expect(errors.length).toBeGreaterThan(0)
    expect(
      errors.some(
        (e) =>
          /tag-group-removal-hint/.test(e ?? "") &&
          /removable tag "\w+" does not reference the removal hint/.test(e ?? ""),
      ),
    ).toBe(true)
  })
})
