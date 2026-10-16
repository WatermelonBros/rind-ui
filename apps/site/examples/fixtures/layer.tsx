"use client"

// Ported from apps/storybook/stories/LayerFixture.stories.tsx: the foundation fixture, not a
// public component (Dialog and friends get their own changes).
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { createRoot } from "react-dom/client"
import { LayerExample } from "../../../../packages/testing/fixtures/layer/layer.fixture"
import { Layer } from "../../../../packages/testing/fixtures/layer/layer.react"
import type { States, Variants } from "../types"

export const states: States = { layer: { closed: "Closed", open: "Open" } }

export function Closed() {
  return <LayerExample />
}

export function Open() {
  return <LayerExample defaultOpen />
}

export function NestedModals() {
  return (
    <LayerExample defaultOpen label="Outer" title="Outer dialog">
      <LayerExample label="Inner" title="Inner dialog" />
    </LayerExample>
  )
}

export function SiblingModals() {
  return (
    <>
      <LayerExample label="First" title="First dialog" />
      <LayerExample label="Second" title="Second dialog" />
    </>
  )
}

export function MenuInDialog() {
  return (
    <LayerExample defaultOpen label="Dialog" title="Dialog with a menu">
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
  )
}

/** A modal menu registers its trigger: it stays exposed and names the menu (RA#9737). */
export function ModalMenu() {
  return <LayerExample defaultOpen kind="menu" label="Actions" title="Menu" />
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
export function ToastAboveModal() {
  return (
    <>
      <LayerExample defaultOpen label="Modal" title="Modal with a toast" />
      <TopLayerToast />
    </>
  )
}

function Foreign() {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => setHost(document.body), [])
  return host ? createPortal(<button type="button">Third party</button>, host) : null
}

export function ThirdPartyPortal() {
  return (
    <LayerExample defaultOpen label="Dialog" title="Dialog with a foreign portal">
      <Foreign />
    </LayerExample>
  )
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

export function NativeDialogInterop() {
  return <NativeDialog />
}

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

export function ShadowRoot() {
  return <ShadowHost />
}

/** Fullscreen needs a user gesture, so this only hosts the layer inside a fullscreen target. */
export function Fullscreen() {
  return (
    <div>
      <p>Request fullscreen on this container from a click; layers portal into it.</p>
      <LayerExample label="Open" />
    </div>
  )
}

export function RTL() {
  return (
    <div dir="rtl" lang="ar">
      <LayerExample defaultOpen />
    </div>
  )
}

export function ExitAnimation() {
  return (
    <>
      <style>{`
        [data-scope="layer"][data-part="content"] { transition: opacity 150ms; }
        [data-scope="layer"][data-part="content"][data-state="closed"] { opacity: 0; }
      `}</style>
      <LayerExample defaultOpen />
    </>
  )
}

export const variants: Variants = {
  Closed: { title: "Closed", hidden: true },
  Open: { title: "Open", hidden: true },
  NestedModals: { title: "Nested modals", hidden: true },
  SiblingModals: { title: "Sibling modals", hidden: true },
  MenuInDialog: { title: "Menu in dialog", hidden: true },
  ModalMenu: { title: "Modal menu", hidden: true },
  ToastAboveModal: { title: "Toast above modal", hidden: true },
  ThirdPartyPortal: { title: "Third-party portal", hidden: true },
  NativeDialogInterop: { title: "Native dialog interop", hidden: true },
  ShadowRoot: { title: "Shadow root", hidden: true },
  Fullscreen: { title: "Fullscreen", hidden: true },
  RTL: { title: "RTL", hidden: true },
  ExitAnimation: { title: "Exit animation", hidden: true },
}
