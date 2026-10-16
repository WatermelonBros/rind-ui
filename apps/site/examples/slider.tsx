"use client"

import { Button, Slider, type SliderRootProps } from "@rind-ui/react"
import { type CSSProperties, useState } from "react"
import type { States, Variants } from "./types"

/** A Slider cannot be left mid-drag by a static render: `dragging` is reached by the driver. */
export const states: States = { slider: { idle: "Basic" } }

/** Control, Track, Indicator and `count` Thumbs; the skin gives them their size. */
function Bar({
  count = 1,
  disabledThumb,
  children,
}: {
  readonly count?: number
  readonly disabledThumb?: number
  readonly children?: React.ReactNode
}) {
  return (
    <Slider.Control>
      <Slider.Track>
        <Slider.Indicator />
      </Slider.Track>
      {children}
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: thumbs are identified by index
        <Slider.Thumb key={i} index={i} disabled={i === disabledThumb} />
      ))}
    </Slider.Control>
  )
}

function Field({ label, ...props }: SliderRootProps & { readonly label: string }) {
  const given = props.value ?? props.defaultValue
  return (
    <Slider.Root {...props}>
      <Slider.Label>{label}</Slider.Label>
      <Slider.ValueText />
      <Bar count={typeof given === "number" || given === undefined ? 1 : given.length} />
    </Slider.Root>
  )
}

export function Basic() {
  return <Field label="Volume" defaultValue={40} />
}

export function Range() {
  return (
    <Field
      label="Price"
      defaultValue={[20, 80]}
      formatOptions={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
    />
  )
}

export function ThreeThumbs() {
  return <Field label="Levels" defaultValue={[15, 50, 85]} />
}

export function GapAndCollision() {
  return (
    <div className="stack">
      {(["stop", "push", "swap"] as const).map((thumbCollision) => (
        <Field
          key={thumbCollision}
          label={`Collision: ${thumbCollision}`}
          defaultValue={[30, 60]}
          minStepsBetweenThumbs={5}
          thumbCollision={thumbCollision}
        />
      ))}
    </div>
  )
}

export function Vertical() {
  return (
    <div style={{ blockSize: "12rem" }}>
      <Field label="Level" defaultValue={60} orientation="vertical" />
    </div>
  )
}

export function Rtl() {
  return <Field label="Volume" defaultValue={[25, 75]} dir="rtl" />
}

export function Contain() {
  return (
    <Slider.Root
      defaultValue={[0, 100]}
      thumbAlignment="contain"
      style={{ "--rind-slider-thumb-size": "20px" } as CSSProperties}
    >
      <Slider.Label>Contained</Slider.Label>
      <Slider.ValueText />
      <Bar count={2} />
    </Slider.Root>
  )
}

export function Markers() {
  return (
    <Slider.Root defaultValue={50} step={25}>
      <Slider.Label>Quality</Slider.Label>
      <Slider.ValueText />
      <Bar>
        <Slider.MarkerGroup>
          {[0, 25, 50, 75, 100].map((value) => (
            <Slider.Marker key={value} value={value} />
          ))}
        </Slider.MarkerGroup>
      </Bar>
    </Slider.Root>
  )
}

export function DisabledThumb() {
  return (
    <Slider.Root defaultValue={[20, 70]}>
      <Slider.Label>Window</Slider.Label>
      <Slider.ValueText />
      <Bar count={2} disabledThumb={0} />
    </Slider.Root>
  )
}

export function ReadOnly() {
  return <Field label="Read-only" defaultValue={65} readOnly />
}

export function InForm() {
  const [sent, setSent] = useState("")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(new URLSearchParams(new FormData(e.currentTarget) as never).toString())
      }}
    >
      <Field label="Budget" name="budget" defaultValue={[20, 80]} />
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
        <span className="note">{sent || "Submit to see the form data"}</span>
      </div>
    </form>
  )
}

export function Controlled() {
  const [value, setValue] = useState(30)
  const [committed, setCommitted] = useState<number | null>(null)
  return (
    <div className="stack">
      <Slider.Root value={value} onValueChange={setValue} onValueCommit={setCommitted}>
        <Slider.Label>Brightness</Slider.Label>
        <Slider.ValueText />
        <Bar />
      </Slider.Root>
      <span className="note">
        value: {value} · last committed: {committed ?? "—"}
      </span>
    </div>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: "One thumb; `ValueText` shows the formatted value." },
  Range: {
    title: "Range",
    description: "An array value gives one thumb each; `formatOptions` formats the text.",
  },
  ThreeThumbs: { title: "Three thumbs", description: 'Thumbs are named "Value N of M".' },
  GapAndCollision: {
    title: "Gap and collision",
    description: "`minStepsBetweenThumbs` with `thumbCollision` stop, push and swap.",
  },
  Vertical: { title: "Vertical", description: '`orientation="vertical"`: Arrow Up increases.' },
  Rtl: { title: "Right to left", description: '`dir="rtl"` mirrors a horizontal Slider.' },
  Contain: {
    title: "Contained thumbs",
    description: '`thumbAlignment="contain"` with `--rind-slider-thumb-size` set on the Root.',
  },
  Markers: { title: "Markers", description: "`MarkerGroup` and `Marker` ticks at chosen values." },
  DisabledThumb: { title: "Disabled thumb", description: "`Thumb disabled` locks one value." },
  ReadOnly: { title: "Read-only", description: "Focusable and submitted, but ignores changes." },
  InForm: {
    title: "In a form",
    description: "One range input per thumb is submitted; reset restores `defaultValue`.",
  },
  Controlled: {
    title: "Controlled",
    description: "`onValueChange` on every change, `onValueCommit` once per interaction.",
  },
}
