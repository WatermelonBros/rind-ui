import { staticContract } from "../../contract/contract"

/** Heading's contract (design §4): located by role heading and exact name, one query. */
export const headingContract = staticContract("heading", {
  anatomy: ["root"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "heading", name }),
  actions: {},
  queries: {
    /** The exposed level: aria-level, else the native heading's tag. */
    level: async ({ part }) =>
      Number((await part("root").attr("aria-level")) ?? (await part("root").tagName()).slice(1)),
  },
  traits: [],
})
