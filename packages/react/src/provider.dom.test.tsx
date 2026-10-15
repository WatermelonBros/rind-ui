import { render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { RindProvider, useLocale, useMessages, useTypeaheadTimeout } from "./index"

const defaults: { close: string; open: string; results: (n: number) => string } = {
  close: "Close",
  open: "Open",
  results: (n) => `${n} results`,
}

declare module "./provider" {
  interface RindMessageScopes {
    dialog: typeof defaults
  }
}

function Probe({ messages }: { messages?: { close?: string } }) {
  const { locale, dir } = useLocale()
  const m = useMessages("dialog", defaults, messages)
  const timeout = useTypeaheadTimeout()
  return <output data-testid="probe">{`${locale}|${dir}|${m.close}|${m.open}|${timeout}`}</output>
}
const probe = () => screen.getByTestId("probe").textContent

describe("RindProvider", () => {
  it("nested providers override field by field; a new locale takes its own direction", () => {
    render(
      <RindProvider locale="de-DE" dir="ltr" typeaheadTimeout={1500}>
        <RindProvider locale="he-IL">
          <Probe />
        </RindProvider>
      </RindProvider>,
    )
    expect(probe()).toBe("he-IL|rtl|Close|Open|1500")
  })

  it("an inner provider's explicit direction wins", () => {
    render(
      <RindProvider locale="de-DE">
        <RindProvider locale="he-IL" dir="ltr">
          <Probe />
        </RindProvider>
      </RindProvider>,
    )
    expect(probe()).toBe("he-IL|ltr|Close|Open|1000")
  })

  it("messages by scope: provider overrides defaults, a component prop overrides the provider", () => {
    render(
      <RindProvider messages={{ dialog: { close: "Chiudi", open: "Apri" } }}>
        <Probe messages={{ close: "Fermer" }} />
      </RindProvider>,
    )
    expect(probe()).toContain("|Fermer|Apri|")
  })

  it("renders on the server with the provider's locale", () => {
    const html = renderToString(
      <RindProvider locale="ar">
        <Probe />
      </RindProvider>,
    )
    expect(html).toContain("ar|rtl|Close|Open|1000")
  })
})

describe("review round 1", () => {
  it("provider overrides are typed by scope (compile-time checks)", () => {
    const typed = (
      <RindProvider
        messages={{
          dialog: {
            close: "Chiudi",
            // @ts-expect-error "clsoe" is not a dialog message
            clsoe: "x",
          },
        }}
      />
    )
    // @ts-expect-error results is a function of a number, not a string
    const wrongType = <RindProvider messages={{ dialog: { results: "3 risultati" } }} />
    // @ts-expect-error "nope" is not a component scope
    const unknownScope = <RindProvider messages={{ nope: {} }} />
    expect([typed, wrongType, unknownScope]).toHaveLength(3)
  })

  it("follows <html lang> changes without a provider", async () => {
    document.documentElement.lang = "en"
    render(<Probe />)
    expect(probe()).toMatch(/^en\|ltr\|/)
    document.documentElement.lang = "he"
    await screen.findByText(/^he\|rtl\|/)
    document.documentElement.removeAttribute("lang")
  })
})
