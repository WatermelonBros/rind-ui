"use client"

import { Clipboard, type ClipboardRootProps, RindProvider } from "@rind-ui/react"
import type { States, Variants } from "./types"

/** `copying`, `copied` and `error` last moments after a press: reached by the driver's `copy`. */
export const states: States = { clipboard: { idle: "Basic" } }

/** Phosphor (regular) icons: Copy, then Check or X by the copy's result. */
function PhosphorIcon({ d }: { readonly d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" width="18" height="18" fill="currentColor">
      <path d={d} />
    </svg>
  )
}
const COPY =
  "M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"
const CHECK =
  "M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"
const X =
  "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"

/** The Indicator with the three icons: its shape tells the result, not only its colour. */
function Icon() {
  return (
    <Clipboard.Indicator copied={<PhosphorIcon d={CHECK} />} failed={<PhosphorIcon d={X} />}>
      <PhosphorIcon d={COPY} />
    </Clipboard.Indicator>
  )
}

/** A Label, the read-only value and a copy key with its icon. */
function Field({ label, ...props }: ClipboardRootProps & { readonly label: string }) {
  return (
    <Clipboard.Root {...props}>
      <Clipboard.Label>{label}</Clipboard.Label>
      <Clipboard.Control>
        <Clipboard.Input />
        <Clipboard.Trigger>
          <Icon />
        </Clipboard.Trigger>
      </Clipboard.Control>
    </Clipboard.Root>
  )
}

export function Basic() {
  return <Field label="API key" value="sk-live-4f9a2c7e1b" />
}

export function CopyButton() {
  return (
    <Clipboard.Root value="npm install @rind-ui/react">
      <Clipboard.Trigger>
        <Icon />
      </Clipboard.Trigger>
    </Clipboard.Root>
  )
}

export function TextTrigger() {
  // Visible text is the name: `messages.copy` matches it (label in name, WCAG 2.5.3).
  return (
    <Clipboard.Root
      value="https://rind.watermelon-studio.it/invite/9xk2"
      messages={{ copy: "Copy link" }}
    >
      <Clipboard.Trigger>
        <Icon />
        Copy link
      </Clipboard.Trigger>
    </Clipboard.Root>
  )
}

export function WithValueText() {
  return (
    <Clipboard.Root value="#ff3d8b">
      <Clipboard.Label>Accent colour</Clipboard.Label>
      <div className="row">
        <Clipboard.ValueText />
        <Clipboard.Trigger>
          <Icon />
        </Clipboard.Trigger>
      </div>
    </Clipboard.Root>
  )
}

export function Failing() {
  // An environment whose clipboard refuses every write: the result is `error`, never "Copied".
  return (
    <RindProvider
      environment={{ clipboard: { writeText: () => Promise.reject(new Error("Denied")) } }}
    >
      <Field label="Recovery code" value="7HQ2-KX9P-41ZD" />
    </RindProvider>
  )
}

export function Disabled() {
  return <Field label="Webhook secret" value="whsec_hidden" disabled />
}

export function Localised() {
  return (
    <Field
      label="Codice invito"
      value="RIND-2026"
      locale="it"
      messages={{ copy: "Copia", copied: "Copiato", copyFailed: "Copia non riuscita" }}
    />
  )
}

export const variants: Variants = {
  Basic: {
    title: "Field",
    description:
      'A Label, the read-only Input and the Trigger, named "Copy API key". Tab to the Input selects the whole value.',
  },
  CopyButton: {
    title: "Copy button",
    description: 'Just a Trigger: named "Copy"; the Indicator\'s icon shows the result.',
  },
  TextTrigger: {
    title: "Text trigger",
    description: "Visible text in the Trigger: set `messages.copy` to the same text.",
  },
  WithValueText: {
    title: "Value text",
    description: "`ValueText` renders the value instead of an Input.",
  },
  Failing: {
    title: "Failing clipboard",
    description: 'A clipboard that rejects: the state is `error` and "Copy failed" is announced.',
  },
  Disabled: { title: "Disabled", description: "The Trigger and the Input are disabled." },
  Localised: {
    title: "Localised",
    description: "`messages` and `locale`: the name and the announcement in Italian.",
  },
}
