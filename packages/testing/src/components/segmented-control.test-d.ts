import type { Target } from "../driver"
import { getSegmentedControl } from "./segmented-control"

declare const target: Target
const g = getSegmentedControl(target, { name: "Range" })

void g.select("Week")
void g.select(/week/i)
void g.focusSegment("Week")
void g.press("Week")
void g.segments()
void g.selected()
void g.focusedSegment()
void g.isDisabled("Week")
void g.formValue()
// @ts-expect-error no such action
void g.explode()
// @ts-expect-error select takes a segment name
void g.select(1)
// @ts-expect-error isDisabled takes a segment name
void g.isDisabled(true)
// @ts-expect-error focusSegment takes a segment name
void g.focusSegment({})
// @ts-expect-error the anchor needs a name
getSegmentedControl(target, {})
