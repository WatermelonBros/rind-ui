// QR Code's contract (design §7): located by the frame (role `img` + name), queries that
// read the rendered symbol back (the `matrix` is parsed from the path and viewBox, so the
// renderer is checked end to end) and, with a decoder (@rind-ui/testing supplies one), the
// decode invariant: the rendered matrix decodes to the value.

import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { parseQrPath } from "../../qr/parse-path"
import { qrEncodingKey } from "./qr-code.encoding"
import { qrCodeMachine } from "./qr-code.machine"

type P = "root" | "frame" | "pattern" | "overlay" | "value-text" | "download-trigger"

/** Decodes a module matrix to its text; throws when it cannot. */
export type QrMatrixDecoder = (modules: readonly (readonly boolean[])[]) => string

const rootAttr = (env: Env<P>, name: string) => env.part("root").attr(name)

const state = async (env: Env<P>) => (await rootAttr(env, "data-state")) ?? "empty"

async function matrix(env: Env<P>): Promise<boolean[][] | undefined> {
  if ((await state(env)) !== "ready") return undefined
  const size = Number(await rootAttr(env, "data-modules"))
  const d = (await env.part("pattern").attr("d")) ?? ""
  const viewBox = (await env.part("frame").attr("viewBox")) ?? ""
  return parseQrPath(d, viewBox, size).modules
}

/** The QR Code contract, with the decode query and invariant when a decoder is given. */
/* @__NO_SIDE_EFFECTS__ */
export function qrCodeContractWith(decode?: QrMatrixDecoder) {
  const decoded = async (env: Env<P>): Promise<string | undefined> => {
    const m = await matrix(env)
    if (!m || !decode) return undefined
    try {
      return decode(m)
    } catch {
      return undefined
    }
  }
  /** The value: the value text when rendered, else what the symbol decodes to. */
  const value = async (env: Env<P>): Promise<string> => {
    const text = env.part("value-text")
    if ((await text.count()) > 0) return text.text()
    return (await decoded(env)) ?? ""
  }
  const invariants: Invariant<P, string>[] = [
    {
      name: "qr-code-frame-named-when-ready",
      check: async ({ env }) => {
        if ((await state(env)) !== "ready") {
          return (await env.part("frame").attr("aria-hidden")) === "true"
            ? undefined
            : "the frame of an empty or invalid QR code is exposed"
        }
        const frame = env.part("frame")
        if ((await frame.attr("role")) !== "img")
          return "the frame of a ready QR code is not role=img"
        return (await frame.accessibleName()) === ""
          ? "the frame has no accessible name"
          : undefined
      },
    },
    ...(decode
      ? [
          {
            name: "qr-code-decodes-to-value",
            check: async ({ env }: { env: Env<P> }) => {
              if ((await state(env)) !== "ready" || (await env.part("value-text").count()) === 0) {
                return undefined
              }
              const got = await decoded(env)
              const want = await env.part("value-text").text()
              return got === want
                ? undefined
                : `the symbol decodes to ${JSON.stringify(got)}, not ${JSON.stringify(want)}`
            },
          },
        ]
      : []),
  ]
  return contract("qr-code", {
    machine: qrCodeMachine,
    anatomy: ["root", "frame", "pattern", "overlay", "value-text", "download-trigger"],
    locate: (anchor: { readonly name?: string | RegExp } = {}) => ({
      role: "img",
      name: anchor.name ?? "QR code",
    }),
    actions: {
      /**
       * Types the value into the page's control labelled "Value" (the fixture's input that
       * calls `setValue`): the component has no input of its own.
       */
      setValue: {
        pointer: async (env, next: string) => env.find({ label: "Value" }).fill(next),
        keyboard: async (env, next: string) => env.find({ label: "Value" }).fill(next),
        done: async (env, next: string) => (await value(env)) === next,
      },
      download: {
        pointer: async (env) => env.part("download-trigger").click(),
        touch: async (env) => env.part("download-trigger").tap(),
        keyboard: async (env) => {
          await env.part("download-trigger").focus()
          await env.keyboard("Enter")
        },
        done: async (env) => (await rootAttr(env, "data-last-download")) !== null,
      },
    },
    queries: {
      value,
      state,
      version: async (env) => {
        const v = await rootAttr(env, "data-version")
        return v === null ? undefined : Number(v)
      },
      ecc: async (env) => (await rootAttr(env, "data-ecc")) ?? undefined,
      size: async (env) => {
        const v = await rootAttr(env, "data-modules")
        return v === null ? undefined : Number(v)
      },
      matrix,
      decoded,
      description: async (env) => env.part("frame").accessibleDescription(),
      isEmpty: async (env) => (await state(env)) === "empty",
      error: async (env) => (await state(env)) === "invalid",
      isDownloading: async (env) =>
        (await env.part("download-trigger").count()) > 0 &&
        (await env.part("download-trigger").attr("data-state")) === "downloading",
      /** The file name of the last download, recorded by the machine. */
      lastDownload: async (env) => (await rootAttr(env, "data-last-download")) ?? undefined,
    },
    states: { ready: { isDownloading: false }, downloading: {} },
    events: {
      "VALUE.SET": { skip: "the api: driven by the fixture's value control and the value prop" },
      DOWNLOAD: { skip: "async export (canvas, Blob): the DOM and browser download tests" },
      "DOWNLOAD.DONE": { skip: "async: completes the download" },
      "DOWNLOAD.FAILED": { skip: "browser only: a failed export" },
      "PARTS.CHANGED": { skip: "mount bookkeeping" },
      "OVERLAY.MEASURED": { skip: "layout driven: the browser overlay tests" },
      "ENCODING.CHANGED": { skip: "prop driven: a new value re-measures the overlay" },
      // A new (controlled) value, and new option values: the decode invariant checks both.
      "$props:value": { props: () => ({ value: "https://rind.example/changed" }) },
      "$props:encodingKey": {
        // `encoding` for the component, its key for the oracle.
        props: () =>
          ({ encoding: { ecc: "Q" }, encodingKey: qrEncodingKey("", { ecc: "Q" }) }) as never,
      },
    },
    traits: [],
    invariants,
  })
}

/** QR Code's contract without a decoder (`decoded()` is `undefined`). */
export const qrCodeContract = qrCodeContractWith()
