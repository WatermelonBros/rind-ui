"use client"

import { createFilter, createListCollection } from "@rind-ui/core"
import { Listbox, TextField } from "@rind-ui/react"
import { useMemo, useState } from "react"
import type { Variants } from "./types"

type City = { code: string; name: string; country: string; aliases: string[] }

const CITIES: City[] = [
  { code: "par", name: "Paris", country: "France", aliases: ["lutèce"] },
  { code: "lyo", name: "Lyon", country: "France", aliases: [] },
  { code: "nic", name: "Nice", country: "France", aliases: [] },
  { code: "zur", name: "Zürich", country: "Switzerland", aliases: ["zurigo"] },
  { code: "gen", name: "Genève", country: "Switzerland", aliases: ["geneva", "ginevra"] },
  { code: "mil", name: "Milano", country: "Italy", aliases: ["milan"] },
  { code: "rom", name: "Roma", country: "Italy", aliases: ["rome"] },
  { code: "tor", name: "Torino", country: "Italy", aliases: ["turin"] },
]

export function Basic() {
  const [query, setQuery] = useState("")
  // built once: a new collection instance is a collection change
  const cities = useMemo(
    () =>
      createListCollection({
        items: CITIES,
        getKey: (c) => c.code,
        getText: (c) => c.name,
        getKeywords: (c) => c.aliases,
        getSection: (c) => ({ key: c.country, label: c.country }),
      }),
    [],
  )
  const filter = useMemo(() => createFilter("en"), [])
  const items = useMemo(() => {
    const out: { key: string; label: string; section: { key: string; label: string } }[] = []
    for (const node of cities.filter((n) => filter.contains(n, query))) {
      if (node.type !== "item") continue
      out.push({
        key: node.key,
        label: node.textValue,
        section: { key: node.value.country, label: node.value.country },
      })
    }
    return out
  }, [cities, filter, query])
  return (
    <div className="stack">
      <TextField.Root value={query} onValueChange={setQuery}>
        <TextField.Label>Filter cities</TextField.Label>
        <TextField.Input placeholder="Try “geneve”, “turin” or “zurigo”" />
      </TextField.Root>
      <Listbox.Root items={items}>
        <Listbox.Label>Cities ({items.length})</Listbox.Label>
        <Listbox.List>
          <Listbox.Items />
        </Listbox.List>
        <Listbox.Empty>No city matches “{query}”</Listbox.Empty>
      </Listbox.Root>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Filtering a collection",
    description:
      "`createFilter` ignores case and accents and matches keywords; sections without items are dropped.",
  },
}
