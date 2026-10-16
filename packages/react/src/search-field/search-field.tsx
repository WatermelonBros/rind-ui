import {
  injectStyle,
  type MessageOverrides,
  type SearchFieldEvent,
  type SearchFieldMessages,
  type SearchFieldSubmitDetails,
  searchCancelStyle,
  searchFieldConnect,
  searchFieldMachine,
  searchFieldMessages,
} from "@rind-ui/core"
import { useEffect, useLayoutEffect } from "react"
import { HostDescription, HostErrorMessage, HostLabel } from "../field/use-field-host"
import { useEnvironment } from "../provider"
import {
  createTextFieldRoot,
  TextField,
  type TextFieldHostConfig,
  type TextFieldHostContext,
  type TextFieldRootProps,
  useTextFieldHost,
} from "../text-field/text-field"

declare module "../provider" {
  interface RindMessageScopes {
    "search-field": SearchFieldMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface SearchFieldRootProps extends Omit<TextFieldRootProps, "onSubmit"> {
  /** Enter (not composing): the search. The form still submits unless `details.event` is prevented. */
  readonly onSubmit?: (value: string, details: SearchFieldSubmitDetails) => void
  readonly messages?: MessageOverrides<SearchFieldMessages>
}

function connect(ctx: TextFieldHostContext) {
  return searchFieldConnect(
    {
      value: ctx.view.values.value ?? "",
      composing: ctx.view.state === "composing",
      customClear: ctx.mounted.clearTriggers > 0,
    },
    // Sound: this host was created with `searchFieldMachine`, which accepts these events.
    ctx.send as unknown as (event: SearchFieldEvent) => void,
  )
}

const config: TextFieldHostConfig = {
  scope: "search-field",
  // Sound: the host reads only Text Field's part of the machine; ESCAPE and SUBMIT are sent
  // through `connect()` above.
  machine: searchFieldMachine as unknown as TextFieldHostConfig["machine"],
  messages: searchFieldMessages,
  label: "SearchField",
  ownProps: ["onSubmit"],
  machineProps: (own) => ({ onSubmit: own["onSubmit"] }),
  rootData: (ctx) => connect(ctx).root(),
  inputProps: (ctx) => connect(ctx).input(),
}

const Root = createTextFieldRoot<SearchFieldRootProps>(config)

/** Text Field's ClearTrigger; while mounted, the browser's own cancel button is hidden. */
function ClearTrigger(props: Parameters<typeof TextField.ClearTrigger>[0]) {
  const ctx = useTextFieldHost("SearchField.ClearTrigger")
  const env = useEnvironment()
  useIsoLayoutEffect(() => {
    injectStyle(ctx.controlEl.current?.ownerDocument, "search-field-cancel", searchCancelStyle, env)
  }, [env, ctx.controlEl])
  return <TextField.ClearTrigger {...props} />
}

export const SearchField = {
  Root,
  Label: HostLabel,
  Description: HostDescription,
  ErrorMessage: HostErrorMessage,
  Input: TextField.Input,
  ClearTrigger,
  CharacterCount: TextField.CharacterCount,
}
