"use client"

import { formatColor, getChannel, tryParseColor, withChannel } from "@rind-ui/core"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  const [text, setText] = useState("#3366ff")
  const parsed = tryParseColor(text)
  return (
    <div className="stack">
      <label className="stack">
        Any CSS colour
        <input className="native" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {parsed ? (
        <>
          <label className="stack">
            Saturation {getChannel(parsed, "saturation")}
            <input
              type="range"
              min={0}
              max={100}
              value={getChannel(parsed, "saturation")}
              onChange={(e) =>
                setText(
                  formatColor(withChannel(parsed, "saturation", Number(e.target.value)), "hex"),
                )
              }
            />
          </label>
          <div
            aria-hidden="true"
            style={{ height: 32, borderRadius: 8, background: formatColor(parsed, "css") }}
          />
          <ul className="readout" aria-label="Formatted">
            {(["hex", "rgb", "hsl", "hsb"] as const).map((f) => (
              <li key={f}>
                <code>{formatColor(parsed, f)}</code>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="note">tryParseColor → null: not a colour.</p>
      )}
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "One colour, every format",
    description: "Parse any CSS colour, move a channel the space lacks, format it back.",
  },
}
