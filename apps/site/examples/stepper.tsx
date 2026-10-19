"use client"

import { Stepper, type StepperRootProps, TextField } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { stepper: { active: "Checkout" } }

/** Inline layout: theme pages do not load the site's helper classes. */
const COLUMN = { display: "grid", gap: 16, inlineSize: "min(100%, 560px)" } as const
const ROW = { display: "flex", gap: 8, justifyContent: "space-between" } as const

const STEPS = [
  { title: "Cart", description: "2 items" },
  { title: "Shipping", description: "Where to" },
  { title: "Payment", description: "Card" },
  { title: "Review", description: "Confirm" },
]

function Steps({ described = false }: { readonly described?: boolean }) {
  return (
    <Stepper.List>
      {STEPS.map((s, i) => (
        <Stepper.Item key={s.title} index={i}>
          <Stepper.Trigger>
            <Stepper.Indicator />
            <span>
              <Stepper.Title>{s.title}</Stepper.Title>
              {described ? <Stepper.Description>{s.description}</Stepper.Description> : null}
            </span>
          </Stepper.Trigger>
          {i < STEPS.length - 1 ? <Stepper.Separator /> : null}
        </Stepper.Item>
      ))}
    </Stepper.List>
  )
}

/** A linear checkout: Next is refused while the shipping address is empty. */
export function Checkout() {
  const [address, setAddress] = useState("")
  const [error, setError] = useState(false)
  return (
    <Stepper.Root
      aria-label="Checkout"
      count={4}
      style={COLUMN}
      onStepChange={(next, details) => {
        // Validation: leaving Shipping forward needs an address.
        if (details.reason === "next" && next === 2 && !address.trim()) {
          details.cancel()
          setError(true)
        }
      }}
    >
      <Steps />
      <Stepper.Content index={0}>Two items in your cart, 48 € in total.</Stepper.Content>
      <Stepper.Content index={1}>
        <TextField.Root
          value={address}
          onValueChange={(v) => {
            setAddress(v)
            if (v.trim()) setError(false)
          }}
          invalid={error}
          required
          style={{ inlineSize: "100%" }}
        >
          <TextField.Label>Shipping address</TextField.Label>
          <TextField.Input
            style={{ inlineSize: "100%", maxInlineSize: "none", boxSizing: "border-box" }}
          />
          {error ? (
            <TextField.Description>Enter an address to continue.</TextField.Description>
          ) : null}
        </TextField.Root>
      </Stepper.Content>
      <Stepper.Content index={2}>Paying with the card ending in 4242.</Stepper.Content>
      <Stepper.Content index={3}>
        Ready to place the order to {address || "your address"}.
      </Stepper.Content>
      <div style={ROW}>
        <Stepper.PrevTrigger />
        <Stepper.Progress />
        <Stepper.NextTrigger />
      </div>
    </Stepper.Root>
  )
}

function Plain(props: Partial<StepperRootProps>) {
  return (
    <Stepper.Root aria-label="Setup" count={4} style={COLUMN} {...props}>
      <Steps described />
      {STEPS.map((s, i) => (
        <Stepper.Content key={s.title} index={i}>
          {s.title}: {s.description}.
        </Stepper.Content>
      ))}
      <div style={ROW}>
        <Stepper.PrevTrigger />
        <Stepper.Progress />
        <Stepper.NextTrigger />
      </div>
    </Stepper.Root>
  )
}

export function NonLinear() {
  return <Plain linear={false} defaultStep={1} />
}

export function Vertical() {
  return <Plain orientation="vertical" defaultStep={2} />
}

export const variants: Variants = {
  Checkout: {
    title: "Checkout",
    description:
      "Linear: back to any visited step, forward only with Next, which refuses to leave Shipping without an address (`details.cancel()`). Moving focuses the step and announces it.",
  },
  NonLinear: {
    title: "Non-linear",
    description: "`linear={false}`: any step is a button.",
  },
  Vertical: { title: "Vertical", description: '`orientation="vertical"`, with descriptions.' },
}
