import { describe, expectTypeOf, it } from "vitest"
import { setup, type } from "../machine"
import { type ActionArgsOf, contract, type ModalitiesOf } from "./contract"
import type { Env } from "./env"

const machine = setup({
  types: type<{ props: object; events: { type: "OPEN" } | { type: "CLOSE" }; env: object }>(),
}).machine({
  id: "d",
  initial: "closed",
  states: { closed: { on: { OPEN: "open" } }, open: { on: { CLOSE: "closed" } } },
})

const base = {
  machine,
  anatomy: ["trigger", "content"],
  locate: (name: string) => ({ role: "button", name }),
  queries: {
    isOpen: async (env: Env<"trigger" | "content">) =>
      (await env.part("trigger").attr("aria-expanded")) === "true",
  },
  traits: ["disclosure"],
} as const

describe("contract", () => {
  it("infers action arguments and modalities", () => {
    const c = contract("d", {
      ...base,
      queries: {
        isOpen: async (env) => (await env.part("trigger").attr("aria-expanded")) === "true",
      },
      actions: {
        open: {
          pointer: (env) => env.part("trigger").click(),
          keyboard: (env) => env.part("trigger").press("Enter"),
          done: { isOpen: true },
        },
        pick: {
          pointer: (env, label: string) =>
            env.part("content", { role: "option", name: label }).click(),
          none: { keyboard: "covered by another action" },
          done: async (env, label: string) => (await env.part("content").text()) === label,
        },
      },
      states: { open: { isOpen: true }, closed: { isOpen: false } },
      events: { OPEN: "open", CLOSE: { skip: "covered by OPEN's inverse" } },
    })
    expectTypeOf<ActionArgsOf<typeof c.actions.pick>>().toEqualTypeOf<[label: string]>()
    expectTypeOf<ModalitiesOf<typeof c.actions.open>>().toEqualTypeOf<
      "pointer" | "keyboard" | "virtual"
    >()
  })

  it("rejects an unknown part", () => {
    contract("d", {
      ...base,
      queries: {
        // @ts-expect-error "trigegr" is not in the anatomy
        isOpen: async (env) => (await env.part("trigegr").attr("aria-expanded")) === "true",
      },
      actions: {},
      states: { open: {}, closed: {} },
      events: {},
    })
  })

  it("rejects an unknown state", () => {
    contract("d", {
      ...base,
      actions: {},
      // @ts-expect-error "opne" is not a machine state
      states: { opne: {}, open: {}, closed: {} },
      events: {},
    })
  })

  it("rejects an unknown event", () => {
    contract("d", {
      ...base,
      actions: {},
      states: { open: {}, closed: {} },
      // @ts-expect-error OPNE is not a machine event
      events: { OPNE: { skip: "x" } },
    })
  })

  it("rejects an event mapped to a missing action", () => {
    contract("d", {
      ...base,
      actions: {},
      states: { open: {}, closed: {} },
      // @ts-expect-error no action "open"
      events: { OPEN: "open" },
    })
  })

  it("rejects a pointer action without a keyboard twin", () => {
    contract("d", {
      ...base,
      actions: {
        // @ts-expect-error pointer needs keyboard or none.keyboard
        open: { pointer: (env) => env.part("trigger").click(), done: { isOpen: true } },
      },
      states: { open: {}, closed: {} },
      events: {},
    })
  })

  it("rejects an unknown query in a postcondition", () => {
    contract("d", {
      ...base,
      actions: {
        open: {
          keyboard: (env) => env.part("trigger").press("Enter"),
          // @ts-expect-error "isOpn" is not a query
          done: { isOpn: true },
        },
      },
      states: { open: {}, closed: {} },
      events: {},
    })
  })

  it("rejects an action with no implementation, an empty reason, a misspelled modality and mismatched args", () => {
    contract("d", {
      ...base,
      actions: {
        // @ts-expect-error no implementation at all
        a: { none: { keyboard: "x" }, done: { isOpen: true } },
        // @ts-expect-error empty reason
        b: { pointer: (env) => env.part("trigger").click(), none: { keyboard: "" }, done: {} },
        c: {
          keyboard: (env) => env.part("trigger").press("Enter"),
          // @ts-expect-error misspelled modality
          pointr: (env: Env<"trigger" | "content">) => env.part("trigger").click(),
          done: {},
        },
        d: {
          pointer: (env, label: string) => env.part("trigger", { text: label }).click(),
          // @ts-expect-error keyboard takes a number while pointer takes a string
          keyboard: (env, n: number) => env.part("trigger").press(n > 0 ? "Enter" : "Space"),
          done: {},
        },
      },
      states: { open: {}, closed: {} },
      events: {},
    })
  })

  it("rejects an unknown part in an action", () => {
    contract("d", {
      ...base,
      actions: {
        open: {
          // @ts-expect-error "trigegr" is not in the anatomy
          keyboard: (env) => env.part("trigegr").press("Enter"),
          done: {},
        },
      },
      states: { open: {}, closed: {} },
      events: {},
    })
  })

  it("composite-activedescendant requires every announcement", () => {
    contract("d", {
      ...base,
      traits: ["composite-activedescendant"],
      actions: {},
      states: { open: {}, closed: {} },
      events: {},
      // @ts-expect-error countAnnouncement is missing
      announcements: {
        focusAnnouncement: () => "item",
        selectionAnnouncement: () => "selected",
      },
    })
  })

  it("an exception must reference a quirk that lists the invariant", () => {
    contract("d", {
      ...base,
      actions: {},
      states: { open: {}, closed: {} },
      events: {},
      exceptions: [
        { part: "trigger", invariant: "announcement-parity", quirk: "vo-activedescendant" },
      ],
    })
    contract("d", {
      ...base,
      actions: {},
      states: { open: {}, closed: {} },
      events: {},
      // @ts-expect-error vo-activedescendant does not list the disclosure invariant
      exceptions: [{ part: "trigger", invariant: "disclosure", quirk: "vo-activedescendant" }],
    })
  })
})
