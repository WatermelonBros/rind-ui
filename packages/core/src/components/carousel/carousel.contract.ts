// Carousel's contract (spec "Carousel Contract"): the triggers and indicators as a user presses
// them; queries read the Root and the Status.

import { contract } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { carouselMachine } from "./carousel.machine"

type P =
  | "root"
  | "viewport"
  | "slide"
  | "control"
  | "prev-trigger"
  | "next-trigger"
  | "indicator-group"
  | "indicator"
  | "autoplay-trigger"
  | "status"
type E = Env<P>

const css = async (env: E, name: string) =>
  new RegExp(`${name}:\\s*([^;]+)`)
    .exec((await env.part("root").attr("style")) ?? "")?.[1]
    ?.trim() ?? ""
const page = async (env: E) => Number(await css(env, "--rind-carousel-page"))
const isPlaying = async (env: E) => (await env.part("root").attr("data-autoplay")) === "playing"

export const carouselContract = contract("carousel", {
  machine: carouselMachine,
  anatomy: [
    "root",
    "viewport",
    "slide",
    "control",
    "prev-trigger",
    "next-trigger",
    "indicator-group",
    "indicator",
    "autoplay-trigger",
    "status",
  ],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "region", name: anchor.name } : { part: "root" },
  actions: {
    next: {
      pointer: (env: E) => env.part("next-trigger").click(),
      touch: (env: E) => env.part("next-trigger").tap(),
      keyboard: async (env: E) => {
        await env.part("next-trigger").focus()
        await env.part("next-trigger").press("Enter")
      },
      done: async () => true,
    },
    prev: {
      pointer: (env: E) => env.part("prev-trigger").click(),
      touch: (env: E) => env.part("prev-trigger").tap(),
      keyboard: async (env: E) => {
        await env.part("prev-trigger").focus()
        await env.part("prev-trigger").press("Enter")
      },
      done: async () => true,
    },
    goTo: {
      pointer: (env: E, p: number) => env.part("indicator").nth(p).click(),
      touch: (env: E, p: number) => env.part("indicator").nth(p).tap(),
      keyboard: async (env: E, p: number) => {
        await env
          .part("indicator")
          .nth(await page(env))
          .focus()
        await env
          .part("indicator")
          .nth(await page(env))
          .press("Home")
        for (let i = 0; i < p; i++) await env.part("indicator").nth(i).press("ArrowRight")
      },
      done: async (env: E, p: number) => (await page(env)) === p,
    },
    play: {
      pointer: (env: E) => env.part("autoplay-trigger").click(),
      touch: (env: E) => env.part("autoplay-trigger").tap(),
      keyboard: async (env: E) => {
        await env.part("autoplay-trigger").focus()
        await env.part("autoplay-trigger").press("Enter")
      },
      done: async () => true,
    },
    pause: {
      pointer: (env: E) => env.part("autoplay-trigger").click(),
      touch: (env: E) => env.part("autoplay-trigger").tap(),
      keyboard: async (env: E) => {
        await env.part("autoplay-trigger").focus()
        await env.part("autoplay-trigger").press("Enter")
      },
      done: async (env: E) => !(await isPlaying(env)),
    },
  },
  queries: {
    page,
    pageCount: async (env: E) => Number(await css(env, "--rind-carousel-pages")),
    isPlaying,
    statusText: async (env: E) => env.part("status").text(),
  },
  states: {
    stopped: { isPlaying: false },
    playing: { isPlaying: true },
    paused: { isPlaying: false },
  },
  events: { NEXT: "next", PREV: "prev", GO: "goTo", PLAY: "play", STOP: "pause" },
  traits: [],
})
