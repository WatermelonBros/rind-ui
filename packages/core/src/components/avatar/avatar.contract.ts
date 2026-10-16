import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { avatarMachine } from "./avatar.machine"

type P = "root" | "image" | "fallback"
type Status = "idle" | "loading" | "loaded" | "error"

const status = async (env: Env<P>) => (await env.part("root").attr("data-state")) ?? "idle"

/** Image fixtures per status, for the `$props:src` prop step (a test serves them). */
export const avatarFixtureSources = {
  idle: undefined,
  loading: "/__rind/avatar/slow.png",
  loaded:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  error: "/__rind/avatar/missing.png",
} as const

/**
 * The Avatar's contract (design §4): a named avatar by role `img` and exact name; a
 * decorative one as the avatar root inside the driver's target (a container). Statuses
 * come from the network, so every image event is a browser-fixture skip and `waitForStatus`
 * only observes.
 */
export const avatarContract = contract("avatar", {
  machine: avatarMachine,
  anatomy: ["root", "image", "fallback"],
  locate: (anchor: { readonly name?: string | RegExp } = {}) =>
    anchor.name === undefined ? { part: "root" } : { role: "img", name: anchor.name },
  actions: {
    waitForStatus: {
      // Observation only: the environment (the network) drives the status.
      pointer: async (_env, _status: Status) => {},
      keyboard: async (_env, _status: Status) => {},
      touch: async (_env, _status: Status) => {},
      done: async (env, s: Status) => (await status(env)) === s,
    },
  },
  queries: {
    status,
    isFallbackVisible: async (env) => (await env.part("fallback").count()) > 0,
    name: async (env) => env.part("root").accessibleName(),
  },
  states: {
    idle: { status: "idle", isFallbackVisible: true },
    loading: { status: "loading" },
    loaded: { status: "loaded", isFallbackVisible: false },
    error: { status: "error", isFallbackVisible: true },
  },
  dataState: {
    idle: { root: "idle", image: "idle", fallback: "idle" },
    loading: { root: "loading", image: "loading", fallback: "loading" },
    loaded: { root: "loaded", image: "loaded" },
    error: { root: "error", image: "error", fallback: "error" },
  },
  events: {
    "IMAGE.LOAD": { skip: "browser image fixtures" },
    "IMAGE.ERROR": { skip: "browser image fixtures" },
    "IMAGE.MOUNT": { skip: "browser image fixtures" },
    "IMAGE.SETTLED": { skip: "browser image fixtures" },
    "IMAGE.SOURCE": { skip: "driven by the $props:src step" },
    "IMAGE.UNMOUNT": { skip: "driven by the $props:src step (undefined)" },
    "ROOT.MOUNT": { skip: "mount" },
    // `src` is the Image part's prop, not the machine's: the test's rerender passes it on.
    "$props:src": { props: (target) => ({ src: avatarFixtureSources[target] }) as never },
  },
  traits: [],
})
