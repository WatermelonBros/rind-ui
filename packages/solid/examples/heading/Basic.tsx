/** @jsxImportSource solid-js */
import { Heading } from "@rind-ui/solid"

export function Basic() {
  return (
    <>
      <Heading>Settings</Heading>
      <Heading.Level>
        <Heading>Profile</Heading>
        <Heading.Level>
          <Heading>Avatar</Heading>
        </Heading.Level>
      </Heading.Level>
    </>
  )
}
