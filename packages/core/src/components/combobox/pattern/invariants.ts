// combobox-pattern "Usable Without A Popup": the invariant every host whose options are never
// selected declares (free text, inline): no option is ever aria-selected="true" (a highlight
// read as a selection is the cmdk#83 bug class).
import type { Invariant } from "../../../contract/contract"

export const optionsNeverSelected: Invariant<"item", string> = {
  name: "options-never-selected",
  check: async ({ env }) => {
    for (const p of await env.part("item").all()) {
      if ((await p.attr("role")) !== "option") continue
      if ((await p.attr("aria-selected")) === "true") {
        return `the option "${await p.text()}" is aria-selected="true" (nothing can be selected)`
      }
    }
    return undefined
  },
}
