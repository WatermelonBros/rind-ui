import { describe, expect, it } from "vitest"
import { detectPlatform, platforms, withEngine } from "./platform"

const UA = {
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36",
}

describe("detectPlatform", () => {
  it("macOS Safari", () => {
    expect(detectPlatform({ userAgent: UA.macSafari, maxTouchPoints: 0 })).toMatchObject({
      apple: true,
      mac: true,
      ios: false,
      webkit: true,
      chromium: false,
    })
  })

  it("macOS Chrome is chromium, not webkit", () => {
    expect(detectPlatform({ userAgent: UA.macChrome, maxTouchPoints: 0 })).toMatchObject({
      mac: true,
      chromium: true,
      webkit: false,
    })
  })

  it("an iPad reporting a macOS user agent with touch points is iOS", () => {
    expect(detectPlatform({ userAgent: UA.macSafari, maxTouchPoints: 5 })).toMatchObject({
      apple: true,
      ios: true,
      mac: false,
    })
  })

  it("every iOS browser is WebKit", () => {
    expect(detectPlatform({ userAgent: UA.iphone, maxTouchPoints: 5 })).toMatchObject({
      ios: true,
      webkit: true,
      chromium: false,
    })
  })

  it("Windows Firefox and Android Chrome", () => {
    expect(detectPlatform({ userAgent: UA.winFirefox, maxTouchPoints: 0 })).toMatchObject({
      windows: true,
      firefox: true,
      apple: false,
    })
    expect(detectPlatform({ userAgent: UA.android, maxTouchPoints: 5 })).toMatchObject({
      android: true,
      chromium: true,
    })
  })

  it("prefers User-Agent Client Hints when present", () => {
    expect(
      detectPlatform({
        userAgent: "Mozilla/5.0",
        uaPlatform: "Windows",
        brands: ["Chromium", "Google Chrome"],
        maxTouchPoints: 0,
      }),
    ).toMatchObject({ windows: true, chromium: true })
  })

  it("presets", () => {
    expect(platforms.apple.apple && platforms.apple.mac).toBe(true)
    expect(platforms.windows.windows && !platforms.windows.apple).toBe(true)
  })
})

describe("rendering engine (R1.1)", () => {
  it("Chrome on macOS: apple + mac, engine blink, chromium, not webkit", () => {
    expect(detectPlatform({ userAgent: UA.macChrome, maxTouchPoints: 0 })).toMatchObject({
      apple: true,
      mac: true,
      engine: "blink",
      chromium: true,
      webkit: false,
    })
  })

  it("Chrome on iPhone: engine webkit, ios and apple", () => {
    expect(detectPlatform({ userAgent: UA.iphone, maxTouchPoints: 5 })).toMatchObject({
      engine: "webkit",
      ios: true,
      apple: true,
      webkit: true,
      chromium: false,
    })
  })

  it("Firefox is gecko; brands win over the user agent", () => {
    expect(detectPlatform({ userAgent: UA.winFirefox, maxTouchPoints: 0 }).engine).toBe("gecko")
    expect(
      detectPlatform({ userAgent: UA.macSafari, brands: ["Google Chrome"], maxTouchPoints: 0 })
        .engine,
    ).toBe("blink")
  })

  it("every preset carries an engine its flags agree with; the Apple preset is webkit", () => {
    expect(platforms.apple.engine).toBe("webkit")
    for (const p of Object.values(platforms)) {
      expect([p.webkit, p.chromium, p.firefox]).toEqual([
        p.engine === "webkit",
        p.engine === "blink",
        p.engine === "gecko",
      ])
    }
  })

  it("an engine override on the Apple preset: apple kept, blink seen by quirks", async () => {
    const { domEnvironment } = await import("../env/dom-environment")
    const { quirkActive } = await import("./quirks")
    const env = domEnvironment({ platform: platforms.apple, engine: "blink" })
    expect(env.platform).toMatchObject({
      apple: true,
      engine: "blink",
      chromium: true,
      webkit: false,
    })
    expect(quirkActive("webkit-menuitem-double-click", env)).toBe(false)
    expect(withEngine(platforms.apple, "blink").engine).toBe("blink")
  })
})
