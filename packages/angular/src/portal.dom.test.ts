// The layer portal: a host div[data-rind-portal] in the target (React's createPortal markup),
// rendered after the first render, carrying the logical parent's dir and lang, crossing DI,
// removed on destroy and moved when the container changes.
import { Component, type ElementRef, InjectionToken, inject, input, viewChild } from "@angular/core"
import { describe, expect, it } from "vitest"
import { mount } from "../fixtures/mount"
import { Portal } from "./portal"

const CTX = new InjectionToken<string>("ctx")

@Component({ selector: "rind-read", template: "{{ value }}" })
class Read {
  readonly value = inject(CTX, { optional: true }) ?? "outside"
}

@Component({
  selector: "rind-f",
  imports: [Portal],
  template: `<div dir="rtl" lang="ar">
    <button type="button" #trigger>Open</button>
    <ng-template rindPortal [logicalParent]="parent" hostClass="layer"><p>content</p></ng-template>
  </div>`,
})
class Lang {
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>("trigger")
  readonly parent = () => this.trigger()?.nativeElement ?? null
}

@Component({
  selector: "rind-f",
  imports: [Portal, Read],
  providers: [{ provide: CTX, useValue: "inside" }],
  template: `@if (shown()) {
      <ng-template rindPortal [container]="target()"><rind-read data-testid="ctx" /></ng-template>
    }`,
})
class Target {
  readonly shown = input(true)
  readonly target = input<HTMLElement | null>(null)
}

describe("Angular Portal", () => {
  it("renders a host in body after mount, with the logical parent's dir and lang", async () => {
    await mount(Lang)
    const hosts = document.body.querySelectorAll(":scope > [data-rind-portal]")
    expect(hosts).toHaveLength(1)
    const host = hosts[0] as HTMLElement
    expect(host.getAttribute("dir")).toBe("rtl")
    expect(host.getAttribute("lang")).toBe("ar")
    expect(host.classList.contains("layer")).toBe(true)
    expect(host.querySelector("p")?.textContent).toBe("content")
  })

  it("DI crosses the portal; destroy removes the host and keeps the target's children", async () => {
    const target = document.body.appendChild(document.createElement("section"))
    target.append(document.createElement("i"))
    const m = await mount(Target, { target })
    expect(target.querySelector("[data-testid=ctx]")?.textContent).toBe("inside")
    expect(target.firstElementChild?.tagName).toBe("I")
    await m.rerender({ shown: false })
    expect(target.querySelector("[data-rind-portal]")).toBeNull()
    expect(target.querySelector("i")).not.toBeNull()
    target.remove()
  })

  it("follows a changing container", async () => {
    const a = document.body.appendChild(document.createElement("div"))
    const b = document.body.appendChild(document.createElement("div"))
    const m = await mount(Target, { target: a })
    expect(a.querySelector("[data-rind-portal] [data-testid=ctx]")).not.toBeNull()
    await m.rerender({ target: b })
    expect(a.querySelector("[data-rind-portal]")).toBeNull()
    expect(b.querySelector("[data-rind-portal] [data-testid=ctx]")?.textContent).toBe("inside")
    a.remove()
    b.remove()
  })

  it("renders nothing on the server", async () => {
    const { serverHtml } = await import("../fixtures/parity")
    if (typeof process === "undefined") return
    expect(await serverHtml(Lang)).not.toContain("data-rind-portal")
  })
})
