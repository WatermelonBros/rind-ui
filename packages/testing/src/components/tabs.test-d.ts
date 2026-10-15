import type { Target } from "../driver"
import { getTabs } from "./tabs"

declare const target: Target
const g = getTabs(target, { name: "Settings" })

void g.select("Billing")
void g.focusTab("Billing")
void g.tabs()
void g.selected()
void g.focusedTab()
void g.panel()
void g.isDisabled("Billing")
// @ts-expect-error no such action
void g.explode()
// @ts-expect-error select takes a tab name
void g.select(1)
// @ts-expect-error isDisabled takes a tab name
void g.isDisabled(true)
// @ts-expect-error focusTab takes a tab name
void g.focusTab({})
