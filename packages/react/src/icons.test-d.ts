import { createElement } from "react"
import { type IconName, RindProvider } from "./index"

const Foo = () => createElement("i")

createElement(RindProvider, { icons: { check: Foo, "caret-down": Foo } })
// @ts-expect-error unknown icon name
createElement(RindProvider, { icons: { chek: Foo } })

export const name: IconName = "arrow-left"
