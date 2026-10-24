/** @jsxImportSource solid-js */
// Link: the same markup as @rind-ui/react; routes through the RouterProvider.
import * as R from "@rind-ui/react"
import { expectRindWarning } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Link, RouterProvider } from "../index"

describe("Solid Link", () => {
  it("matches React: href, external, disabled, current, substitution", async () => {
    await clientParity(r(R.Link, { href: "/a" }, "A"), () => <Link href="/a">A</Link>)
    await clientParity(r(R.Link, { href: "mailto:a@b.c" }, "M"), () => (
      <Link href="mailto:a@b.c">M</Link>
    ))
    await clientParity(r(R.Link, { href: "https://x.test/", target: "_blank" }, "X"), () => (
      <Link href="https://x.test/" target="_blank">
        X
      </Link>
    ))
    await clientParity(r(R.Link, { href: "/a", disabled: true }, "D"), () => (
      <Link href="/a" disabled>
        D
      </Link>
    ))
    await clientParity(
      r(R.Link, { href: "/a", disabled: true, focusableWhenDisabled: true }, "D"),
      () => (
        <Link href="/a" disabled focusableWhenDisabled>
          D
        </Link>
      ),
    )
    await clientParity(r(R.Link, { href: "/a", current: "page" }, "C"), () => (
      <Link href="/a" current="page">
        C
      </Link>
    ))
    await clientParity(
      r(R.Link, { href: "/a", download: "f.txt", hrefLang: "it", referrerPolicy: "origin" }, "L"),
      () => (
        <Link href="/a" download="f.txt" hreflang="it" referrerpolicy="origin">
          L
        </Link>
      ),
    )
    // Both adapters warn about the div fallback.
    expectRindWarning(/rendered as <div>/)
    await clientParity(r(R.Link, { href: "/a", render: r("div") }, "F"), () => (
      <Link href="/a" render={(p) => <div {...p} />}>
        F
      </Link>
    ))
  })

  it("routes through RouterProvider; a disabled link drops the consumer's click", () => {
    const navigate = vi.fn()
    const onClick = vi.fn()
    const onActivate = vi.fn()
    mount(() => (
      <RouterProvider navigate={navigate}>
        <Link href="/docs" onActivate={onActivate}>
          Docs
        </Link>
        <Link href="/off" disabled onClick={onClick}>
          Off
        </Link>
      </RouterProvider>
    ))
    screen.getByRole("link", { name: "Docs" }).click()
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate.mock.calls[0]?.[0]).toBe("/docs")
    expect(onActivate).toHaveBeenCalledTimes(1)
    screen.getByText("Off").click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it("an enabled link keeps the consumer's click, bound handlers included", () => {
    const onClick = vi.fn((e: MouseEvent) => e.preventDefault())
    const bound = vi.fn((_: string, e: MouseEvent) => e.preventDefault())
    mount(() => (
      <>
        <Link href="/a" onClick={onClick}>
          Plain
        </Link>
        <Link href="/b" onClick={[bound, "data"]}>
          Bound
        </Link>
      </>
    ))
    screen.getByText("Plain").click()
    screen.getByText("Bound").click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(bound).toHaveBeenCalledWith("data", expect.any(MouseEvent))
  })
})
