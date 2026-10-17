export {
  type AreaAxes,
  type AreaAxis,
  areaAxes,
  colorAtPoint,
  edgeAxis,
  fractionOfChannel,
  pointerResolution,
  setAxis,
  stepAxis,
  thumbPoint,
} from "./color-area.axes"
export {
  type ColorAreaApi,
  type ColorAreaConnectInput,
  colorAreaConnect,
  colorAreaKeyEvent,
} from "./color-area.connect"
export { colorAreaContract, colorAreaInvariants } from "./color-area.contract"
export {
  areaValueOf,
  areaWorking,
  type ColorAreaContext,
  type ColorAreaEnv,
  type ColorAreaEvent,
  type ColorAreaMachine,
  type ColorAreaMachineProps,
  type ColorAreaReason,
  colorAreaMachine,
} from "./color-area.machine"
export {
  type ColorAreaMessages,
  type ColorAreaValueTextArgs,
  colorAreaMessages,
} from "./color-area.messages"
export { colorAreaMeta } from "./color-area.meta"
