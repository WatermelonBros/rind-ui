// Number Input server markup (task 4.2): the formatted default and the platform-independent
// inputMode on the server, a clean hydration, inputMode refined after mount (iPhone: text,
// react-spectrum#8503), and a server/client locale difference reformatted after hydration.
import { platforms } from "@rind-ui/core"
import { NumberInput, type NumberInputRootProps, RindProvider } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (props: NumberInputRootProps = {}, platform = platforms.linux) => (
  <RindProvider environment={{ platform }}>
    <form>
      <NumberInput.Root name="q" {...props}>
        <NumberInput.Label>Quantity</NumberInput.Label>
        <NumberInput.Input />
        <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
      </NumberInput.Root>
    </form>
  </RindProvider>
)

async function hydrate(server: ReactNode, client: ReactNode = server) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(server)
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, client, { onRecoverableError: (e) => error(String(e)) })
  })
  const input = container.querySelector<HTMLInputElement>('[data-part="input"]')
  const after = { inputMode: input?.inputMode, value: input?.value }
  const calls = [...error.mock.calls]
  await act(async () => root?.unmount())
  container.remove()
  return { calls, after }
}

describe("Number Input server render", () => {
  it("defaultValue formatted on the server; the hidden input submits the raw number", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(
      tree({ defaultValue: 1234.5, formatOptions: { style: "currency", currency: "USD" } }),
    )
    expect(box.querySelector<HTMLInputElement>('[data-part="input"]')?.value).toBe("$1,234.50")
    expect(box.querySelector('[data-part="input"]')?.getAttribute("inputmode")).toBe("decimal")
    expect([...new FormData(box.querySelector("form") as HTMLFormElement)]).toEqual([
      ["q", "1234.5"],
    ])
  })

  it("iPhone hydration (react-spectrum#8503): no mismatch, then inputMode text", async () => {
    const { calls, after } = await hydrate(tree({ step: 0.5 }, platforms.ios))
    expect(calls).toEqual([])
    expect(after.inputMode).toBe("text")
  })

  it("a server/client locale difference is reformatted after hydration without errors", async () => {
    const { calls, after } = await hydrate(
      tree({ defaultValue: 1234.5, locale: "en-US" }),
      tree({ defaultValue: 1234.5, locale: "de-DE" }),
    )
    expect(calls).toEqual([])
    expect(after.value).toBe(new Intl.NumberFormat("de-DE").format(1234.5))
  })
})
