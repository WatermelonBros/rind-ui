"use client"

import { SignaturePad, TextField } from "@rind-ui/react"
import type { States, Variants } from "./types"

/** `drawing` lasts while a pointer is down: reached by the driver's `draw`. */
export const states: States = { "signature-pad": { idle: "Basic" } }

function Pad({
  label = "Signature",
  ...root
}: Parameters<typeof SignaturePad.Root>[0] & { label?: string }) {
  return (
    <SignaturePad.Root {...root}>
      <SignaturePad.Label>{label}</SignaturePad.Label>
      <SignaturePad.Control>
        <SignaturePad.Segment />
        <SignaturePad.Guide />
      </SignaturePad.Control>
      <SignaturePad.Status />
      <div className="row">
        <SignaturePad.UndoTrigger>Undo</SignaturePad.UndoTrigger>
        <SignaturePad.ClearTrigger>Clear</SignaturePad.ClearTrigger>
      </div>
    </SignaturePad.Root>
  )
}

export function Basic() {
  return <Pad />
}

export function WithTypedAlternative() {
  return (
    <form className="stack" onSubmit={(e) => e.preventDefault()}>
      <Pad name="signature" />
      <TextField.Root name="typedName">
        <TextField.Label>Or type your full name</TextField.Label>
        <TextField.Input autoComplete="name" />
      </TextField.Root>
    </form>
  )
}

export function Required() {
  return (
    <form className="stack" onSubmit={(e) => e.preventDefault()}>
      <Pad name="consent" required label="Signature (required)" />
      <button type="submit">Submit</button>
    </form>
  )
}

const SAVED = {
  width: 320,
  height: 120,
  strokes: [
    {
      points: [
        [30, 80],
        [60, 40],
        [90, 85],
        [120, 45],
        [150, 82],
        [190, 50],
        [230, 78],
        [280, 60],
      ].map(([x = 0, y = 0], i) => ({ x, y, pressure: 0.5, t: i * 16 })),
    },
  ],
}

export function ReadOnly() {
  return <Pad readOnly defaultValue={SAVED} label="Signed by the customer" />
}

export const variants: Variants = {
  Basic: {
    title: "Signature",
    description:
      "Draw with a mouse, a pen or a finger. The drawing is SVG from stroke data: it never clears on a resize.",
  },
  WithTypedAlternative: {
    title: "With a typed alternative",
    description: "Drawing is a pointer path: pair it with a typed name so everyone can sign.",
  },
  Required: {
    title: "Required",
    description:
      "An empty pad blocks the submit and takes the focus; the Status says “Not signed”.",
  },
  ReadOnly: {
    title: "Read-only",
    description:
      "A saved signature shown again from its strokes; no drawing, Clear and Undo disabled.",
  },
}
