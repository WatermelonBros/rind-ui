import { staticContract } from "../../contract/contract"

const NO_KEYBOARD = "a label has no keyboard interaction; keyboard users reach the control with Tab"

/** The Label's contract: located by its exact text, no states, no traits. */
export const labelContract = staticContract("label", {
  anatomy: ["root"],
  locate: ({ text }: { readonly text: string | RegExp }) => ({ text }),
  actions: {
    click: {
      pointer: async ({ part }) => part("root").click(),
      none: { keyboard: NO_KEYBOARD },
      done: async () => true,
    },
    doubleClick: {
      pointer: async ({ part }) => part("root").doubleClick(),
      none: { keyboard: NO_KEYBOARD },
      done: async () => true,
    },
  },
  queries: {
    text: async ({ part }) => part("root").text(),
    controlName: async ({ part }) => {
      const control = part("root").labelled()
      return (await control.exists()) ? control.accessibleName() : null
    },
    isControlFocused: async ({ part }) => {
      const control = part("root").labelled()
      return (await control.exists()) && (await control.isFocused())
    },
    selectedText: async (env) => env.selectedText(),
  },
  traits: [],
})
