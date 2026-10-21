import type { ConstraintValidity } from "../dom/constraint-validity"
import {
  type BaseDomEnvironment,
  baseDomEnvironment,
  type DomEnvironmentOptions,
} from "./base-environment"
import type {
  AnnouncerEnv,
  ClipboardEnv,
  CollectionLayoutEnv,
  DateClockEnv,
  VisibilityEnv,
} from "./capabilities"
import {
  announcerCapability,
  clipboardCapability,
  dateClockCapability,
  extendEnvironment,
  layoutCapability,
  validityCapability,
  visibilityCapability,
} from "./dom-capabilities"

export type { BaseDomEnvironment, DomEnvironmentOptions } from "./base-environment"

/** Native constraint validity, for machines that validate a form control (Field). */
export interface ValidityEnv {
  readonly validity: ConstraintValidity
}

/** Every capability core defines, implemented on the real DOM. */
export type DomEnvironment = BaseDomEnvironment &
  AnnouncerEnv &
  DateClockEnv &
  CollectionLayoutEnv &
  ValidityEnv &
  VisibilityEnv &
  ClipboardEnv

/**
 * The complete browser environment: the base plus every on-demand capability, built now. For
 * tests and non-React consumers; components build only the capabilities they use. Nothing
 * touches globals at creation, so it is safe on the server.
 */
export function domEnvironment(options: DomEnvironmentOptions = {}): DomEnvironment {
  const base = baseDomEnvironment(options)
  return extendEnvironment(base, {
    announcer: announcerCapability.create(base, options),
    clipboard: clipboardCapability.create(base, options),
    layout: layoutCapability.create(base, options),
    validity: validityCapability.create(base, options),
    visibility: visibilityCapability.create(base, options),
    dateClock: dateClockCapability.create(base, options),
  })
}
