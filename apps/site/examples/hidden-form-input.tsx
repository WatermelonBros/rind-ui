"use client"

import { Button, CheckboxGroup, Switch } from "@rind-ui/react"
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
      <CheckboxGroup.Item name="terms" defaultChecked>
        <CheckboxGroup.ItemControl>
          <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
        </CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemLabel>Accept the terms</CheckboxGroup.ItemLabel>
      </CheckboxGroup.Item>
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
