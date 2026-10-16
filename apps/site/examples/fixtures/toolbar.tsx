"use client"

// Ported from apps/storybook/stories/Toolbar.stories.tsx
import { RadioGroup, RindProvider, ToggleGroup, Toolbar } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "../types"

export const states: States = {
  toolbar: { idle: "Default", focused: "Default" },
}

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "40rem" } as const

/** The contract's `tabIn` starts from "Before"; `leave` goes to "After". */
function Around({ children }: { children: React.ReactNode }) {
  return (
    <div style={column}>
      <button type="button">Before</button>
      {children}
      <button type="button">After</button>
    </div>
  )
}

const aligns = ["left", "center", "right"] as const
const alignNames: Record<string, string> = { left: "Left", center: "Center", right: "Right" }

/** A Toggle Group and a Radio Group hosted by the toolbar, a link and a text field. */
function Formatting({ textField = true, size = "12" }: { textField?: boolean; size?: string }) {
  return (
    <Toolbar.Root aria-label="Formatting">
      <Toolbar.Group>
        <ToggleGroup.Root aria-label="Text style" selectionMode="multiple">
          <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
          <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
          <ToggleGroup.Item value="underline">Underline</ToggleGroup.Item>
        </ToggleGroup.Root>
      </Toolbar.Group>
      <Toolbar.Separator />
      <RadioGroup.Root aria-label="Alignment" orientation="horizontal" defaultValue="left">
        {aligns.map((v) => (
          <RadioGroup.Item key={v} value={v}>
            <RadioGroup.ItemControl>
              <RadioGroup.ItemIndicator />
            </RadioGroup.ItemControl>
            <RadioGroup.ItemLabel>{alignNames[v]}</RadioGroup.ItemLabel>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      <Toolbar.Separator />
      <Toolbar.Link href="#help">Help</Toolbar.Link>
      {textField ? (
        <Toolbar.Item
          render={<input aria-label="Font size" defaultValue={size} inputMode="numeric" size={4} />}
        />
      ) : null}
    </Toolbar.Root>
  )
}

export function Default() {
  return (
    <Around>
      <Formatting />
    </Around>
  )
}

/** Arrow Up and Down move; the separators turn horizontal. */
export function VerticalStory() {
  return (
    <Around>
      <Toolbar.Root aria-label="Tools" orientation="vertical">
        <Toolbar.Button>Cut</Toolbar.Button>
        <Toolbar.Button>Copy</Toolbar.Button>
        <Toolbar.Separator />
        <Toolbar.Button>Paste</Toolbar.Button>
        <Toolbar.Link href="#help">Help</Toolbar.Link>
      </Toolbar.Root>
    </Around>
  )
}

/** A text field keeps its caret keys: arrows leave it only at the caret's edge. */
export function TextFieldLast() {
  return (
    <Around>
      <Toolbar.Root aria-label="Search tools">
        <Toolbar.Button>Filter</Toolbar.Button>
        <Toolbar.Button>Sort</Toolbar.Button>
        <Toolbar.Item render={<input aria-label="Search" defaultValue="rind" size={8} />} />
      </Toolbar.Root>
    </Around>
  )
}

export function TextFieldInTheMiddle() {
  return (
    <Around>
      <Toolbar.Root aria-label="Search tools">
        <Toolbar.Button>Filter</Toolbar.Button>
        <Toolbar.Item render={<input aria-label="Search" defaultValue="rind" size={8} />} />
        <Toolbar.Button>Sort</Toolbar.Button>
      </Toolbar.Root>
    </Around>
  )
}

/** Disabled controls stay reachable by arrows (`aria-disabled`) and never activate. */
export function DisabledControls() {
  return (
    <Around>
      <Toolbar.Root aria-label="Actions">
        <Toolbar.Button>Undo</Toolbar.Button>
        <Toolbar.Button disabled>Redo</Toolbar.Button>
        <Toolbar.Group disabled aria-label="Clipboard">
          <Toolbar.Button>Cut</Toolbar.Button>
          <Toolbar.Button>Copy</Toolbar.Button>
        </Toolbar.Group>
        <Toolbar.Item
          disabled
          render={<input aria-label="Zoom" defaultValue="100" inputMode="numeric" size={4} />}
        />
      </Toolbar.Root>
    </Around>
  )
}

/** With `focusableWhenDisabled={false}` a disabled control is natively disabled and skipped. */
export function DisabledSkipped() {
  return (
    <Around>
      <Toolbar.Root aria-label="Actions" focusableWhenDisabled={false}>
        <Toolbar.Button>Undo</Toolbar.Button>
        <Toolbar.Button disabled>Redo</Toolbar.Button>
        <Toolbar.Button>Print</Toolbar.Button>
      </Toolbar.Root>
    </Around>
  )
}

/** The whole toolbar disabled. */
export function AllDisabled() {
  return (
    <Around>
      <Toolbar.Root aria-label="Actions" disabled>
        <Toolbar.Button>Undo</Toolbar.Button>
        <Toolbar.Button>Redo</Toolbar.Button>
      </Toolbar.Root>
    </Around>
  )
}

/** Press without focus: the editor keeps its selection while a toolbar button is pressed. */
export function EditorToolbar() {
  const [presses, setPresses] = useState(0)
  return (
    <Around>
      <Toolbar.Root aria-label="Editor tools">
        <Toolbar.Button focusOnPress={false} onClick={() => setPresses((n) => n + 1)}>
          Bold
        </Toolbar.Button>
        <Toolbar.Button focusOnPress={false} onClick={() => setPresses((n) => n + 1)}>
          Italic
        </Toolbar.Button>
      </Toolbar.Root>
      {/* biome-ignore lint/a11y/useSemanticElements: a contenteditable region is the point */}
      <div
        role="textbox"
        aria-label="Document"
        aria-multiline="true"
        contentEditable
        tabIndex={0}
        suppressContentEditableWarning
        style={{ border: "1px solid currentColor", padding: "var(--rind-space-2)" }}
      >
        Select some text, then press a toolbar button.
      </div>
      <p>Toolbar presses: {presses}</p>
    </Around>
  )
}

/** The direction for the arrow keys comes from the provider, the layout from `dir`. */
export function RTL() {
  return (
    <RindProvider dir="rtl">
      <div dir="rtl">
        <Around>
          <Formatting />
        </Around>
      </div>
    </RindProvider>
  )
}

/** The driver moves through the controls the way a keyboard user does. */
export function DriverExample() {
  return (
    <Around>
      <Formatting />
    </Around>
  )
}

export const variants: Variants = {
  Default: { title: "Default", hidden: true },
  VerticalStory: { title: "Vertical", hidden: true },
  TextFieldLast: { title: "Text field last", hidden: true },
  TextFieldInTheMiddle: { title: "Text field in the middle", hidden: true },
  DisabledControls: { title: "Disabled controls", hidden: true },
  DisabledSkipped: { title: "Disabled skipped", hidden: true },
  AllDisabled: { title: "All disabled", hidden: true },
  EditorToolbar: { title: "Editor toolbar", hidden: true },
  RTL: { title: "RTL", hidden: true },
  DriverExample: { title: "Driver example", hidden: true },
}
