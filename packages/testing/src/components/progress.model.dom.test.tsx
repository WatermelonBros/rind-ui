// Model-based tests (add-progress 6.1): the value moves by prop steps to `max` from below and
// from indeterminate, with and without `announceCompletion`, horizontal and vertical. After
// every step the generic invariants (`valued` included), axe, and the announcement count run.
// A broken wrapper with an aria-valuenow on an indeterminate bar fails `valued` (5.2).
import { PENDING_ANNOUNCEMENTS, progressContract, progressMessages } from "@rind-ui/core"
import { Progress, type ProgressRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { type ConsumerInvariant, domEnv, installAnnouncementLog, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Props = ProgressRootProps & { readonly broken?: boolean }

function Upload({ broken = false, ...props }: Props) {
  return (
    <Progress.Root {...props} {...(broken ? { "aria-valuenow": 0 } : {})}>
      <Progress.Label>Uploading</Progress.Label>
      <Progress.ValueText />
      <Progress.Track>
        <Progress.Indicator />
      </Progress.Track>
    </Progress.Root>
  )
}

const pending = () => (Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) as number | undefined) ?? 0

/**
 * One announcement exactly when the value reached 100 from below with announceCompletion.
 * Every path is one `$props:value` step to 100: a check at any other value is a test's
 * baseline (a fresh render, a fresh log), which only records where the count starts.
 */
function completionCount(): ConsumerInvariant<typeof progressContract> {
  let seen = 0
  let last: number | null = null
  return {
    name: "progress-announces-completion",
    check: async ({ env, props }) => {
      // Keyed announcements are debounced: wait for none to be pending, not for a delay.
      await env.until(
        async () => pending(),
        (n) => n === 0,
      )
      const now = installAnnouncementLog().length
      const value = (props["value"] as number | null | undefined) ?? null
      if (value !== 100) {
        seen = now
        last = value
        return undefined
      }
      const expected = props["announceCompletion"] === true && (last === null || last < 100) ? 1 : 0
      const grew = now - seen
      seen = now
      last = value
      return grew === expected ? undefined : `announced ${grew} times, expected ${expected}`
    },
  }
}

function variant(name: string, start: Props) {
  describe(`progress model: ${name}`, () => {
    testMachine(progressContract, {
      test: it,
      setup: () => render(<Upload {...start} />),
      rerender: (next, rendered) =>
        rendered.rerender(<Upload {...start} {...(next as unknown as Props)} />),
      target: () => screen,
      anchor: [{ name: "Uploading" }],
      props: {
        value: start.value,
        min: 0,
        max: 100,
        announceCompletion: start.announceCompletion,
        messages: progressMessages,
        id: "oracle",
      } as never,
      invariants: [completionCount()],
      a11y,
      modalities: ["pointer"],
    })
  })
}

variant("40 → max, announcing", { value: 40, announceCompletion: true })
variant("40 → max, silent", { value: 40 })
variant("indeterminate → max, announcing", { value: null, announceCompletion: true })
variant("zero → max, vertical", { value: 0, orientation: "vertical" })

describe("broken Progress fails with the invariant's name", () => {
  it("aria-valuenow on an indeterminate bar → valued", { timeout: 60_000 }, async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(progressContract, {
      test: (n, fn) => tests.push({ name: n, fn }),
      setup: () => render(<Upload value={null} broken />),
      rerender: (next, rendered) =>
        rendered.rerender(<Upload broken {...(next as unknown as Props)} />),
      target: () => domEnv({ timeout: 200 }),
      anchor: [{ name: "Uploading" }],
      props: {
        value: null,
        min: 0,
        max: 100,
        announceCompletion: false,
        messages: progressMessages,
        id: "oracle",
      } as never,
      modalities: ["pointer"],
    })
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    // The valued invariant: an indeterminate bar carries no aria-valuenow.
    expect(errors.some((e) => e.includes('has aria-valuenow="0", expected none'))).toBe(true)
  })
})
