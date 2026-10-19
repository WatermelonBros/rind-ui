// Model-based tests: the Rating contract over all transitions. Browser mode walks pointer,
// touch, keyboard and virtual; jsdom (no layout) keyboard only.
import { platforms, ratingContract } from "@rind-ui/core"
import { Rating, type RatingRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { type ReactElement, useState } from "react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

// Every prop the machine's guards and actions read, as the component receives it.
const base = {
  value: undefined,
  defaultValue: undefined,
  count: undefined,
  allowHalf: undefined,
  allowClear: undefined,
  disabled: undefined,
  readOnly: undefined,
}

function Fixture(props: RatingRootProps) {
  return (
    <form>
      <Rating.Root name="score" {...props}>
        <Rating.Label>Score</Rating.Label>
        <Rating.Control>
          {[1, 2, 3, 4, 5].map((i) => (
            <Rating.Item
              key={i}
              index={i}
              style={{ display: "inline-block", width: 24, height: 24 }}
            />
          ))}
        </Rating.Control>
      </Rating.Root>
      <button type="reset">Reset</button>
    </form>
  )
}

const withRun = (ui: ReactElement) => (
  <RindProvider
    dir={currentRun()?.direction ?? "ltr"}
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
  >
    {ui}
  </RindProvider>
)

/** Controlled by a parent that applies every proposal (the oracle runs uncontrolled). */
function Applying({ initial }: { readonly initial: number }) {
  const [value, setValue] = useState(initial)
  return <Fixture value={value} defaultValue={initial} onValueChange={setValue} />
}

const configs: { name: string; props: Record<string, unknown>; ui: () => ReactElement }[] = [
  { name: "uncontrolled", props: { defaultValue: 1 }, ui: () => <Fixture defaultValue={1} /> },
  { name: "unrated", props: {}, ui: () => <Fixture /> },
  {
    name: "half stars, allowClear",
    props: { defaultValue: 2.5, allowHalf: true, allowClear: true },
    ui: () => <Fixture defaultValue={2.5} allowHalf allowClear />,
  },
  {
    name: "read-only",
    props: { defaultValue: 3, readOnly: true },
    ui: () => <Fixture defaultValue={3} readOnly />,
  },
  { name: "controlled, applying", props: { defaultValue: 2 }, ui: () => <Applying initial={2} /> },
]

/** jsdom has no layout: the hover steps are walked in browser mode only. */
const contract = inJsdom
  ? {
      ...ratingContract,
      events: {
        ...ratingContract.events,
        "POINTER.MOVE": { skip: "no layout in jsdom: walked in browser mode" },
      },
    }
  : ratingContract

for (const cfg of configs) {
  describe(`rating model: ${cfg.name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => render(withRun(cfg.ui())),
      target: () => screen,
      anchor: [{ name: "Score" }] as never,
      props: { ...base, ...cfg.props } as never,
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      a11y,
    })
  })
}
