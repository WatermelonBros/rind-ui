import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { createRoot } from "react-dom/client"
// The foundation fixture: not a public component (Dialog and friends get their own changes).
import { LayerExample } from "../../../packages/testing/fixtures/layer/layer.fixture"
import { Layer } from "../../../packages/testing/fixtures/layer/layer.react"

const meta = {
  title: "Foundations/Layer fixture",
  component: LayerExample,
  excludeStories: ["states"],
} satisfies Meta<typeof LayerExample>

/** State stories: contract scope → machine state → story export. */
export const states = { layer: { closed: "Closed", open: "Open" } }

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }

export const NestedModals: Story = {
  args: { defaultOpen: true, label: "Outer", title: "Outer dialog" },
  render: (args) => (
    <LayerExample {...args}>
      <LayerExample label="Inner" title="Inner dialog" />
    </LayerExample>
  ),
}

export const SiblingModals: Story = {
  render: () => (
    <>
      <LayerExample label="First" title="First dialog" />
      <LayerExample label="Second" title="Second dialog" />
    </>
  ),
}

export const MenuInDialog: Story = {
  args: { defaultOpen: true, label: "Dialog", title: "Dialog with a menu" },
  render: (args) => (
    <LayerExample {...args}>
      <Layer.Root modal={false}>
        <Layer.Trigger>Menu</Layer.Trigger>
        <Layer.Portal>
          <Layer.Positioner>
            <Layer.Content>
              <Layer.Title>Menu layer</Layer.Title>
              <Layer.Close>Dismiss menu</Layer.Close>
            </Layer.Content>
          </Layer.Positioner>
        </Layer.Portal>
      </Layer.Root>
    </LayerExample>
  ),
}

function TopLayerToast() {
  // A child of <body>, like a real toast host: the app root is made inert wholesale.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => setHost(document.body), [])
  return host
    ? createPortal(
        <section
          data-rind-top-layer
          aria-label="Notifications"
          style={{ position: "fixed", insetBlockEnd: 0, insetInlineStart: 0, zIndex: 1000 }}
        >
          <button type="button">Undo</button>
        </section>,
        host,
      )
    : null
}

/** A toast region marked `data-rind-top-layer` stays interactive above an open modal. */
export const ToastAboveModal: Story = {
  args: { defaultOpen: true, label: "Modal", title: "Modal with a toast" },
  render: (args) => (
    <>
      <LayerExample {...args} />
      <TopLayerToast />
    </>
  ),
}

function Foreign() {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => setHost(document.body), [])
  return host ? createPortal(<button type="button">Third party</button>, host) : null
}
export const ThirdPartyPortal: Story = {
  args: { defaultOpen: true, label: "Dialog", title: "Dialog with a foreign portal" },
  render: (args) => (
    <LayerExample {...args}>
      <Foreign />
    </LayerExample>
  ),
}

function NativeDialog() {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) el.showModal()
    return () => el?.close()
  }, [])
  return (
    <dialog ref={dialog} aria-label="Native dialog">
      <LayerExample defaultOpen label="Inside native" title="Layer in a native dialog" />
    </dialog>
  )
}
export const NativeDialogInterop: Story = { render: () => <NativeDialog /> }

function ShadowHost() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const shadow = el.shadowRoot ?? el.attachShadow({ mode: "open" })
    const mount = document.createElement("div")
    shadow.append(mount)
    const root = createRoot(mount)
    root.render(<LayerExample label="In shadow" title="Shadow dialog" />)
    // Unmount after the current render pass: React forbids a sync unmount during render.
    return () => {
      queueMicrotask(() => root.unmount())
      mount.remove()
    }
  }, [])
  return <div ref={host} />
}
export const ShadowRoot: Story = { render: () => <ShadowHost /> }

/** Fullscreen needs a user gesture, so this only hosts the layer inside a fullscreen target. */
export const Fullscreen: Story = {
  render: () => (
    <div>
      <p>Request fullscreen on this container from a click; layers portal into it.</p>
      <LayerExample label="Open" />
    </div>
  ),
}

export const RTL: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <div dir="rtl" lang="ar">
      <LayerExample {...args} />
    </div>
  ),
}

export const ExitAnimation: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <>
      <style>{`
        [data-scope="layer"][data-part="content"] { transition: opacity 150ms; }
        [data-scope="layer"][data-part="content"][data-state="closed"] { opacity: 0; }
      `}</style>
      <LayerExample {...args} />
    </>
  ),
}
