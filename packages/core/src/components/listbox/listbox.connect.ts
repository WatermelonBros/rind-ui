// Listbox parts: the reusable listbox parts under scope "listbox".

import type { CompositeEnv } from "../../collection/composite"
import { type ListboxPartsView, listboxParts } from "./listbox.parts"

export function listboxConnect(view: Omit<ListboxPartsView, "scope">, env: CompositeEnv) {
  return listboxParts({ ...view, scope: "listbox" }, env)
}
