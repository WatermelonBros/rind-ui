import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { avatarFixtureSources } from "../avatar/avatar.contract"
import { imageStatusMachine } from "../image-status/image-status.machine"

type P = "root" | "img" | "fallback"
type Status = "idle" | "loading" | "loaded" | "error"

const status = async (env: Env<P>) =>
  ((await env.part("root").attr("data-state")) ?? "idle") as Status // set by imageConnect

/**
 * The Image's contract (design §3): a named image by role `img` and exact name in every
 * status (the <img> while loading/loaded, Root in idle/error: same instance either way); a
 * decorative one as the image root inside the driver's target. Statuses come from the
 * network, so every image event is a browser-fixture skip and `waitForStatus` only observes.
 */
export const imageContract = contract("image", {
  machine: imageStatusMachine,
  anatomy: ["root", "img", "fallback"],
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
    /** The name of whichever element carries it in this status. */
    name: async (env) => {
      const s = await status(env)
      return env.part(s === "idle" || s === "error" ? "root" : "img").accessibleName()
    },
  },
  states: {
    idle: { status: "idle", isFallbackVisible: true },
    loading: { status: "loading" },
    loaded: { status: "loaded", isFallbackVisible: false },
    error: { status: "error", isFallbackVisible: true },
  },
  dataState: {
    idle: { root: "idle", img: "idle", fallback: "idle" },
    loading: { root: "loading", img: "loading", fallback: "loading" },
    loaded: { root: "loaded", img: "loaded" },
    error: { root: "error", img: "error", fallback: "error" },
  },
  events: {
    "IMAGE.LOAD": { skip: "browser image fixtures" },
    "IMAGE.ERROR": { skip: "browser image fixtures" },
    "IMAGE.MOUNT": { skip: "browser image fixtures" },
    "IMAGE.SETTLED": { skip: "browser image fixtures" },
    "IMAGE.SOURCE": { skip: "driven by the $props:src step" },
    "IMAGE.UNMOUNT": { skip: "driven by the $props:src step (undefined)" },
    "ROOT.MOUNT": { skip: "mount" },
    // `src` is the Img part's prop, not the machine's: the test's rerender passes it on, so
    // the step's props are typed outside the machine's props (sound: never read by it).
    "$props:src": { props: (target) => ({ src: avatarFixtureSources[target] }) as never },
  },
  traits: [],
})
