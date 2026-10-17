"use client"

import { createNumberParser } from "@rind-ui/core"
import { useState } from "react"
import type { Variants } from "./types"

const LOCALES = ["en-US", "de-DE", "fr-CH", "ar-EG", "fa-IR", "hi-IN-u-nu-deva"]
const STYLES: Readonly<Record<string, Intl.NumberFormatOptions>> = {
  decimal: {},
  currency: { style: "currency", currency: "EUR" },
  percent: { style: "percent", maximumFractionDigits: 2 },
  unit: { style: "unit", unit: "kilometer" },
}

export function Basic() {
  const [locale, setLocale] = useState("de-DE")
  const [style, setStyle] = useState("currency")
  const [text, setText] = useState("1.234,56 €")
  const parser = createNumberParser(locale, STYLES[style] ?? {})
  const value = parser.parse(text)
  return (
    <div className="stack">
      <div className="row">
        <label className="stack">
          Locale
          <select className="native" value={locale} onChange={(e) => setLocale(e.target.value)}>
            {LOCALES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="stack">
          Format
          <select className="native" value={style} onChange={(e) => setStyle(e.target.value)}>
            {Object.keys(STYLES).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="stack">
        Text
        <input className="native" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <ul className="readout" aria-label="Parser output">
        <li>
          <code>parse → {value === null ? "null" : String(value)}</code>
        </li>
        <li>
          <code>isPartial → {String(parser.isPartial(text))}</code>
        </li>
        {value === null ? null : (
          <>
            <li>
              <code>format → {parser.format(value)}</code>
            </li>
            <li>
              <code>valueText → {parser.valueText(value)}</code>
            </li>
          </>
        )}
      </ul>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Parse and format in a locale",
    description:
      "Type, paste or switch the locale: separators, currency, percent and non-Latin digits.",
  },
}
