// useParentLayer(kinds): the nearest enclosing layer of an allowed kind; a provider that
// declared no kind never matches then (a future Menu written without kind must not become
// a dialog's parent: radix#1836).
import { layerId } from "@rind-ui/core"
import { render } from "@testing-library/react"
import { expect, it } from "vitest"
import { LayerProvider, useParentLayer } from "./layer-context"

function Probe({ out }: { out: { value?: string | undefined } }) {
  out.value = useParentLayer(["dialog", "alertdialog", "drawer"])
  return null
}

it("skips menu-kind and kindless layers when kinds are given", () => {
  const out: { value?: string | undefined } = {}
  render(
    <LayerProvider layer={layerId("outer")} kind="dialog">
      <LayerProvider layer={layerId("menu")} kind="menu">
        <LayerProvider layer={layerId("kindless")}>
          <Probe out={out} />
        </LayerProvider>
      </LayerProvider>
    </LayerProvider>,
  )
  expect(out.value).toBe("outer")
})

it("with no allowed ancestor there is no parent", () => {
  const out: { value?: string | undefined } = {}
  render(
    <LayerProvider layer={layerId("menu")} kind="menu">
      <LayerProvider layer={layerId("kindless")}>
        <Probe out={out} />
      </LayerProvider>
    </LayerProvider>,
  )
  expect(out.value).toBeUndefined()
})

it("without kinds the nearest layer is the parent, kindless included", () => {
  let value: string | undefined
  function Any() {
    value = useParentLayer()
    return null
  }
  render(
    <LayerProvider layer={layerId("menu")} kind="menu">
      <LayerProvider layer={layerId("kindless")}>
        <Any />
      </LayerProvider>
    </LayerProvider>,
  )
  expect(value).toBe("kindless")
})
