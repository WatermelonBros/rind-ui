/** @jsxImportSource solid-js */
import { Skeleton } from "@rind-ui/solid"

function CardBody(props: { readonly loading: boolean }) {
  return (
    <Skeleton.Root loading={props.loading}>
      <Skeleton.Status />
      <Skeleton.Content class="stack">
        <div class="row">
          <Skeleton.Item data-shape="circle">
            <span aria-hidden="true">AL</span>
          </Skeleton.Item>
          <Skeleton.Item>Ada Lovelace</Skeleton.Item>
        </div>
        <Skeleton.Item>
          The analytical engine weaves algebraic patterns just as the Jacquard loom weaves flowers
          and leaves.
        </Skeleton.Item>
      </Skeleton.Content>
    </Skeleton.Root>
  )
}

export function Card() {
  return <CardBody loading />
}
