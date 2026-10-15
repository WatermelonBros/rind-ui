import type { Target } from "../driver"
import { getToggle } from "./toggle"

declare const target: Target
const t = getToggle(target, { name: "Bold" })

void t.setPressed(true)
void t.activateWithEnter(false)
// @ts-expect-error no such action
void t.explode()
// @ts-expect-error pressed must be a boolean
void t.setPressed("x")
