import { staticContract } from "../../contract/contract"

/**
 * Badge's contract (design §4): the one badge inside the driver's target (a badge has no
 * role and no name). `text`: what assistive technology gets (the `label` when set,
 * otherwise the text content; empty when hidden). No actions, no traits: a badge is never a
 * live region.
 */
export const badgeContract = staticContract("badge", {
  anatomy: ["root"],
  locate: () => ({ part: "root" }),
  actions: {},
  queries: {
    text: async (env) => {
      const root = env.part("root")
      if ((await root.attr("aria-hidden")) === "true") return ""
      const label = root.withAttr("data-visually-hidden")
      return (await label.count()) > 0 ? label.text() : root.text()
    },
    // ponytail: the root's own aria-hidden only; an aria-hidden ancestor needs an adapter query.
    isExposed: async (env) => (await env.part("root").attr("aria-hidden")) !== "true",
  },
  traits: [],
})
