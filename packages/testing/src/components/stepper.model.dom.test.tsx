// Model-based tests (add-stepper 3.1): next, previous and selecting step 0 by every modality,
// linear and non-linear; the invariants (one current step, no tab roles, one content shown)
// and axe after every step.
import { stepperContract, stepperMessages } from "@rind-ui/core"
import { RindProvider, Stepper } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const TITLES = ["Cart", "Shipping", "Payment"]

function variant(linear: boolean) {
  describe(`stepper model: ${linear ? "linear" : "non-linear"}`, () => {
    testMachine(stepperContract, {
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () =>
        render(
          <RindProvider>
            <Stepper.Root aria-label="Checkout" count={3} linear={linear}>
              <Stepper.List>
                {TITLES.map((t, i) => (
                  <Stepper.Item key={t} index={i}>
                    <Stepper.Trigger>
                      <Stepper.Title>{t}</Stepper.Title>
                    </Stepper.Trigger>
                  </Stepper.Item>
                ))}
              </Stepper.List>
              {TITLES.map((t, i) => (
                <Stepper.Content key={t} index={i}>
                  {t} details
                </Stepper.Content>
              ))}
              <Stepper.PrevTrigger />
              <Stepper.NextTrigger />
            </Stepper.Root>
          </RindProvider>,
        ),
      target: () => domEnv({ timeout: 200 }),
      anchor: [{ name: "Checkout" }],
      props: {
        id: "oracle",
        count: 3,
        linear,
        messages: stepperMessages,
        disabledSteps: new Set<number>(),
      } as never,
      modalities: ["pointer", "keyboard", "virtual"],
      a11y,
    } as never)
  })
}

variant(true)
variant(false)
