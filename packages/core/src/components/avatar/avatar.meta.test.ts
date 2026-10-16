import { describe, expect, it } from "vitest"
import { imageStatusMachine } from "../image-status/image-status.machine"
import { avatarConnect, avatarGroupOverflowProps, avatarGroupProps } from "./avatar.connect"
import { avatarContract } from "./avatar.contract"
import { avatarMachine } from "./avatar.machine"
import { avatarMeta } from "./avatar.meta"

const dataKeys = (props: object) =>
  Object.keys(props)
    .filter((k) => k.startsWith("data-"))
    .sort()

describe("avatar meta matches the code", () => {
  it("contract", () => {
    expect(Object.keys(avatarMeta.contract.actions)).toEqual(Object.keys(avatarContract.actions))
    expect(avatarMeta.contract.queries).toEqual(Object.keys(avatarContract.queries))
    expect(avatarMeta.contract.traits).toEqual(avatarContract.traits)
  })
  it("states", () => {
    expect(Object.keys(avatarMeta.states).sort()).toEqual(
      Object.keys(avatarMachine.def.states).sort(),
    )
  })
  it("data attributes", () => {
    const api = avatarConnect({ instance: "i", status: "idle", named: true, hidden: false })
    expect(Object.keys(avatarMeta.dataAttributes.root).sort()).toEqual(dataKeys(api.root()))
    expect(Object.keys(avatarMeta.dataAttributes.image).sort()).toEqual(dataKeys(api.image(true)))
    expect(Object.keys(avatarMeta.dataAttributes.fallback).sort()).toEqual(dataKeys(api.fallback()))
    expect(Object.keys(avatarMeta.dataAttributes.group).sort()).toEqual(
      dataKeys(avatarGroupProps("i")),
    )
    expect(Object.keys(avatarMeta.dataAttributes["group-overflow"]).sort()).toEqual(
      dataKeys(avatarGroupOverflowProps("i")),
    )
  })
})

describe("Avatar and Image share one machine (image-loading-status)", () => {
  it("avatarMachine is the image status machine", () => {
    expect(avatarMachine).toBe(imageStatusMachine)
  })
})
