import type { Target } from "../driver"
import { getToggleGroup } from "./toggle-group"

declare const target: Target
const g = getToggleGroup(target, { name: "Alignment" })

void g.toggle("Left")
void g.pressed()
void g.isDisabled("Left")
// @ts-expect-error no such action
void g.explode()
// @ts-expect-error toggle takes an item name
void g.toggle(1)
// @ts-expect-error isDisabled takes an item name
void g.isDisabled(true)
