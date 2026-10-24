// babel-preset-solid ships no types: the preset is a Babel plugin factory, used as a preset item.
declare module "babel-preset-solid" {
  import type { PluginItem } from "@babel/core"

  const preset: PluginItem
  export default preset
}
