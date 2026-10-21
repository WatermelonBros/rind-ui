"use client"

// Text Field: the host configured with visibility (`type="password"`) and the keys (Escape
// clears, Enter submits, `type="search"` semantics), and the parts.

import {
  injectStyle,
  type TextFieldOwnEvent,
  textFieldCancelStyle,
  textFieldKeysConnect,
  textFieldMachine,
  textFieldMessages,
} from "@rind-ui/core"
import { useEffect, useLayoutEffect } from "react"
import { HostDescription, HostErrorMessage, HostLabel } from "../field/use-field-host"
import { useEnvironment } from "../provider"
import {
  ClearTrigger as BaseClearTrigger,
  CharacterCount,
  createTextFieldRoot,
  Input,
  Textarea,
  type TextFieldHostConfig,
  type TextFieldHostContext,
  type TextFieldRootProps,
  useTextFieldHost,
} from "./text-field"
import {
  VisibilityIndicator,
  VisibilityTrigger,
  visibilityAfterRender,
  visibilityInputProps,
  visibilityMachineProps,
  visibilityRootData,
} from "./visibility"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

function keys(ctx: TextFieldHostContext) {
  return textFieldKeysConnect(
    {
      value: ctx.view.values.value ?? "",
      composing: ctx.view.state === "composing",
      search: ctx.own["type"] === "search",
      customClear: ctx.mounted.clearTriggers > 0,
    },
    // Sound: the Text Field machine accepts ESCAPE and SUBMIT (its key preset).
    ctx.send as unknown as (event: TextFieldOwnEvent) => void,
  )
}

const config: TextFieldHostConfig = {
  scope: "text-field",
  machine: textFieldMachine,
  messages: textFieldMessages,
  label: "TextField",
  ownProps: ["type", "visible", "defaultVisible", "onVisibleChange", "escapeClears", "onSubmit"],
  machineProps: (own, refs) => ({
    ...visibilityMachineProps(own, refs),
    escapeClears: (own["escapeClears"] as boolean | undefined) ?? own["type"] === "search",
    onSubmit: own["onSubmit"],
  }),
  rootData: (ctx) => ({ ...keys(ctx).root(), ...visibilityRootData(ctx) }),
  inputProps: (ctx) => {
    const type = ctx.own["type"] as string | undefined
    return {
      ...(type !== undefined && type !== "password" && type !== "search" ? { type } : {}),
      ...keys(ctx).input(),
      ...visibilityInputProps(ctx),
    }
  },
  afterRender: visibilityAfterRender,
}

const Root = createTextFieldRoot<TextFieldRootProps>(config)

/** The ClearTrigger; with `type="search"`, the browser's own cancel button is hidden meanwhile. */
function ClearTrigger(props: Parameters<typeof BaseClearTrigger>[0]) {
  const ctx = useTextFieldHost("TextField.ClearTrigger")
  const env = useEnvironment()
  const search = ctx.own["type"] === "search"
  useIsoLayoutEffect(() => {
    if (search) {
      injectStyle(
        ctx.controlEl.current?.ownerDocument,
        "text-field-cancel",
        textFieldCancelStyle,
        env,
      )
    }
  }, [env, ctx.controlEl, search])
  return <BaseClearTrigger {...props} />
}

/** The parts, by name: `text-field.parts.ts` re-exports them as the `TextField` namespace. */
export {
  CharacterCount,
  ClearTrigger,
  HostDescription as Description,
  HostErrorMessage as ErrorMessage,
  HostLabel as Label,
  Input,
  Root,
  Textarea,
  VisibilityIndicator,
  VisibilityTrigger,
}
