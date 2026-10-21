import { domClipboard } from "../dom/clipboard"
import { collectionLayout } from "../dom/collection-layout"
import { type ConstraintValidity, constraintValidity } from "../dom/constraint-validity"
import { liveAnnouncer } from "../dom/live-announcer"
import {
  type BaseDomEnvironment,
  type DomEnvironmentOptions,
  documentOfRoot,
} from "./base-environment"
import type {
  Announcer,
  Clipboard,
  CollectionLayout,
  DateClock,
  PageVisibility,
} from "./capabilities"

/**
 * An environment capability built on demand: `key` is the environment property it fills,
 * `create` its DOM implementation (or the one given in the options). A component asks for the
 * capabilities its machine uses, so only those implementations end up in its bundle.
 */
export interface Capability<K extends string = string, T = unknown> {
  readonly key: K
  create(base: BaseDomEnvironment, options: DomEnvironmentOptions): T
}

/** The environment properties a list of capabilities provides. */
export type ProvidedBy<C extends readonly Capability[]> = {
  // A list typed only as `Capability[]` (no known keys) provides nothing, not an index signature.
  readonly [E in C[number] as string extends E["key"] ? never : E["key"]]: ReturnType<E["create"]>
}

/* @__NO_SIDE_EFFECTS__ */
function capability<const K extends string, T>(
  key: K,
  create: (base: BaseDomEnvironment, options: DomEnvironmentOptions) => T,
): Capability<K, T> {
  return { key, create }
}

/** Live regions (or `ariaNotify`), unless the options give an announcer. */
export const announcerCapability = /* @__PURE__ */ capability(
  "announcer",
  (base, options): Announcer =>
    typeof options.announcer === "object"
      ? options.announcer
      : liveAnnouncer(base, { backend: options.announcer ?? "live-region" }),
)

/** The Clipboard API with its fallback, unless the options give a clipboard. */
export const clipboardCapability = /* @__PURE__ */ capability(
  "clipboard",
  (base, options): Clipboard =>
    options.clipboard ?? domClipboard(documentOfRoot(base.dom.getRootNode)),
)

/** Item geometry for collections (grid and page navigation). */
export const layoutCapability = /* @__PURE__ */ capability(
  "layout",
  (base): CollectionLayout => collectionLayout(base.dom),
)

/** Native constraint validity, for machines that validate a form control (Field). */
export const validityCapability = /* @__PURE__ */ capability(
  "validity",
  (): ConstraintValidity => constraintValidity,
)

/** The document's visibility state; `visibilitychange` only (never focus or blur). */
export const visibilityCapability = /* @__PURE__ */ capability(
  "visibility",
  (base, options): PageVisibility =>
    options.visibility ?? documentVisibility(documentOfRoot(base.dom.getRootNode)),
)

/** Read at call time, never at module scope or on import (no server-render "now"). */
export const dateClockCapability = /* @__PURE__ */ capability(
  "dateClock",
  (_base, options): DateClock =>
    options.dateClock ?? {
      now: () => Date.now(),
      timeZone: () => new Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
)

function documentVisibility(documentOf: () => Document | undefined): PageVisibility {
  return {
    hidden: () => documentOf()?.visibilityState === "hidden",
    subscribe(listener) {
      const doc = documentOf()
      if (!doc) return () => {}
      const onChange = () => listener(doc.visibilityState === "hidden")
      doc.addEventListener("visibilitychange", onChange)
      return () => doc.removeEventListener("visibilitychange", onChange)
    },
  }
}

/**
 * `base` plus `additions`, keeping base's accessors (the platform is read lazily, on first
 * use, never at creation).
 */
export function extendEnvironment<B extends object, A extends object>(
  base: B,
  additions: A,
): B & A {
  const out = Object.defineProperties({}, Object.getOwnPropertyDescriptors(base))
  // `out` has every own property of `base`, and `additions`' are assigned below.
  return Object.assign(out, additions) as B & A
}
