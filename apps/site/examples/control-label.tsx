"use client"

import { Switch } from "@rind-ui/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { Variants } from "./types"

/** Shows how the control inside is named and described: a site helper, not part of the API. */
function Naming({ children }: { readonly children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<readonly string[]>([])
  useEffect(() => {
    const control = box.current?.querySelector<HTMLElement>('[data-part="control"]')
    const label = box.current?.querySelector<HTMLElement>('[data-part="label"]')
    if (!control || !label) return
    const read = () =>
      setLines([
        label.getAttribute("for")
          ? `<label for="…"> names the <${control.tagName.toLowerCase()}>`
          : `aria-labelledby on the <${control.tagName.toLowerCase()}>`,
        control.getAttribute("aria-describedby") ? "aria-describedby → Description" : "",
        `data-state="${control.dataset["state"]}" on Label and Description too`,
      ])
    read()
    const mo = new MutationObserver(read)
    mo.observe(control, { attributes: true })
    return () => mo.disconnect()
  }, [])
  return (
    <div className="stack readout-host" ref={box}>
      {children}
      <ul className="readout" aria-label="How it is named">
        {lines.filter(Boolean).map((l) => (
          <li key={l}>
            <code>{l}</code>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Basic() {
  return (
    <Naming>
      <Switch.Root>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Airplane mode</Switch.Label>
        <Switch.Description>Click the label: the switch toggles once.</Switch.Description>
      </Switch.Root>
    </Naming>
  )
}

export function NonLabelable() {
  return (
    <Naming>
      <Switch.Root>
        <Switch.Control render={<div />}>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Bluetooth</Switch.Label>
        <Switch.Description>A div cannot be named by a label element.</Switch.Description>
      </Switch.Root>
    </Naming>
  )
}

export const variants: Variants = {
  Basic: {
    title: "A labelable control",
    description: "The Control is a button, so a native label names it; no aria-labelledby.",
  },
  NonLabelable: {
    title: "Rendered as a div",
    description: "Now the Label names it through aria-labelledby, and still presses it.",
  },
}
