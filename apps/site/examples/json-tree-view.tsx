"use client"

import { JsonTreeView } from "@rind-ui/react"
import type { States, Variants } from "./types"

/** Tree View's states (expanded, selected) are reached by the driver. */
export const states: States = {}

const RESPONSE = {
  id: "ord_9f2c",
  status: "shipped",
  total: 129.9,
  paid: true,
  coupon: null,
  customer: { name: "Ada Lovelace", email: "ada@example.com", tags: ["vip", "early"] },
  items: [
    { sku: "TEE-001", qty: 2, price: 24.95 },
    { sku: "MUG-014", qty: 1, price: 80 },
  ],
  createdAt: new Date("2026-10-26T09:30:00Z"),
}

export function Basic() {
  return <JsonTreeView.Root data={RESPONSE} aria-label="Order" />
}

export function ToolCall() {
  return (
    <JsonTreeView.Root
      aria-label="Tool call arguments"
      defaultExpandedDepth={2}
      data={{
        tool: "search_flights",
        arguments: { from: "MXP", to: "LIS", date: "2026-11-14", passengers: 2, flexible: false },
      }}
    />
  )
}

export function LargeArray() {
  return (
    <JsonTreeView.Root
      aria-label="Readings"
      data={{
        readings: Array.from({ length: 1000 }, (_, i) => Math.round(Math.sin(i / 20) * 1000) / 10),
      }}
    />
  )
}

export function JavaScriptValues() {
  const shared = { unit: "ms" }
  const loop: Record<string, unknown> = { name: "graph" }
  loop["self"] = loop
  return (
    <JsonTreeView.Root
      aria-label="JavaScript values"
      defaultExpandedDepth={1}
      data={{
        big: 12345678901234567890n,
        missing: undefined,
        notANumber: Number.NaN,
        when: new Date(0),
        pattern: /rind-?ui/gi,
        lookup: new Map([
          ["a", 1],
          ["b", 2],
        ]),
        unique: new Set(["x", "y"]),
        first: shared,
        second: shared,
        cycle: loop,
      }}
    />
  )
}

export const variants: Variants = {
  Basic: {
    title: "API response",
    // The visible key starts the name; the glyph summary is replaced by words (design §5).
    axeDisable: ["label-content-name-mismatch"],
    description:
      "Keys, typed values and collapsed containers with their size; arrows and typing move.",
  },
  ToolCall: {
    axeDisable: ["label-content-name-mismatch"],
    title: "Tool call",
    description: "An AI tool call's arguments, two levels open.",
  },
  LargeArray: {
    axeDisable: ["label-content-name-mismatch"],
    title: "A thousand items",
    description: "Grouped in ranges of 100; nothing is built until it opens.",
  },
  JavaScriptValues: {
    axeDisable: ["label-content-name-mismatch"],
    title: "JavaScript values",
    description:
      "BigInt in full, undefined, NaN, Date, RegExp, Map and Set; a value used twice shows twice, a cycle shows where it loops.",
  },
}
