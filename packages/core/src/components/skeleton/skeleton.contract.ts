import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { skeletonMachine } from "./skeleton.machine"

type P = "root" | "status" | "content" | "item"

const isLoading = async (env: Env<P>) => (await env.part("root").attr("data-state")) === "loading"

/** Per-contract invariants (spec "Model-Based Coverage"). */
export const skeletonInvariants: readonly Invariant<P, string>[] = [
  {
    name: "skeleton-busy-while-loading",
    check: async ({ env, state }) => {
      const content = env.part("content")
      if ((await content.count()) === 0) return undefined
      const busy = await content.attr("aria-busy")
      if (state === "loading" && busy !== "true") return "Content lacks aria-busy while loading"
      if (state === "loaded" && busy !== null) return "Content keeps aria-busy when loaded"
      return undefined
    },
  },
  {
    name: "skeleton-items-hidden-while-loading",
    check: async ({ env }) => {
      for (const item of await env.part("item").all()) {
        const loading = (await item.attr("data-state")) === "loading"
        const hidden = (await item.attr("aria-hidden")) === "true"
        const inert = (await item.attr("inert")) !== null
        if (loading && !hidden) return "a loading Item is not aria-hidden"
        if (!loading && (hidden || inert)) return "a loaded Item keeps aria-hidden or inert"
      }
      return undefined
    },
  },
  {
    name: "skeleton-status-while-loading",
    check: async ({ env, state }) => {
      const shown = (await env.part("status").count()) > 0
      if (state === "loading" && shown && (await env.part("status").text()) === "") {
        return "the Status part is empty while loading"
      }
      if (state === "loaded" && shown) return "the Status part is rendered when loaded"
      return undefined
    },
  },
  {
    name: "skeleton-status-outside-content",
    check: async ({ env }) => {
      for (const content of await env.part("content").all()) {
        if ((await content.scoped("skeleton", "status").count()) > 0) {
          return "the Status part is inside Content (the busy region); move it outside"
        }
      }
      return undefined
    },
  },
]

/** Skeleton's contract (design §4). */
export const skeletonContract = contract("skeleton", {
  machine: skeletonMachine,
  anatomy: ["root", "status", "content", "item"],
  locate: () => ({ part: "root" }),
  actions: {},
  queries: {
    isLoading,
    /** The loading text; empty when loaded. */
    statusText: async (env: Env<P>) => {
      const s = env.part("status")
      return (await s.count()) > 0 ? s.text() : ""
    },
  },
  states: { loading: { isLoading: true }, loaded: { isLoading: false } },
  dataState: { loading: "loading", loaded: "loaded" },
  events: { "$sync:loading": { props: (target) => ({ loading: target === "loading" }) } },
  traits: [],
  invariants: skeletonInvariants,
})
