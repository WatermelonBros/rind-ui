"use client"

import { Accordion } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

// Each exported function is one live example; `variants` titles them in page order (the first
// is the hero example at the top of the page). The site shows each function's source as its code.

export function Basic() {
  return (
    <Accordion.Root defaultValue={["shipping"]}>
      <Accordion.Item value="shipping">
        <Accordion.Header>
          <Accordion.Trigger>
            Shipping
            <Accordion.Indicator>+</Accordion.Indicator>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          <div className="pad">Ships in two days, tracked to your door.</div>
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="returns">
        <Accordion.Header>
          <Accordion.Trigger>
            Returns
            <Accordion.Indicator>+</Accordion.Indicator>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          <div className="pad">Thirty days, no questions, free pickup.</div>
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="payment">
        <Accordion.Header>
          <Accordion.Trigger>
            Payment
            <Accordion.Indicator>+</Accordion.Indicator>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          <div className="pad">Cards, transfers and the usual wallets.</div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  )
}

export function Multiple() {
  return (
    <Accordion.Root multiple defaultValue={["a", "b"]}>
      {["a", "b", "c"].map((v) => (
        <Accordion.Item key={v} value={v}>
          <Accordion.Header>
            <Accordion.Trigger>
              Section {v.toUpperCase()}
              <Accordion.Indicator>+</Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <div className="pad">Several sections can stay open at once.</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

export function NotCollapsible() {
  return (
    <Accordion.Root collapsible={false} defaultValue={["a"]}>
      {["a", "b"].map((v) => (
        <Accordion.Item key={v} value={v}>
          <Accordion.Header>
            <Accordion.Trigger>
              Step {v.toUpperCase()}
              <Accordion.Indicator>+</Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <div className="pad">One section is always open; its trigger is locked.</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

export function DisabledItem() {
  return (
    <Accordion.Root>
      <Accordion.Item value="on">
        <Accordion.Header>
          <Accordion.Trigger>
            Available
            <Accordion.Indicator>+</Accordion.Indicator>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          <div className="pad">This one opens.</div>
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="off" disabled>
        <Accordion.Header>
          <Accordion.Trigger>
            Coming soon
            <Accordion.Indicator>+</Accordion.Indicator>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          <div className="pad">Not yet.</div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  )
}

export function KeyboardNavigation() {
  return (
    <Accordion.Root keyboardNavigation>
      {["One", "Two", "Three"].map((t) => (
        <Accordion.Item key={t} value={t}>
          <Accordion.Header>
            <Accordion.Trigger>
              {t}
              <Accordion.Indicator>+</Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <div className="pad">Arrow keys, Home and End move between triggers.</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

export function Controlled() {
  const [value, setValue] = useState<readonly string[]>(["a"])
  return (
    <div className="stack">
      <Accordion.Root value={value} onValueChange={setValue}>
        {["a", "b"].map((v) => (
          <Accordion.Item key={v} value={v}>
            <Accordion.Header>
              <Accordion.Trigger>
                Item {v.toUpperCase()}
                <Accordion.Indicator>+</Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>
              <div className="pad">The parent owns the open items.</div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
      <span className="note">open: [{value.join(", ")}]</span>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic" },
  Multiple: { title: "Multiple", description: "`multiple` keeps several sections open." },
  NotCollapsible: {
    title: "Always one open",
    description: "`collapsible={false}` locks the open trigger (`aria-disabled`, still focusable).",
  },
  DisabledItem: { title: "Disabled item", description: "`disabled` on one Item." },
  KeyboardNavigation: {
    title: "Arrow keys",
    description:
      "`keyboardNavigation` adds Arrow, Home and End between triggers (optional in the APG).",
  },
  Controlled: { title: "Controlled", description: "`value` and `onValueChange`." },
}
