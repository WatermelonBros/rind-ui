import { announcerCapability, clipboardCapability, clipboardMachine } from "@rind-ui/core"
import { describe, it } from "vitest"
import { useEnvironment } from "./provider"
import { useMachine } from "./use-machine"

describe("requested capabilities (types)", () => {
  it("a machine needing a capability that was not requested does not compile", () => {
    // Never called: hooks only type-checked here.
    const _bind = (props: Parameters<typeof useMachine<typeof clipboardMachine>>[1]) => {
      // @ts-expect-error the Clipboard machine needs `clipboard`, only `announcer` was requested
      useMachine(clipboardMachine, props, useEnvironment(announcerCapability))
      // @ts-expect-error the base environment alone is not enough either
      useMachine(clipboardMachine, props)
      useMachine(clipboardMachine, props, useEnvironment(announcerCapability, clipboardCapability))
    }
    void _bind
  })
})
