import {
  announcerCapability,
  domPositioning,
  type Service,
  type TourCloseReason,
  type TourContext,
  type TourDirection,
  type TourProps,
  tourMachine,
  tourMessages,
  tourProgress,
  tourStepIndex,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useParentLayer } from "../layer-context"
import { useEnvironment, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import type { TourHandle, TourStepDef, UseTourProps } from "./types"

let tours = 0

const reasonOf = (direction: TourDirection, started: boolean) =>
  started ? "start" : direction === "jump" ? "goto" : direction === "backward" ? "prev" : "next"

/**
 * The tour's API: pass it to `<Tour.Root tour={…}>`, or render `Tour.Root` with the props.
 * Call during component initialisation; `options` is read reactively.
 */
export function useTour(options: () => UseTourProps, generatedId?: string): TourHandle {
  // `$props.id()` exists in components only: Root passes its own; a tour created elsewhere
  // gets a counter's (pass `id` when the page is rendered on the server).
  const uid = generatedId ?? `tour-${++tours}`
  const root = $derived(options().id ?? uid)
  const parent = useParentLayer()
  const messages = useMessages("tour", tourMessages, () => options().messages)
  const env = useEnvironment(announcerCapability)
  // Positioning only for anchored components: not part of domEnvironment().
  const withPosition = { ...env, position: domPositioning(env) }
  // The steps: the option, or what the mutators set since it last changed.
  let override = $state.raw<readonly TourStepDef[] | null>(null)
  let lastOption = untrack(() => options().steps)
  $effect.pre(() => {
    const next = options().steps
    untrack(() => {
      if (next === lastOption) return
      lastOption = next
      override = null
    })
  })
  const steps = () => override ?? options().steps
  let service: Service<typeof tourMachine> | null = null
  const read = () => {
    const view = service?.view()
    return {
      shown: (view?.values.stepId as string | undefined) || null,
      context: service?.getSnapshot().context as TourContext | undefined,
    }
  }
  const props = (): TourProps => {
    const {
      id: _id,
      steps: _steps,
      messages: _messages,
      onOpenChange,
      onStepChange,
      stepId,
      defaultStepId,
      ...rest
    } = options()
    const list = steps()
    return {
      ...rest,
      root,
      parent: parent(),
      steps: list,
      messages: messages(),
      // Not `defaultStepId`: the first shown step of every run is reported to onStepChange.
      ...(defaultStepId === undefined ? {} : { firstStepId: defaultStepId }),
      ...(stepId === undefined ? {} : { stepId: stepId ?? "" }),
      onOpenChange: onOpenChange
        ? (open, d) => {
            const { shown } = read()
            const reason = open ? "api" : (d.reason as TourCloseReason)
            onOpenChange(open, {
              reason,
              stepId: shown,
              stepIndex: tourStepIndex(list, shown),
              complete: reason === "complete",
              cancel: d.cancel,
            })
          }
        : undefined,
      onStepIdChange: onStepChange
        ? (next, d) => {
            const { shown, context } = read()
            const p = tourProgress(list, next)
            const direction = context?.direction ?? "forward"
            onStepChange(next, {
              stepIndex: tourStepIndex(list, next),
              totalSteps: p.total,
              progress: p.progress,
              direction,
              reason: reasonOf(direction, shown === null),
              cancel: d.cancel,
            })
          }
        : undefined,
    }
  }
  const machine = useMachine(tourMachine, props, withPosition)
  service = machine.service
  const send = machine.send
  const shown = () => (machine.view.values.stepId as string) || null
  return {
    service: machine.service,
    get view() {
      return machine.view
    },
    get root() {
      return root
    },
    get props() {
      return props()
    },
    get messages() {
      return messages()
    },
    get open() {
      return machine.view.values.open as boolean
    },
    get stepId() {
      return machine.view.matches("idle") ? null : shown()
    },
    get stepIndex() {
      return machine.view.matches("idle") ? -1 : tourStepIndex(steps(), shown())
    },
    get steps() {
      return steps()
    },
    start: (s) => send({ type: "START", stepId: s?.stepId }),
    stop: () => send({ type: "api" }),
    next: () => send({ type: "STEP.NEXT" }),
    prev: () => send({ type: "STEP.PREV" }),
    goto: (to) => send({ type: "STEP.GOTO", id: to }),
    reposition: () => send({ type: "POSITION.REPOSITION" }),
    setSteps: (list) => {
      override = list
    },
    addStep: (step, index) => {
      const list = [...steps()]
      list.splice(index ?? list.length, 0, step)
      override = list
    },
    removeStep: (rid) => {
      override = steps().filter((x) => x.id !== rid)
    },
    updateStep: (id, patch) => {
      override = steps().map((x) => (x.id === id ? { ...x, ...patch, id: x.id } : x))
    },
  }
}
