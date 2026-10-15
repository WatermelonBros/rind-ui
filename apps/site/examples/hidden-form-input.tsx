"use client"

import { Button, Checkbox, Switch } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  const [sent, setSent] = useState("Submit to see what the form sends")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(
          new URLSearchParams(new FormData(e.currentTarget) as never).toString() || "(nothing)",
        )
      }}
    >
      <Checkbox.Root name="terms" defaultChecked>
        <Checkbox.Control>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label>Accept the terms</Checkbox.Label>
      </Checkbox.Root>
      <Switch.Root name="news" value="weekly" uncheckedValue="never">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Newsletter</Switch.Label>
      </Switch.Root>
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
      </div>
      <span className="note">{sent}</span>
    </form>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Real form data",
    description:
      "Each control keeps one hidden native input, so `FormData`, `required` and reset work with no glue.",
  },
}
