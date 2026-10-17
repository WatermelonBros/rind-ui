// add-image 3.2: `alt` is a required decision on Root; Img's props and render callback are
// `img` props, its own `alt` excluded (the text alternative is Root's).
import { Image } from "@rind-ui/react"
import { createElement } from "react"
import { expectTypeOf } from "vitest"

// @ts-expect-error alt is required on Image.Root
createElement(Image.Root, {})
createElement(Image.Root, { alt: "" })
createElement(Image.Root, { alt: "A red bicycle" })

// @ts-expect-error the alt belongs on Image.Root
createElement(Image.Img, { alt: "A red bicycle" })

createElement(Image.Img, {
  render: (props) => {
    expectTypeOf(props.src).toEqualTypeOf<string | undefined>()
    expectTypeOf(props.alt).toEqualTypeOf<string | undefined>()
    return createElement("img", { src: props.src, alt: props.alt })
  },
})

declare const target: import("../driver").Target
const i = (await import("./image")).getImage(target, { name: "A red bicycle" })
void i.waitForStatus("error")
// @ts-expect-error not a status
void i.waitForStatus("done")
