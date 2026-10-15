// Platform detection, done once for domEnvironment(). The only module (with quirks.ts and
// a11y/keys.ts) allowed to read the user agent: everything else reads PlatformInfo.

import type { Engine, PlatformFlags } from "../env/capabilities"

/** What detection reads, so it runs in Node with any user agent. */
export interface PlatformSignals {
  readonly userAgent: string
  /** `navigator.userAgentData.platform` when available. */
  readonly uaPlatform?: string | undefined
  /** `navigator.userAgentData.brands` names when available. */
  readonly brands?: readonly string[] | undefined
  readonly maxTouchPoints: number
}

/** No OS flag; the engine flags agree with the (Blink) engine. */
const none: PlatformFlags = {
  engine: "blink",
  apple: false,
  mac: false,
  ios: false,
  android: false,
  windows: false,
  webkit: false,
  chromium: true,
  firefox: false,
}

export function detectPlatform(s: PlatformSignals): PlatformFlags {
  const ua = s.userAgent
  const os = s.uaPlatform ?? ua
  const brands = s.brands ?? []
  const iDevice = /iPhone|iPad|iPod/.test(ua)
  const macLike = /Mac/i.test(os) && !iDevice
  // iPadOS requests the desktop site: a "Mac" with touch points is an iPad.
  const ios = iDevice || (macLike && s.maxTouchPoints > 1)
  const mac = macLike && !ios
  // Brands first, then the user agent; every iOS browser is WebKit.
  const engine: Engine = ios
    ? "webkit"
    : brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b)) ||
        /Chrome\/|Chromium\/|Edg\//.test(ua)
      ? "blink"
      : /Firefox\//.test(ua)
        ? "gecko"
        : /AppleWebKit\//.test(ua)
          ? "webkit"
          : "blink"
  return withEngine(
    {
      ...none,
      apple: mac || ios,
      mac,
      ios,
      android: /Android/i.test(os),
      windows: /Win/i.test(os),
    },
    engine,
  )
}

/** `platform` with another engine (and the engine flags that follow from it). */
export function withEngine(platform: PlatformFlags, engine: Engine): PlatformFlags {
  return {
    ...platform,
    engine,
    webkit: engine === "webkit",
    chromium: engine === "blink",
    firefox: engine === "gecko",
  }
}

/** Presets for tests and stories (also exported from @rind-ui/testing). */
export const platforms = {
  apple: withEngine({ ...none, apple: true, mac: true }, "webkit"),
  ios: withEngine({ ...none, apple: true, ios: true }, "webkit"),
  windows: { ...none, windows: true },
  android: { ...none, android: true },
  linux: none,
} satisfies Record<string, PlatformFlags>

/** Reads the signals from the browser. Not called on the server. */
export function readPlatform(): PlatformFlags {
  const nav = globalThis.navigator as
    | (Navigator & {
        userAgentData?: { platform?: string; brands?: readonly { brand: string }[] }
      })
    | undefined
  if (!nav) return none
  return detectPlatform({
    userAgent: nav.userAgent,
    uaPlatform: nav.userAgentData?.platform,
    brands: nav.userAgentData?.brands?.map((b) => b.brand),
    maxTouchPoints: nav.maxTouchPoints ?? 0,
  })
}
