// Model-based tests (add-splitter task 5.1): the Splitter contract over all transitions.
// Browser mode walks pointer, touch, keyboard and virtual; jsdom (no layout) keyboard only.
// The oracle's onSizesCommit spy is compared with the page's (one commit per interaction).
import { platforms, type SplitterPanel, splitterContract } from "@rind-ui/core"
import { RindProvider, Splitter, type SplitterRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { type ReactElement, useState } from "react"
import { describe, it } from "vitest"
import { type ConsumerInvariant, currentRun, testMachine } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

// Every prop the machine's guards read, as the component receives it.
const base = {
  sizes: undefined,
  defaultSizes: undefined,
  step: undefined,
  disabled: undefined,
  handleDisabled: undefined,
}

/** jsdom has no layout: the drag steps are walked in browser mode only. */
const contract = inJsdom
  ? {
      ...splitterContract,
      events: {
        ...splitterContract.events,
        "POINTER.DOWN": { skip: "no layout in jsdom: walked in browser mode" },
      },
    }
  : splitterContract

const NAMES = ["Sidebar", "Editor", "Preview"]

/** 400 px of panels' space (10 px handles), so a percent is a whole number of pixels. */
function Fixture({ panels, ...props }: SplitterRootProps) {
  const vertical = props.orientation === "vertical"
  const length = 400 + (panels.length - 1) * 10
  return (
    <Splitter.Root
      panels={panels}
      {...props}
      style={vertical ? { width: 200, height: length } : { width: length, height: 100 }}
    >
      {panels.flatMap((_, i) => [
        // biome-ignore lint/suspicious/noArrayIndexKey: panels are identified by index
        <Splitter.Panel key={`p${i}`} index={i}>
          {NAMES[i]}
        </Splitter.Panel>,
        i < panels.length - 1 ? (
          <Splitter.Handle
            // biome-ignore lint/suspicious/noArrayIndexKey: handles are identified by index
            key={`h${i}`}
            index={i}
            aria-label={NAMES[i]}
            style={vertical ? { height: 10 } : { width: 10 }}
          />
        ) : null,
      ])}
    </Splitter.Root>
  )
}

/** Outside the component that re-renders: a new environment per render resets modality. */
const withRun = (ui: ReactElement) => (
  <RindProvider
    dir={currentRun()?.direction ?? "ltr"}
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
  >
    {ui}
  </RindProvider>
)

/** Controlled by a parent that applies every proposal (the oracle runs uncontrolled). */
function Applying(props: {
  readonly initial: number[]
  readonly panels: readonly SplitterPanel[]
  readonly onSizesCommit: () => void
}) {
  const [sizes, setSizes] = useState<readonly number[]>(props.initial)
  return (
    <Fixture
      panels={props.panels}
      sizes={sizes}
      onSizesChange={setSizes}
      onSizesCommit={props.onSizesCommit}
    />
  )
}

interface Config {
  readonly name: string
  readonly props: Record<string, unknown>
  readonly ui: (commit: () => void) => ReactElement
}

const two = [{ min: 10 }, { min: 10 }]
const collapsible = [{ collapsible: true, min: 20 }, {}]
const three = [{ min: 10 }, { min: 10 }, { min: 10 }]

const configs: Config[] = [
  {
    name: "horizontal, uncontrolled",
    props: { panels: two, defaultSizes: [30, 70] },
    ui: (c) => <Fixture panels={two} defaultSizes={[30, 70]} onSizesCommit={c} />,
  },
  {
    name: "vertical",
    props: { panels: two, defaultSizes: [30, 70] },
    ui: (c) => (
      <Fixture panels={two} defaultSizes={[30, 70]} orientation="vertical" onSizesCommit={c} />
    ),
  },
  {
    name: "collapsible",
    props: { panels: collapsible, defaultSizes: [30, 70] },
    ui: (c) => <Fixture panels={collapsible} defaultSizes={[30, 70]} onSizesCommit={c} />,
  },
  {
    name: "three panels",
    props: { panels: three, defaultSizes: [20, 30, 50] },
    ui: (c) => <Fixture panels={three} defaultSizes={[20, 30, 50]} onSizesCommit={c} />,
  },
  {
    name: "controlled, applying",
    props: { panels: two, defaultSizes: [30, 70] },
    ui: (c) => <Applying initial={[30, 70]} panels={two} onSizesCommit={c} />,
  },
]

for (const cfg of configs) {
  describe(`splitter model: ${cfg.name}`, () => {
    let pageCommits = 0
    let oracleCommits = 0
    const commits: ConsumerInvariant<typeof splitterContract> = {
      name: "splitter-commit-count",
      check: async () =>
        pageCommits === oracleCommits
          ? undefined
          : `onSizesCommit ran ${pageCommits} times, the oracle ${oracleCommits}`,
    }
    testMachine(contract, {
      test: it,
      setup: () => {
        pageCommits = 0
        oracleCommits = 0
        return render(withRun(cfg.ui(() => pageCommits++)))
      },
      target: () => screen,
      anchor: [{ name: "Sidebar" }] as never,
      props: {
        ...base,
        ...cfg.props,
        onSizesCommit: () => {
          oracleCommits++
        },
      } as never,
      // No layout in jsdom: the pointer steps run in browser mode only.
      ...(inJsdom ? { modalities: ["keyboard"] as const } : {}),
      invariants: [commits],
      a11y,
    })
  })
}
