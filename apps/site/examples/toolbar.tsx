"use client"

import { RadioGroup, ToggleGroup, Toolbar } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <Toolbar.Root aria-label="Formatting">
      <ToggleGroup.Root aria-label="Text style" selectionMode="multiple" defaultValue={["bold"]}>
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Toolbar.Separator />
      <RadioGroup.Root aria-label="Alignment" orientation="horizontal" defaultValue="left">
        {["left", "center", "right"].map((value) => (
          <RadioGroup.Item key={value} value={value}>
            <RadioGroup.ItemControl>
              <RadioGroup.ItemIndicator />
            </RadioGroup.ItemControl>
            <RadioGroup.ItemLabel>{value}</RadioGroup.ItemLabel>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      <Toolbar.Separator />
      <Toolbar.Button>Share</Toolbar.Button>
    </Toolbar.Root>
  )
}

export function Buttons() {
  const [last, setLast] = useState("Tab into the toolbar, then use the arrow keys")
  return (
    <div className="stack">
      <Toolbar.Root aria-label="Editor">
        {["Undo", "Redo", "Cut", "Copy", "Paste"].map((action) => (
          <Toolbar.Button key={action} onPress={() => setLast(`${action}`)}>
            {action}
          </Toolbar.Button>
        ))}
      </Toolbar.Root>
      <span className="note">{last}</span>
    </div>
  )
}

export function WithLinkAndField() {
  return (
    <Toolbar.Root aria-label="Document">
      <Toolbar.Button>Save</Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Item render={<input aria-label="Font size" defaultValue="12" size={3} />} />
      <Toolbar.Separator />
      <Toolbar.Link href="/docs/toolbar/">Help</Toolbar.Link>
    </Toolbar.Root>
  )
}

export function Vertical() {
  return (
    <Toolbar.Root aria-label="Tools" orientation="vertical">
      <Toolbar.Button>Select</Toolbar.Button>
      <Toolbar.Button>Draw</Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Button>Erase</Toolbar.Button>
    </Toolbar.Root>
  )
}

export function DisabledControl() {
  return (
    <Toolbar.Root aria-label="Clipboard">
      <Toolbar.Button>Copy</Toolbar.Button>
      <Toolbar.Button disabled>Paste</Toolbar.Button>
      <Toolbar.Button>Clear</Toolbar.Button>
    </Toolbar.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description:
      "One tab stop for the whole toolbar; arrows move between controls, and hosted Toggle and Radio Groups join in.",
  },
  Buttons: {
    title: "Buttons",
    description: "`Toolbar.Button` is a rind Button with roving focus.",
  },
  WithLinkAndField: {
    title: "Links and fields",
    description: "A text field keeps its caret keys: arrows leave it only at the edge of the text.",
  },
  Vertical: { title: "Vertical", description: '`orientation="vertical"`: up and down move focus.' },
  DisabledControl: {
    title: "Disabled control",
    description:
      "A disabled control stays reachable by arrows (`aria-disabled`) so it can be found.",
  },
}
