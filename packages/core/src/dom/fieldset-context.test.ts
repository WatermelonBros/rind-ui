// The disabled scope Fieldsets give their descendants (openspec fieldset "Disabled Propagation").
import { describe, expect, it } from "vitest"
import { type FieldsetScope, legendScope, scopeDisabled } from "./fieldset-context"

const scope = (disabled: boolean, parent: FieldsetScope | null = null): FieldsetScope => ({
  disabled,
  parent,
})

describe("scopeDisabled", () => {
  it("is false with no scope", () => {
    expect(scopeDisabled(null)).toBe(false)
  })

  it.each([
    ["enabled alone", scope(false), false],
    ["disabled alone", scope(true), true],
    ["enabled in enabled", scope(false, scope(false)), false],
    ["enabled in disabled", scope(false, scope(true)), true],
    ["disabled in enabled", scope(true, scope(false)), true],
    ["enabled in enabled in disabled", scope(false, scope(false, scope(true))), true],
    ["enabled x3", scope(false, scope(false, scope(false))), false],
  ])("%s", (_name, s, expected) => {
    expect(scopeDisabled(s)).toBe(expected)
  })
})

describe("legendScope", () => {
  it("has no scope outside any enclosing fieldset", () => {
    expect(legendScope(null)).toBeNull()
    expect(scopeDisabled(legendScope(scope(true)))).toBe(false)
  })

  it("is exempt from its own Fieldset", () => {
    expect(scopeDisabled(legendScope(scope(true, scope(false))))).toBe(false)
  })

  it("is not exempt from an enclosing disabled Fieldset", () => {
    expect(scopeDisabled(legendScope(scope(false, scope(true))))).toBe(true)
    expect(scopeDisabled(legendScope(scope(true, scope(true))))).toBe(true)
  })

  it("keeps a disabled grandparent through the exemption", () => {
    expect(scopeDisabled(legendScope(scope(true, scope(false, scope(true)))))).toBe(true)
  })
})
