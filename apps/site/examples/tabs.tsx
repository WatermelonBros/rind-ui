"use client"

import { Tabs } from "@rind-ui/react"
import { useState } from "react"
import type { Variants } from "./types"

export function Basic() {
  return (
    <Tabs.Root defaultValue="account">
      <Tabs.List aria-label="Settings">
        <Tabs.Tab value="account">Account</Tabs.Tab>
        <Tabs.Tab value="billing">Billing</Tabs.Tab>
        <Tabs.Tab value="team">Team</Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="account">
        <p className="pad">Name, email and avatar.</p>
      </Tabs.Panel>
      <Tabs.Panel value="billing">
        <p className="pad">Plan, invoices and payment method.</p>
      </Tabs.Panel>
      <Tabs.Panel value="team">
        <p className="pad">Members, roles and invitations.</p>
      </Tabs.Panel>
    </Tabs.Root>
  )
}

export function Manual() {
  return (
    <Tabs.Root defaultValue="code" activationMode="manual">
      <Tabs.List aria-label="View">
        <Tabs.Tab value="code">Code</Tabs.Tab>
        <Tabs.Tab value="preview">Preview</Tabs.Tab>
        <Tabs.Tab value="tests">Tests</Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="code">
        <p className="pad">Arrows move focus; Enter or Space selects.</p>
      </Tabs.Panel>
      <Tabs.Panel value="preview">
        <p className="pad">The rendered result.</p>
      </Tabs.Panel>
      <Tabs.Panel value="tests">
        <p className="pad">The driver tests.</p>
      </Tabs.Panel>
    </Tabs.Root>
  )
}

export function Vertical() {
  return (
    <Tabs.Root defaultValue="general" orientation="vertical">
      <Tabs.List aria-label="Preferences">
        <Tabs.Tab value="general">General</Tabs.Tab>
        <Tabs.Tab value="editor">Editor</Tabs.Tab>
        <Tabs.Tab value="keys">Shortcuts</Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="general">
        <p className="pad">Language and start-up.</p>
      </Tabs.Panel>
      <Tabs.Panel value="editor">
        <p className="pad">Font, tabs and wrapping.</p>
      </Tabs.Panel>
      <Tabs.Panel value="keys">
        <p className="pad">Every command and its keys.</p>
      </Tabs.Panel>
    </Tabs.Root>
  )
}

export function Controlled() {
  const [value, setValue] = useState<string | null>("week")
  return (
    <div className="stack">
      <Tabs.Root value={value} onValueChange={setValue}>
        <Tabs.List aria-label="Range">
          <Tabs.Tab value="day">Day</Tabs.Tab>
          <Tabs.Tab value="week">Week</Tabs.Tab>
          <Tabs.Tab value="month">Month</Tabs.Tab>
          <Tabs.Indicator />
        </Tabs.List>
        {["day", "week", "month"].map((range) => (
          <Tabs.Panel key={range} value={range}>
            <p className="pad">Showing one {range}.</p>
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      <span className="note">value: {value ?? "none"}</span>
    </div>
  )
}

export function DisabledTab() {
  return (
    <Tabs.Root defaultValue="overview">
      <Tabs.List aria-label="Project">
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="deploys">Deploys</Tabs.Tab>
        <Tabs.Tab value="billing" disabled>
          Billing
        </Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="overview">
        <p className="pad">Status at a glance.</p>
      </Tabs.Panel>
      <Tabs.Panel value="deploys">
        <p className="pad">Every deploy, newest first.</p>
      </Tabs.Panel>
      <Tabs.Panel value="billing">
        <p className="pad">Owners only.</p>
      </Tabs.Panel>
    </Tabs.Root>
  )
}

export const variants: Variants = {
  Basic: { title: "Basic", description: "The Indicator slides to the selected tab." },
  Manual: {
    title: "Manual activation",
    description: '`activationMode="manual"`: arrows move focus, Enter or Space selects.',
  },
  Vertical: {
    title: "Vertical",
    description: "`orientation` decides which arrows move and sets `aria-orientation`.",
  },
  Controlled: { title: "Controlled", description: "`value` and `onValueChange`." },
  DisabledTab: { title: "Disabled tab", description: "Arrow keys skip a `disabled` tab." },
}
