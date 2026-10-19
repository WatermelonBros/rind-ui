"use client"

import { Button, Rating, type RatingRootProps } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** The hover preview lasts while a pointer is over the stars: `previewing` is reached by the driver. */
export const states: States = { rating: { idle: "Basic" } }

/** A Label and `count` stars; the skin draws them. */
function Stars({ label, ...props }: RatingRootProps & { readonly label: string }) {
  const count = props.count ?? 5
  return (
    <Rating.Root {...props}>
      <Rating.Label>{label}</Rating.Label>
      <Rating.Control>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stars are identified by position
          <Rating.Item key={i} index={i + 1} />
        ))}
      </Rating.Control>
    </Rating.Root>
  )
}

export function Basic() {
  return <Stars label="Rate this recipe" defaultValue={3} />
}

export function HalfStars() {
  return <Stars label="Overall" defaultValue={3.5} allowHalf />
}

export function Clearable() {
  return <Stars label="Clearable" defaultValue={2} allowClear />
}

export function TenStars() {
  return <Stars label="Out of ten" count={10} defaultValue={7} />
}

export function Rtl() {
  return <Stars label="Right to left" defaultValue={2.5} allowHalf dir="rtl" />
}

export function ReadOnly() {
  return <Stars label="Average rating" defaultValue={4.5} allowHalf readOnly />
}

export function Disabled() {
  return <Stars label="Disabled" defaultValue={2} disabled />
}

export function Controlled() {
  const [value, setValue] = useState(4)
  const words = ["No rating", "Poor", "Fair", "Good", "Very good", "Excellent"]
  return (
    <div className="stack">
      <Stars label="Service" value={value} onValueChange={setValue} allowClear />
      <span className="note">
        value: {value} · {words[value]}
      </span>
    </div>
  )
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
      <Stars label="Your stay" name="stay" required />
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
        <span className="note">{sent || "Submit to see the form data"}</span>
      </div>
    </form>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: "Five stars; arrows, Home and End change the value." },
  HalfStars: {
    title: "Half stars",
    description: "`allowHalf`: the first half of a star, and each arrow, is half a star.",
  },
  Clearable: {
    title: "Clearable",
    description: "`allowClear`: pressing the current value, or Home, gives no rating.",
  },
  TenStars: { title: "Ten stars", description: "`count` sets the number of stars." },
  Rtl: { title: "Right to left", description: '`dir="rtl"` mirrors the stars and the arrows.' },
  ReadOnly: {
    title: "Read-only",
    description: "Focusable and announced, but ignores changes; no hover preview.",
  },
  Disabled: { title: "Disabled", description: "Out of the tab order and not submitted." },
  Controlled: {
    title: "Controlled",
    description: "`value` and `onValueChange`: the parent owns the value.",
  },
  InForm: {
    title: "In a form",
    description:
      '`required`: unrated submits "" and fails validation; reset restores `defaultValue`.',
  },
}
