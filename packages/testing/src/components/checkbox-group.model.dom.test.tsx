// Model-based tests (task 5.1): the Checkbox Group contract with the prop configurations of
// the design (no Parent, Parent, disabled item, disabled group, read-only group, required
// group, controlled), in every modality, with the form-associated invariants over the items'
// hidden inputs and the Parent-state invariant.
import { checkboxGroupArgs, checkboxGroupContract, platforms } from "@rind-ui/core"
import { Checkbox, CheckboxGroup, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { type ReactElement, useState } from "react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const ALL = ["a", "b", "c"] as const
const LABELS: Record<string, string> = { a: "Olives", b: "Basil", c: "Chili" }
// Every prop the machine reads, as the component receives it.
const base = {
  value: undefined,
  defaultValue: undefined,
  onValueChange: undefined,
  allValues: undefined,
  disabled: undefined,
  readOnly: undefined,
}
const anchor = [{ name: "Toppings" }] as never

type RootProps = Parameters<typeof CheckboxGroup.Root>[0]
interface Cfg {
  readonly parent?: boolean
  readonly disabledItem?: string
  readonly root?: Partial<RootProps>
}

function Group({ cfg, root }: { cfg: Cfg; root?: Partial<RootProps> }) {
  return (
    <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
      <form>
        <CheckboxGroup.Root
          name="toppings"
          {...(cfg.parent ? { allValues: ALL } : {})}
          {...cfg.root}
          {...root}
        >
          <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
          {cfg.parent && (
            <CheckboxGroup.Parent>
              <Checkbox.Control />
              <Checkbox.Label>All toppings</Checkbox.Label>
            </CheckboxGroup.Parent>
          )}
          {ALL.map((v) => (
            <Checkbox.Root key={v} value={v} disabled={cfg.disabledItem === v}>
              <Checkbox.Control />
              <Checkbox.Label>{LABELS[v]}</Checkbox.Label>
            </Checkbox.Root>
          ))}
        </CheckboxGroup.Root>
      </form>
    </RindProvider>
  )
}

/** Controlled by a parent that applies every proposal (the oracle runs it uncontrolled). */
function Applying({ cfg }: { cfg: Cfg }) {
  const [value, setValue] = useState<readonly string[]>([])
  return <Group cfg={cfg} root={{ value, onValueChange: setValue }} />
}

const configs: { name: string; cfg: Cfg; ui?: (cfg: Cfg) => ReactElement }[] = [
  { name: "no Parent", cfg: {} },
  { name: "Parent", cfg: { parent: true } },
  // The oracle cannot see a disabled item (no registration): toggles only, no Parent.
  { name: "disabled item", cfg: { disabledItem: "c" } },
  { name: "disabled group", cfg: { parent: true, root: { disabled: true } } },
  { name: "read-only group", cfg: { parent: true, root: { readOnly: true } } },
  { name: "required group", cfg: { parent: true, root: { required: true } } },
  { name: "controlled, applying", cfg: { parent: true }, ui: (cfg) => <Applying cfg={cfg} /> },
]

for (const { name, cfg, ui } of configs) {
  describe(`checkbox group model: ${name}`, () => {
    testMachine(checkboxGroupContract, {
      test: it,
      setup: () => {
        checkboxGroupArgs.current = { item: "a", label: "Olives" }
        return render(ui ? ui(cfg) : <Group cfg={cfg} />)
      },
      target: () => screen,
      anchor,
      props: {
        ...base,
        ...(cfg.parent ? { allValues: ALL } : {}),
        disabled: cfg.root?.disabled,
        readOnly: cfg.root?.readOnly,
      } as never,
      a11y,
    })
  })
}
