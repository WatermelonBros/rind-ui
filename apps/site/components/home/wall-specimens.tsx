"use client"

import { CheckboxGroup, PinInput, Rating, Slider, Switch, ToggleGroup } from "@rind-ui/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { MorphLink } from "../morph-link"
import { usePhase } from "../phase"
import styles from "./home.module.css"

/** One attribute of one part, read live from the DOM: the styling contract, in plain sight. */
function useAttribute(selector: string, attr: string) {
  const root = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState<string | null>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const read = () => setValue(el.querySelector(selector)?.getAttribute(attr) ?? null)
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, { subtree: true, attributes: true, attributeFilter: [attr] })
    return () => mo.disconnect()
  }, [selector, attr])
  return [root, value] as const
}

function Specimen({
  name,
  slug,
  selector,
  attr,
  children,
}: {
  name: string
  slug: string
  selector: string
  attr: string
  children: ReactNode
}) {
  const { phase } = usePhase()
  const [root, value] = useAttribute(selector, attr)
  return (
    <li className={styles.specimen}>
      <div ref={root} className={styles.specimenStage} data-skinned="" data-skin={phase}>
        {children}
      </div>
      <div className={styles.specimenFoot}>
        <MorphLink href={`/docs/${slug}/`}>{name}</MorphLink>
        <code aria-hidden="true">
          {value === null ? `no ${attr}` : value === "" ? attr : `${attr}="${value}"`}
        </code>
      </div>
    </li>
  )
}

const TOPPINGS = ["Ham", "Cheese"]

/** Six ready components, alive: use them, and watch the attribute a stylesheet would target. */
export function WallSpecimens() {
  return (
    <ul className={styles.specimens} aria-label="Try a few">
      <Specimen
        name="Switch"
        slug="switch"
        selector='[data-scope="switch"][data-part="root"]'
        attr="data-state"
      >
        <Switch.Root>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label>Dark mode</Switch.Label>
        </Switch.Root>
      </Specimen>
      <Specimen name="Slider" slug="slider" selector="[aria-valuenow]" attr="aria-valuenow">
        <Slider.Root defaultValue={40}>
          <Slider.Label>Volume</Slider.Label>
          <Slider.ValueText />
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
            </Slider.Track>
            <Slider.Thumb index={0} />
          </Slider.Control>
        </Slider.Root>
      </Specimen>
      <Specimen name="Rating" slug="rating" selector="[aria-valuenow]" attr="aria-valuenow">
        <Rating.Root defaultValue={3}>
          <Rating.Label>Rate it</Rating.Label>
          <Rating.Control>
            {[1, 2, 3, 4, 5].map((i) => (
              <Rating.Item key={i} index={i} />
            ))}
          </Rating.Control>
        </Rating.Root>
      </Specimen>
      <Specimen
        name="Pin Input"
        slug="pin-input"
        selector='[data-scope="pin-input"][data-part="root"]'
        attr="data-complete"
      >
        <PinInput.Root length={4}>
          <PinInput.Label>Code</PinInput.Label>
          <PinInput.Control>
            <PinInput.Input />
            {[0, 1, 2, 3].map((i) => (
              <PinInput.Slot key={i} index={i} />
            ))}
          </PinInput.Control>
        </PinInput.Root>
      </Specimen>
      <Specimen
        name="Checkbox Group"
        slug="checkbox-group"
        selector="[data-parent][data-state]"
        attr="data-state"
      >
        <CheckboxGroup.Root allValues={TOPPINGS} defaultValue={["Ham"]}>
          <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
          <CheckboxGroup.Parent>
            <CheckboxGroup.ItemControl>
              <CheckboxGroup.ItemIndicator>
                {({ indeterminate }) => (indeterminate ? "–" : "✓")}
              </CheckboxGroup.ItemIndicator>
            </CheckboxGroup.ItemControl>
            <CheckboxGroup.ItemLabel>All</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Parent>
          {TOPPINGS.map((value) => (
            <CheckboxGroup.Item key={value} value={value}>
              <CheckboxGroup.ItemControl>
                <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
              </CheckboxGroup.ItemControl>
              <CheckboxGroup.ItemLabel>{value}</CheckboxGroup.ItemLabel>
            </CheckboxGroup.Item>
          ))}
        </CheckboxGroup.Root>
      </Specimen>
      <Specimen
        name="Toggle Group"
        slug="toggle-group"
        selector="[aria-pressed]"
        attr="aria-pressed"
      >
        <ToggleGroup.Root aria-label="Format" selectionMode="multiple">
          <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
          <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
        </ToggleGroup.Root>
      </Specimen>
    </ul>
  )
}
