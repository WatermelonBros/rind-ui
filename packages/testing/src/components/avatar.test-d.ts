// Avatar.Image's render callback is typed as img props (mui/base-ui#5102).
import { Avatar } from "@rind-ui/react"
import { createElement } from "react"
import { expectTypeOf } from "vitest"

createElement(Avatar.Image, {
  render: (props) => {
    expectTypeOf(props.src).toEqualTypeOf<string | undefined>()
    expectTypeOf(props.alt).toEqualTypeOf<string | undefined>()
    return createElement("img", { src: props.src, alt: props.alt })
  },
})

declare const target: import("../driver").Target
const a = (await import("./avatar")).getAvatar(target, { name: "Ada Lovelace" })
void a.waitForStatus("loaded")
// @ts-expect-error not a status
void a.waitForStatus("done")
