import { bindProp, setup, type } from "@rind-ui/core"
import { describe, expect, it } from "vitest"
import { disclosureMachine } from "../fixtures/disclosure"
import { paths, toGraph, uncovered } from "./graph"

describe("toGraph", () => {
  const graph = toGraph(disclosureMachine)

  it("reads every state and transition without running the machine", () => {
    expect(Object.keys(graph.nodes)).toEqual(["closed", "open"])
    expect(graph.nodes["open"]?.effects).toEqual(["listenEscape"])
    expect(graph.edges).toContainEqual({
      source: "open",
      target: "closed",
      event: "ESCAPE",
      guard: "closeOnEscape",
      actions: [],
    })
  })

  it("contains delayed and controlled edges", () => {
    const events = graph.edges.map((e) => `${e.source}:${e.event}`)
    expect(events).toContain("open:after:autoClose")
    expect(events).toContain("closed:$sync:open")
    expect(events).toContain("open:$sync:open")
  })
})

describe("paths", () => {
  const graph = toGraph(disclosureMachine)

  it("covers every walkable transition, dropping prefixes", () => {
    const walkable = (e: { event: string }) => !e.event.startsWith("$")
    const found = paths(graph, { walkable })
    expect(uncovered(graph, found).filter(walkable)).toEqual([])
    for (const p of found) {
      for (const q of found) {
        if (p !== q) expect(q.slice(0, p.length)).not.toEqual(p)
      }
    }
  })

  it("covers every state with shortest paths", () => {
    const found = paths(graph, { cover: "states" })
    expect(found.map((p) => p.map((e) => e.event))).toEqual([["OPEN"]])
  })
})

describe("read-only prop bindings in the graph", () => {
  it("appear as $sync:<prop> edges", () => {
    const m = setup({
      types: type<{ props: { pending?: boolean }; events: { type: "PRESS" }; env: object }>(),
    }).machine({
      id: "button",
      initial: "idle",
      values: { pending: bindProp({ fallback: false, states: { idle: false, pending: true } }) },
      states: { idle: { on: { PRESS: "pending" } }, pending: {} },
    })
    const events = toGraph(m).edges.map((e) => `${e.source}:${e.event}→${e.target}`)
    expect(events).toContain("idle:$sync:pending→pending")
    expect(events).toContain("pending:$sync:pending→idle")
  })
})
