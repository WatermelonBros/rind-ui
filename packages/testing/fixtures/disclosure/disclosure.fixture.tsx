import { Disclosure, type RootProps as DisclosureRootProps } from "./disclosure.react"

/** The fixture as stories and tests render it. */
export function DisclosureExample(props: Omit<DisclosureRootProps, "children">) {
  return (
    <Disclosure.Root {...props}>
      <Disclosure.Trigger>Details</Disclosure.Trigger>
      <Disclosure.Content>Body text</Disclosure.Content>
    </Disclosure.Root>
  )
}
