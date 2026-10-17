// Broken Password Input variants (task 5.2): each must fail the model with a readable report
// naming the invariant it breaks; the correct component passes the same run.
import { textFieldContract, textFieldMessages } from "@rind-ui/core"
import { RindProvider, TextField } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { type ReactNode, useState } from "react"
import { describe, expect, it } from "vitest"
import { domEnv, installAnnouncementLog, testMachine } from "../index"

const base = {
  messages: textFieldMessages,
  id: "pw",
  clearInput: () => {},
  keepSelection: () => {},
  watchForm: undefined,
  disabled: undefined,
  readOnly: undefined,
  focusableWhenDisabled: undefined,
  limit: undefined,
  threshold: undefined,
  count: undefined,
  value: undefined,
  onValueChange: undefined,
  visible: undefined,
  defaultVisible: undefined,
  onVisibleChange: undefined,
}

function Frame({
  children,
  revealed = false,
}: {
  readonly children: (visible: boolean) => ReactNode
  readonly revealed?: boolean
}) {
  const [visible, setVisible] = useState(revealed)
  return (
    <RindProvider>
      <form onSubmit={(e) => e.preventDefault()}>
        <TextField.Root
          type="password"
          defaultValue="abc"
          visible={visible}
          onVisibleChange={(v, d) => {
            // A variant may refuse the submit's hide: `data-keep` on the form.
            if (d.reason === "SUBMIT" && document.querySelector("[data-keep]")) return
            setVisible(v)
          }}
        >
          <TextField.Label>Password</TextField.Label>
          <TextField.Input />
          {children(visible)}
          <button type="submit">Submit</button>
          <button type="reset">Reset</button>
        </TextField.Root>
      </form>
    </RindProvider>
  )
}

// Typing is the model test's (it re-expresses keyboard typing for the IME replay).
const untyped = {
  ...textFieldContract,
  events: { ...textFieldContract.events, INPUT: { skip: "covered by the model test" } },
} as typeof textFieldContract

/** Runs the model with `test` collecting instead of registering; returns each path's error. */
async function failuresOf(
  story: () => React.ReactElement,
  modalities: readonly string[],
  props: Record<string, unknown> = {},
) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(untyped, {
    test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
    setup: () => render(story()),
    target: () => domEnv({ timeout: 300 }),
    anchor: [{ name: "Password" }],
    props: { ...base, ...props } as never,
    modalities,
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
    installAnnouncementLog().length = 0
  }
  return out
}
const named = (errors: (string | null)[], invariant: string) =>
  errors.filter((e) => e?.includes(invariant))

describe("text-field password broken variants fail readably", () => {
  it("the correct component passes", { timeout: 60_000 }, async () => {
    const errors = await failuresOf(
      () => <Frame>{() => <TextField.VisibilityTrigger />}</Frame>,
      ["pointer", "keyboard", "virtual"],
    )
    expect(errors.filter(Boolean)).toEqual([])
  })

  it("a name that follows the state", { timeout: 60_000 }, async () => {
    const errors = await failuresOf(
      () => (
        <Frame>
          {(visible) => (
            <TextField.VisibilityTrigger aria-label={visible ? "Hide password" : "Show password"} />
          )}
        </Frame>
      ),
      ["keyboard"],
    )
    expect(named(errors, "text-field-stable-toggle-name").length).toBeGreaterThan(0)
  })

  it("a toggle on pointer presses only (a bare AT click does nothing: Zag)", {
    timeout: 60_000,
  }, async () => {
    const errors = await failuresOf(
      () => (
        <Frame>
          {() => (
            <TextField.VisibilityTrigger
              onClick={(e) => (e as unknown as { preventRindHandler(): void }).preventRindHandler()}
            />
          )}
        </Frame>
      ),
      ["virtual"],
    )
    expect(named(errors, "text-field-type-follows-visible").length).toBeGreaterThan(0)
  })

  it("a trigger out of the Tab order", { timeout: 60_000 }, async () => {
    const errors = await failuresOf(
      () => <Frame>{() => <TextField.VisibilityTrigger tabIndex={-1} />}</Frame>,
      ["pointer"],
    )
    expect(named(errors, "text-field-toggle-in-tab-order").length).toBeGreaterThan(0)
  })

  it("visibility kept after submit", { timeout: 60_000 }, async () => {
    const errors = await failuresOf(
      () => (
        <div data-keep="">
          <Frame revealed>{() => <TextField.VisibilityTrigger />}</Frame>
        </div>
      ),
      ["pointer"],
      { defaultVisible: true },
    )
    expect(errors.some((e) => e?.includes("VISIBILITY.HIDE"))).toBe(true)
  })
})
