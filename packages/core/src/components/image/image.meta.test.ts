import { describe, expect, it } from "vitest"
import { imageStatusMachine } from "../image-status/image-status.machine"
import { imageConnect } from "./image.connect"
import { imageContract } from "./image.contract"
import { imageMeta } from "./image.meta"

const dataKeys = (props: object) =>
  Object.keys(props)
    .filter((k) => k.startsWith("data-"))
    .sort()

describe("image meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(imageMeta.contract.actions)).toEqual(Object.keys(imageContract.actions))
    expect(imageMeta.contract.queries).toEqual(Object.keys(imageContract.queries))
    expect(imageMeta.contract.traits).toEqual(imageContract.traits)
  })
  it("states", () => {
    expect(Object.keys(imageMeta.states).sort()).toEqual(
      Object.keys(imageStatusMachine.def.states).sort(),
    )
  })
  it("data attributes (decorative included)", () => {
    const api = imageConnect({ instance: "i", status: "idle", alt: "" })
    expect(Object.keys(imageMeta.dataAttributes.root).sort()).toEqual(dataKeys(api.root()))
    expect(Object.keys(imageMeta.dataAttributes.img).sort()).toEqual(dataKeys(api.img(true)))
    expect(Object.keys(imageMeta.dataAttributes.fallback).sort()).toEqual(dataKeys(api.fallback()))
  })
})
