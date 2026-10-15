import {
  CRITICAL,
  type DomEnvironment,
  domEnvironment,
  itemId,
  type PartProps,
  partId,
  scopeAttrs,
  setup,
  type,
} from "@rind-ui/core"
import { act, render, screen } from "@testing-library/react"
import {
  createContext,
  type ReactNode,
  type Ref,
  StrictMode,
  Suspense,
  startTransition,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import {
  mergeProps,
  normalizeProps,
  type PartRegistry,
  type RenderProp,
  type RindEventExtension,
  renderPart,
  useMachine,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
  useSelector,
} from "./index"

// A minimal component built only from the adapter's public API.
const log: string[] = []
const toggle = setup({
  types: type<{
    props: {
      defaultOn?: boolean | undefined
      on?: boolean | undefined
      onOnChange?: ((on: boolean) => void) | undefined
    }
    events: { type: "TOGGLE" }
    env: DomEnvironment
    values: "on"
  }>(),
  effects: {
    track: () => {
      log.push("start")
      return () => log.push("stop")
    },
  },
}).machine({
  id: "toggle",
  initial: "off",
  values: { on: { fallback: false, states: { on: true, off: false } } },
  states: { off: { on: { TOGGLE: "on" } }, on: { effects: ["track"], on: { TOGGLE: "off" } } },
})

type Part = "root" | "button" | "title" | "description" | "item"
interface CtxValue {
  readonly service: ReturnType<typeof useMachine<typeof toggle>>["service"]
  readonly root: string
  readonly registry: PartRegistry<Part>
}
const Ctx = createContext<CtxValue | null>(null)
const renders = { button: 0, title: 0 }

function useCtx(): CtxValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("no root")
  return ctx
}

interface RootProps {
  readonly defaultOn?: boolean
  readonly on?: boolean
  readonly onOnChange?: (on: boolean) => void
  readonly id?: string
  readonly children: ReactNode
}
function Root({ defaultOn, on, onOnChange, id, children }: RootProps) {
  const root = useRootId(id)
  // The title is expected: relations to it render on the server even when it comes later.
  const registry = usePartRegistry<Part>({ scope: "toggle", root, expected: ["title"] })
  const { service } = useMachine(toggle, { defaultOn, on, onOnChange }, domEnvironment())
  // A stable context value: parts re-render through their selectors, not through context.
  const value = useMemo(() => ({ service, root, registry }), [service, root, registry])
  return (
    <Ctx value={value}>
      <div {...scopeAttrs("toggle", "root", root)}>{children}</div>
    </Ctx>
  )
}
function usePart(part: Part, own: string | undefined) {
  const ctx = useCtx()
  const id = own ?? partId("toggle", ctx.root, part)
  useRegisterPart(ctx.registry, part, id)
  return { ctx, id }
}
function Button({
  render: r,
  ...rest
}: Record<string, unknown> & { render?: RenderProp<{ on: boolean }> }) {
  const { ctx, id } = usePart("button", rest["id"] as string | undefined)
  const on = useSelector(ctx.service, (v) => v.matches("on"))
  const title = useRenderedId(ctx.registry, "title")
  const description = useRenderedId(ctx.registry, "description")
  renders.button++
  const part: PartProps = {
    ...scopeAttrs("toggle", "button", ctx.root),
    id,
    class: "rind-button",
    style: { color: "red", margin: 0 },
    "aria-pressed": String(on),
    "aria-labelledby": title,
    "aria-describedby": description,
    onClick: () => ctx.service.send({ type: "TOGGLE" }),
    [CRITICAL]: ["aria-pressed"],
  }
  return renderPart("button", mergeProps(normalizeProps(part), { ...rest, id }), r, { on })
}
function Title({ id: own, children }: { id?: string; children: ReactNode }) {
  const { ctx, id } = usePart("title", own)
  renders.title++
  useSelector(ctx.service, () => "static")
  return (
    <span {...scopeAttrs("toggle", "title", ctx.root)} id={id}>
      {children}
    </span>
  )
}
function Description({ children }: { children: ReactNode }) {
  const { ctx, id } = usePart("description", undefined)
  return (
    <span {...scopeAttrs("toggle", "description", ctx.root)} id={id}>
      {children}
    </span>
  )
}
function Item({ value }: { value: string }) {
  const ctx = useCtx()
  return (
    <li {...scopeAttrs("toggle", "item", ctx.root)} id={itemId("toggle", ctx.root, "item", value)}>
      {value}
    </li>
  )
}
function Echo() {
  const on = useSelector(useCtx().service, (v) => v.matches("on"))
  return <span data-testid="echo">{String(on)}</span>
}
function Labelled({ label }: { label: string }) {
  const text = useSelector(useCtx().service, (v) => (v.matches("off") ? label : "-"))
  return <span data-testid="label">{text}</span>
}

describe("binding a service", () => {
  it("strict mode: effects active once after mount, all cleaned after unmount", () => {
    log.length = 0
    const { unmount } = render(
      <StrictMode>
        <Root defaultOn>
          <Button>x</Button>
        </Root>
      </StrictMode>,
    )
    expect(log.filter((l) => l === "start").length - log.filter((l) => l === "stop").length).toBe(1)
    unmount()
    expect(log.filter((l) => l === "start").length).toBe(log.filter((l) => l === "stop").length)
  })

  it("strict mode with a controlled prop follows the parent", async () => {
    function Parent() {
      const [on, setOn] = useState(false)
      return (
        <StrictMode>
          <Root on={on} onOnChange={setOn}>
            <Button>x</Button>
          </Root>
        </StrictMode>
      )
    }
    render(<Parent />)
    const button = screen.getByRole("button")
    await act(async () => button.click())
    expect(button.getAttribute("aria-pressed")).toBe("true")
    await act(async () => button.click())
    expect(button.getAttribute("aria-pressed")).toBe("false")
  })

  it("server render and hydration match, with items and relations in the server HTML", async () => {
    log.length = 0
    const ui = (
      <Root defaultOn>
        <Title>Mute</Title>
        <Button>x</Button>
        <ul>
          <Item value="a" />
          <Item value="b" />
        </ul>
      </Root>
    )
    const html = renderToString(ui)
    expect(log).toEqual([])
    expect(html).toMatch(/aria-labelledby="[^"]+-title"/)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    const ids = Array.from(container.querySelectorAll("[id]"), (el) => el.id)
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    await act(async () => {
      hydrateRoot(container, ui)
    })
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    expect(Array.from(container.querySelectorAll("[id]"), (el) => el.id)).toEqual(ids)
    expect(container.querySelector("button")?.getAttribute("aria-pressed")).toBe("true")
    container.remove()
  })

  it("no tearing: a transition update shows one state everywhere", async () => {
    render(
      <Root>
        <Button>x</Button>
        <Echo />
      </Root>,
    )
    const button = screen.getByRole("button")
    await act(async () => startTransition(() => button.click()))
    expect(button.getAttribute("aria-pressed")).toBe(screen.getByTestId("echo").textContent)
  })
})

describe("per-part subscriptions", () => {
  it("a part whose slice did not change does not re-render", async () => {
    render(
      <Root>
        <Title>Mute</Title>
        <Button>x</Button>
      </Root>,
    )
    const title = renders.title
    const button = renders.button
    await act(async () => screen.getByRole("button").click())
    expect(renders.button).toBeGreaterThan(button)
    expect(renders.title).toBe(title)
  })

  it("a controlled value with no state binding reaches selectors", async () => {
    const valued = setup({
      types: type<{
        props: {
          value?: string | undefined
          defaultValue?: string
          onValueChange?: (v: string) => void
        }
        events: { type: "X" }
        env: object
        values: "value"
      }>(),
    }).machine({
      id: "v",
      initial: "idle",
      values: { value: { fallback: "" } },
      states: { idle: {} },
    })
    type ValuedService = ReturnType<typeof useMachine<typeof valued>>["service"]
    let set!: (v: string) => void
    function Part({ service }: { service: ValuedService }) {
      return <span data-testid="part">{useSelector(service, (v) => v.values.value)}</span>
    }
    function Parent() {
      const [value, setValue] = useState("a")
      set = setValue
      const { service } = useMachine(valued, { value }, {})
      return <Part service={service} />
    }
    render(<Parent />)
    await act(async () => set("b"))
    expect(screen.getByTestId("part").textContent).toBe("b")
  })

  it("a selector closing over props stays current", async () => {
    let set!: (v: string) => void
    function Parent() {
      const [label, setLabel] = useState("one")
      set = setLabel
      return (
        <Root>
          <Labelled label={label} />
        </Root>
      )
    }
    render(<Parent />)
    await act(async () => set("two"))
    expect(screen.getByTestId("label").textContent).toBe("two")
  })
})

describe("props", () => {
  it("neutral attributes and handlers reach the DOM", async () => {
    render(
      <Root>
        <Button>x</Button>
      </Root>,
    )
    const button = screen.getByRole("button")
    expect(button.className).toBe("rind-button")
    expect(button.getAttribute("data-part")).toBe("button")
    await act(async () => button.click())
    expect(button.getAttribute("aria-pressed")).toBe("true")
  })

  it("normalises neutral names and kebab-case styles", () => {
    const out = normalizeProps({
      colspan: 2,
      onDblClick: () => {},
      onFocusIn: () => {},
      style: { "z-index": 1, "--rind-x": "1px" },
    })
    expect(Object.keys(out).sort()).toEqual(["colSpan", "onDoubleClick", "onFocus", "style"])
    expect(out["style"]).toEqual({ zIndex: 1, "--rind-x": "1px" })
  })

  it("merges consumer props: handlers in order, classes, styles, refs", async () => {
    const order: string[] = []
    const ref = { current: null as HTMLElement | null }
    render(
      <Root>
        <Button
          ref={ref}
          className="mine"
          style={{ color: "blue" }}
          onClick={() => order.push("consumer")}
        >
          x
        </Button>
      </Root>,
    )
    const button = screen.getByRole("button")
    await act(async () => button.click())
    expect(order).toEqual(["consumer"])
    expect(button.getAttribute("aria-pressed")).toBe("true")
    expect(button.className).toBe("rind-button mine")
    expect(button.style.color).toBe("blue")
    expect(button.style.margin).toBe("0px")
    expect(ref.current).toBe(button)
  })

  it("undefined consumer values do not erase the part's", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Root>
        <Button
          {...{
            onClick: undefined,
            className: undefined,
            "aria-pressed": undefined,
            id: undefined,
          }}
        >
          x
        </Button>
      </Root>,
    )
    const button = screen.getByRole("button")
    expect(button.className).toBe("rind-button")
    expect(button.id).not.toBe("")
    await act(async () => button.click())
    expect(button.getAttribute("aria-pressed")).toBe("true")
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("cannot be cleared"))
    warn.mockRestore()
  })

  it("preventRindHandler skips the part's handler, not the native default", async () => {
    let defaultPrevented = true
    render(
      <Root>
        <Button
          onClick={(e: { preventRindHandler(): void; defaultPrevented: boolean }) => {
            e.preventRindHandler()
            defaultPrevented = e.defaultPrevented
          }}
        >
          x
        </Button>
      </Root>,
    )
    const button = screen.getByRole("button")
    await act(async () => button.click())
    expect(button.getAttribute("aria-pressed")).toBe("false")
    expect(defaultPrevented).toBe(false)
  })

  it("a render element's preventRindHandler skips only the part's handler", async () => {
    const order: string[] = []
    render(
      <Root>
        <Button
          onClick={() => order.push("consumer")}
          render={
            <button
              type="button"
              onClick={(e) => {
                order.push("element")
                // mergeProps adds the extension to every event a part handles.
                ;(e as unknown as RindEventExtension).preventRindHandler()
              }}
            />
          }
        >
          x
        </Button>
      </Root>,
    )
    const button = screen.getByRole("button")
    await act(async () => button.click())
    expect(order).toEqual(["element", "consumer"])
    expect(button.getAttribute("aria-pressed")).toBe("false")
  })

  it("warns once when an accessibility-critical attribute is overridden, also via render", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const ui = (
      <Root id="crit">
        <Button render={<button type="button" aria-pressed="mixed" />}>x</Button>
      </Root>
    )
    const { rerender } = render(ui)
    rerender(ui)
    const calls = warn.mock.calls.filter((c) => String(c[0]).includes('"aria-pressed"'))
    expect(calls).toHaveLength(1)
    warn.mockRestore()
  })

  // Browser mode replaces process.env.NODE_ENV at build time, so this runs in jsdom only.
  const nodeEnv = (
    Reflect.get(globalThis, "process") as { env?: Record<string, string | undefined> } | undefined
  )?.env
  it.runIf(nodeEnv !== undefined)("production never warns", () => {
    const env = nodeEnv ?? {}
    const before = env["NODE_ENV"]
    env["NODE_ENV"] = "production"
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mergeProps(
      { "data-scope": "p", "data-part": "prod", role: "switch", [CRITICAL]: ["role"] },
      { role: "link" },
    )
    expect(warn).not.toHaveBeenCalled()
    env["NODE_ENV"] = before
    warn.mockRestore()
  })

  it("refs are not re-attached on every render", async () => {
    const calls: unknown[] = []
    const ref = (node: unknown) => {
      calls.push(node ? "el" : null)
    }
    let bump!: () => void
    function Probe() {
      const [n, setN] = useState(0)
      bump = () => setN(n + 1)
      return (
        <Root>
          <Button ref={ref}>x</Button>
        </Root>
      )
    }
    render(<Probe />)
    await act(async () => bump())
    await act(async () => bump())
    expect(calls).toEqual(["el"])
  })

  it("render as a link keeps ARIA, handlers and ref", async () => {
    const ref = { current: null as HTMLAnchorElement | null }
    render(
      <Root>
        <Button render={<a href="/x" ref={ref} onClick={(e) => e.preventDefault()} />}>Go</Button>
      </Root>,
    )
    const link = screen.getByRole("link")
    expect(link.getAttribute("aria-pressed")).toBe("false")
    expect(ref.current).toBe(link)
    await act(async () =>
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    )
    expect(link.getAttribute("aria-pressed")).toBe("true")
  })

  it("render function receives props (with the ref) and state", () => {
    function Probe() {
      const ref = useRef<HTMLButtonElement | null>(null)
      return (
        <Root defaultOn>
          <Button
            ref={ref}
            render={(props, state) => (
              <button {...props} data-has-ref={String(props["ref"] !== undefined)}>
                {state.on ? "on" : "off"}
              </button>
            )}
          />
        </Root>
      )
    }
    render(<Probe />)
    const button = screen.getByRole("button")
    expect(button.textContent).toBe("on")
    expect(button.getAttribute("data-has-ref")).toBe("true")
  })
})

describe("ids", () => {
  it("a consumer id is used by the relations that reference it", () => {
    render(
      <Root>
        <Title id="my-title">Mute</Title>
        <Button>x</Button>
      </Root>,
    )
    expect(screen.getByRole("button").getAttribute("aria-labelledby")).toBe("my-title")
  })

  it("a consumer id on the root becomes data-instance and the base of derived ids", () => {
    render(
      <Root id="mute">
        <Title>Mute</Title>
        <Button>x</Button>
      </Root>,
    )
    const button = screen.getByRole("button")
    expect(button.getAttribute("data-instance")).toBe("mute")
    expect(button.id).toBe("toggle-mute-button")
    expect(button.getAttribute("aria-labelledby")).toBe("toggle-mute-title")
  })

  it("two instances share no id", () => {
    const { container } = render(
      <>
        <Root>
          <Title>A</Title>
          <Button>a</Button>
        </Root>
        <Root>
          <Title>B</Title>
          <Button>b</Button>
        </Root>
      </>,
    )
    const ids = Array.from(container.querySelectorAll("[id]"), (el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("an unrendered part is not referenced", () => {
    render(
      <Root>
        <Button>x</Button>
      </Root>,
    )
    expect(screen.getByRole("button").hasAttribute("aria-describedby")).toBe(false)
  })

  it("a part rendered after the referencing one is referenced once mounted", () => {
    render(
      <Root>
        <Button>x</Button>
        <Description>More</Description>
      </Root>,
    )
    const id = screen.getByRole("button").getAttribute("aria-describedby")
    expect(id && document.getElementById(id)?.textContent).toBe("More")
  })
})

describe("instance scoping", () => {
  it("a portalled part carries the instance's data-instance", () => {
    const outside = document.createElement("div")
    document.body.append(outside)
    render(
      <Root id="t1">
        <Button>x</Button>
        {createPortal(<Description>Far away</Description>, outside)}
      </Root>,
    )
    expect(outside.firstElementChild?.getAttribute("data-instance")).toBe("t1")
    expect(screen.getByRole("button").getAttribute("data-instance")).toBe("t1")
    outside.remove()
  })
})

describe("expected parts (7.3)", () => {
  it("server HTML relates to an expected part rendered after the referencing one", async () => {
    const ui = (
      <Root id="ssr">
        <Button>x</Button>
        <Title>Mute</Title>
      </Root>
    )
    const html = renderToString(ui)
    expect(html).toMatch(/aria-labelledby="toggle-ssr-title"/)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    await act(async () => {
      hydrateRoot(container, ui)
    })
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    expect(container.querySelector("button")?.getAttribute("aria-labelledby")).toBe(
      "toggle-ssr-title",
    )
    container.remove()
  })

  it("a render that never commits leaves no reference", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const never = new Promise<void>(() => {})
    function Suspends(): ReactNode {
      throw never
    }
    render(
      <Root id="susp">
        <Suspense fallback={null}>
          <Title>T</Title>
          <Suspends />
        </Suspense>
        <Button>x</Button>
      </Root>,
    )
    const button = screen.getByRole("button")
    expect(button.hasAttribute("aria-labelledby")).toBe(false)
    warn.mockRestore()
  })

  it("an omitted expected part: no relation after commit, and a warning naming it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Root id="omit">
        <Button>x</Button>
      </Root>,
    )
    expect(screen.getByRole("button").hasAttribute("aria-labelledby")).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('expected part "title"'))
    warn.mockRestore()
  })
})

describe("second-pass review (react)", () => {
  it("an inline part ref composed with a consumer ref attaches once", async () => {
    const consumer: unknown[] = []
    const part: unknown[] = []
    const consumerRef = (el: unknown) => {
      consumer.push(el ? "el" : null)
    }
    let bump!: () => void
    function Probe({ refProp }: { refProp: Ref<HTMLDivElement> }) {
      const [n, setN] = useState(0)
      bump = () => setN(n + 1)
      const partRef = (el: unknown) => {
        part.push(el ? "el" : null)
      }
      return renderPart("div", mergeProps({ ref: partRef }, { ref: refProp }), undefined, n)
    }
    render(<Probe refProp={consumerRef} />)
    await act(async () => bump())
    await act(async () => bump())
    expect(consumer).toEqual(["el"])
    expect(part).toEqual(["el"])
  })

  it("null consumer handlers, classes and styles do not erase the part's", async () => {
    render(
      <Root>
        <Button {...{ onClick: null, className: null, style: null }}>x</Button>
      </Root>,
    )
    const button = screen.getByRole("button")
    expect(button.className).toBe("rind-button")
    await act(async () => button.click())
    expect(button.getAttribute("aria-pressed")).toBe("true")
  })
})
