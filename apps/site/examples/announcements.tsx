"use client"

import { Button, Field, Form, RindProvider, TextField } from "@rind-ui/react"
import { useMemo, useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  const [log, setLog] = useState<readonly { id: number; key?: string; text: string }[]>([])
  // An announcer that writes to the page instead of a hidden live region, to show what a
  // screen reader would hear. The list below is itself a polite live region.
  const announcer = useMemo(
    () => ({
      announce: ({
        message,
        priority = "polite",
        key,
      }: {
        message: string
        priority?: string
        key?: string
      }) =>
        setLog((l) => {
          const entry = {
            id: Date.now() + Math.random(),
            text: `${priority}: ${message}`,
            ...(key ? { key } : {}),
          }
          // like the real announcer, a message with the same key replaces the pending one
          const last = l[l.length - 1]
          return key && last?.key === key ? [...l.slice(0, -1), entry] : [...l.slice(-3), entry]
        }),
      prepare: () => () => {},
      cancel: () => {},
    }),
    [],
  )
  const [pending, setPending] = useState(false)
  return (
    <RindProvider announcer={announcer}>
      <div className="stack">
        <Form.Root aria-label="Newsletter">
          <div className="stack">
            <Field.Root name="name" required>
              <Field.Label>Name</Field.Label>
              <TextField.Root>
                <TextField.Input />
              </TextField.Root>
              <Field.ErrorMessage />
            </Field.Root>
            <Field.Root name="email" required>
              <Field.Label>Email</Field.Label>
              <TextField.Root>
                <TextField.Input type="email" />
              </TextField.Root>
              <Field.ErrorMessage />
            </Field.Root>
            <div className="row">
              <Button type="submit">Submit empty</Button>
              <Button
                pending={pending}
                onPress={() => {
                  setPending(true)
                  setTimeout(() => setPending(false), 2500)
                }}
              >
                {pending ? "Saving…" : "Save (stays pending)"}
              </Button>
            </div>
          </div>
        </Form.Root>
        <div role="log" aria-live="polite" aria-label="Announcements">
          <ol className="readout">
            {log.length === 0 ? (
              <li>Nothing announced yet</li>
            ) : (
              log.map((m) => <li key={m.id}>{m.text}</li>)
            )}
          </ol>
        </div>
      </div>
    </RindProvider>
  )
}

export const variants: Variants = {
  Basic: {
    title: "What a screen reader hears",
    description:
      "Submit with both fields empty: the Form says once how many have errors. Press Save: its pending state is announced.",
  },
}
