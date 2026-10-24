// The TextField namespace: a module namespace, so bundlers drop the parts never referenced.
// biome-ignore assist/source/organizeImports: the order of the parts is the order of their docs
export {
  HostLabel as Label,
  HostDescription as Description,
  HostErrorMessage as ErrorMessage,
} from "../field/field-host"
export { Root, Input, Textarea, ClearTrigger, CharacterCount } from "./text-field"
export { VisibilityTrigger, VisibilityIndicator } from "./visibility"
