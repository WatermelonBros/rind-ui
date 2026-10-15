// Drivers, adapters and model-based tests built on component contracts.

export { platforms, withEngine } from "@rind-ui/core"
export type { AdapterEnv, Direction, EnvFactory, EnvOptions } from "./adapter"
export { type DomAdapterOptions, domEnv, type UserLike } from "./adapters/dom"
export {
  type PlaywrightAdapterOptions,
  type PlaywrightTarget,
  playwrightEnv,
} from "./adapters/playwright"
export { installAnnouncementLog, recordingAnnouncer } from "./announcements"
export { missingAriaLines } from "./aria-snapshot"
export type { DomSnapshot, ElementInfo, IdRef } from "./collect"
export {
  type ContractModality,
  createDriver,
  createDriverWith,
  type Driver,
  type DriverOptions,
  runAction,
  type Target,
} from "./driver"
export {
  type GraphEdge,
  type GraphNode,
  type MachineGraph,
  type Path,
  paths,
  toGraph,
  uncovered,
} from "./graph"
export { checkGeneric, genericInvariants, type StepFacts, traitInvariants } from "./invariants"
export {
  type ConsumerInvariant,
  currentRun,
  type MachinePath,
  machinePaths,
  type RunContext,
  type TestMachineOptions,
  testMachine,
} from "./model"
export { englishLeaks, pseudo, pseudoMessages } from "./pseudo-locale"
export { missingStateStories, type StateStories } from "./state-stories"
export { liveAnnouncements, spokenLog } from "./virtual-sr"
