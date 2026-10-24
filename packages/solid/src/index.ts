// @rind-ui/solid: SolidJS parts over the framework-neutral core, one component at a time.

export * from "./button"
export { IconChildren, type IconName, type RindIcons } from "./icons"
export { composeRefs, mergeProps, type RindEventExtension } from "./merge-props"
export { normalizeProps } from "./normalize-props"
export {
  type RindMessageScopes,
  RindProvider,
  type RindProviderProps,
  type ScopedMessages,
  useEnvironment,
  useLocale,
  useMessages,
} from "./provider"
export type { RenderProp } from "./render"
export * from "./toggle"
