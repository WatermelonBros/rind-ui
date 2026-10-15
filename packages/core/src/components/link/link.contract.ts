import { staticContract } from "../../contract/contract"

/** Link's contract (design §6): located by role link and exact name, no traits. */
export const linkContract = staticContract("link", {
  anatomy: ["link"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "link", name }),
  actions: {
    follow: {
      pointer: async ({ part }) => part("link").click(),
      keyboard: async ({ part }) => part("link").press("Enter"),
      done: async (env) => env.navigated(),
    },
    followInNewTab: {
      pointer: async ({ part }) => part("link").click({ mod: true }),
      keyboard: async ({ part }) => part("link").press("Enter", { mod: true }),
      done: async (env) => env.navigated({ newTab: true }),
    },
    middleClick: {
      pointer: async ({ part }) => part("link").click({ button: "middle" }),
      none: { keyboard: "no keyboard middle click; followInNewTab covers new-tab opening" },
      done: async (env) => env.navigated({ newTab: true }),
    },
  },
  queries: {
    href: async ({ part }) => part("link").attr("href"),
    current: async ({ part }) => part("link").attr("aria-current"),
    isDisabled: async ({ part }) => (await part("link").attr("aria-disabled")) === "true",
    isExternal: async ({ part }) => (await part("link").attr("data-external")) !== null,
    isFocusVisible: async ({ part }) => (await part("link").attr("data-focus-visible")) !== null,
  },
  traits: [],
})
