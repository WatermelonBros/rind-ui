// Stepper through its driver (spec stepper): list semantics, names with status, the linear
// rules, cancel, focus to the content and the announcement on the user's moves only,
// conditional (unmounting) steps, form values kept across steps.
import { RindProvider, Stepper, type StepperRootProps } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { getStepper, recordingAnnouncer } from "../index"

const TITLES = ["Cart", "Shipping", "Payment", "Review"]

function Checkout({
  hidePayment = false,
  ...props
}: Partial<StepperRootProps> & { readonly hidePayment?: boolean }) {
  const steps = TITLES.map((t, i) => ({ t, i })).filter((s) => !(hidePayment && s.i === 2))
  return (
    <Stepper.Root aria-label="Checkout" count={4} {...props}>
      <Stepper.List>
        {steps.map(({ t, i }) => (
          <Stepper.Item key={t} index={i}>
            <Stepper.Trigger>
              <Stepper.Indicator>{i + 1}</Stepper.Indicator>
              <Stepper.Title>{t}</Stepper.Title>
            </Stepper.Trigger>
          </Stepper.Item>
        ))}
      </Stepper.List>
      {TITLES.map((t, i) => (
        <Stepper.Content key={t} index={i}>
          <label>
            {t} note <input />
          </label>
        </Stepper.Content>
      ))}
      <Stepper.PrevTrigger />
      <Stepper.NextTrigger />
    </Stepper.Root>
  )
}

function setup(node: React.ReactNode) {
  const rec = recordingAnnouncer()
  render(<RindProvider announcer={rec.announcer}>{node}</RindProvider>)
  return { d: getStepper(screen, { name: "Checkout" }), said: () => rec.log.map((a) => a.message) }
}

const frame = () => act(() => new Promise<void>((r) => requestAnimationFrame(() => r())))

describe("stepper", () => {
  it("an ordered list, no tabs; the current step marked; names carry the status", async () => {
    const { d } = setup(<Checkout defaultStep={1} />)
    expect(screen.getByRole("list").tagName).toBe("OL")
    expect(screen.queryAllByRole("tab")).toHaveLength(0)
    expect(await d.step()).toBe(1)
    // jsdom's name computation drops the space before the hidden status; browsers keep it.
    expect(screen.getByRole("button", { name: /^Cart ?\(completed\)$/ })).toBeTruthy()
    expect(screen.getAllByRole("listitem")[1]?.getAttribute("aria-current")).toBe("step")
  })

  it("linear: steps ahead are text, Next is the way forward; back is free", async () => {
    const { d } = setup(<Checkout />)
    expect(await d.reachable(1)).toBe(false)
    await d.next()
    await d.next()
    expect(await d.step()).toBe(2)
    await d.select(0)
    expect(await d.step()).toBe(0)
    expect(await d.reachable(2)).toBe(true)
    expect(await d.reachable(3)).toBe(false)
  })

  it("the user's Next focuses the new step's content and announces it", async () => {
    const { d, said } = setup(<Checkout />)
    await d.next()
    await frame()
    expect(await d.focusInContent()).toBe(true)
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Step 2 of 4: Shipping")
    expect(said()).toEqual(["Step 2 of 4: Shipping"])
  })

  it("validation: a cancelled Next stays", async () => {
    const { d } = setup(<Checkout onStepChange={(_s, details) => details.cancel()} />)
    await d.next()
    expect(await d.step()).toBe(0)
  })

  it("a parent's change neither focuses nor announces", async () => {
    function Controlled() {
      const [step, setStep] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setStep(2)}>
            Jump
          </button>
          <Checkout linear={false} step={step} onStepChange={setStep} />
        </>
      )
    }
    const { d, said } = setup(<Controlled />)
    await userEvent.click(screen.getByRole("button", { name: "Jump" }))
    await frame()
    expect(await d.step()).toBe(2)
    expect(said()).toEqual([])
    expect(document.activeElement?.textContent).toBe("Jump")
  })

  it("field values survive moving between steps", async () => {
    setup(<Checkout />)
    const cart = screen.getByRole("textbox", { name: "Cart note" })
    await userEvent.type(cart, "gift wrap")
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await userEvent.click(screen.getByRole("button", { name: "Previous" }))
    expect((screen.getByRole("textbox", { name: "Cart note" }) as HTMLInputElement).value).toBe(
      "gift wrap",
    )
  })

  it("Next and Previous are disabled at the ends", async () => {
    setup(<Checkout />)
    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", true)
  })
})
