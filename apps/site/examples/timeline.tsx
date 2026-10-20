"use client"

import { Timeline } from "@rind-ui/react"
import type { Variants } from "./types"

const COLUMN = { inlineSize: "min(100%, 520px)" } as const

const ORDER = [
  { title: "Ordered", text: "2 items, paid by card.", at: "2026-10-14T09:12:00Z", when: "Oct 14" },
  {
    title: "Shipped",
    text: "Handed to the courier in Milan.",
    at: "2026-10-16T15:40:00Z",
    when: "Oct 16",
  },
  {
    title: "Out for delivery",
    text: "Expected before 6 pm.",
    at: "2026-10-20T07:05:00Z",
    when: "Today",
  },
  { title: "Delivered", text: "Signature on delivery." },
]

export function OrderProgress() {
  return (
    <div style={COLUMN}>
      <Timeline.Root aria-label="Order status" current={2}>
        {ORDER.map((e, index) => (
          <Timeline.Item key={e.title} index={index}>
            <Timeline.Indicator />
            <Timeline.Connector />
            <Timeline.Content>
              <Timeline.Title>{e.title}</Timeline.Title>
              <Timeline.Description>{e.text}</Timeline.Description>
              {e.at ? <Timeline.Time dateTime={e.at}>{e.when}</Timeline.Time> : null}
            </Timeline.Content>
          </Timeline.Item>
        ))}
      </Timeline.Root>
    </div>
  )
}

const RELEASES = [
  { version: "0.6", text: "Stepper, Image Cropper, Table of Contents.", at: "2026-10-20" },
  { version: "0.5", text: "Streaming Message, Message Thread, Reasoning.", at: "2026-10-19" },
  { version: "0.4", text: "Marquee, Clipboard, File Upload.", at: "2026-10-12" },
]

export function Releases() {
  return (
    <div style={COLUMN}>
      <Timeline.Root aria-label="Releases" align="alternate">
        {RELEASES.map((r, index) => (
          <Timeline.Item key={r.version} index={index}>
            <Timeline.Opposite>
              <Timeline.Time dateTime={r.at} />
            </Timeline.Opposite>
            <Timeline.Indicator />
            <Timeline.Connector />
            <Timeline.Content>
              <Timeline.Title>Version {r.version}</Timeline.Title>
              <Timeline.Description>{r.text}</Timeline.Description>
            </Timeline.Content>
          </Timeline.Item>
        ))}
      </Timeline.Root>
    </div>
  )
}

const DEPLOY = ["Build", "Test", "Deploy", "Verify"]

export function Pipeline() {
  return (
    <div style={{ inlineSize: "min(100%, 640px)" }}>
      <Timeline.Root aria-label="Deployment" orientation="horizontal" current={2}>
        {DEPLOY.map((step, index) => (
          <Timeline.Item
            key={step}
            index={index}
            {...(index === 2 ? { status: "pending" as const } : {})}
          >
            <Timeline.Indicator />
            <Timeline.Connector />
            <Timeline.Content>
              <Timeline.Title>{step}</Timeline.Title>
            </Timeline.Content>
          </Timeline.Item>
        ))}
      </Timeline.Root>
    </div>
  )
}

export const variants: Variants = {
  OrderProgress: {
    title: "Order progress",
    description:
      "`current={2}`: earlier events are completed, later ones not started; each title says its status to screen readers.",
  },
  Releases: {
    title: "Alternate",
    description: '`align="alternate"` with dates opposite; the reading order stays the list\'s.',
  },
  Pipeline: {
    title: "Horizontal",
    description:
      '`orientation="horizontal"`; the running step has `status="pending"` ("in progress").',
  },
}
