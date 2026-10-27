"use client"

import { createToaster } from "@rind-ui/core"
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  CheckboxGroup,
  Dialog,
  Heading,
  Menu,
  RadioGroup,
  Select,
  Separator,
  Slider,
  Switch,
  Tabs,
  TextField,
  Toast,
  Toaster,
  Tooltip,
} from "@rind-ui/react"
import { Fragment, useSyncExternalStore } from "react"

const noSubscription = () => () => {}
const toaster = createToaster()

const REGIONS = [
  { key: "fra", label: "Frankfurt" },
  { key: "iad", label: "Washington, D.C." },
  { key: "sin", label: "Singapore" },
]

const MEMBERS = [
  { name: "Ada Lovelace", email: "ada@acme.dev", role: "Owner", initials: "AL" },
  { name: "Alan Turing", email: "alan@acme.dev", role: "Admin", initials: "AT" },
  { name: "Grace Hopper", email: "grace@acme.dev", role: "Member", initials: "GH" },
]

// The screen's own layout, around the components; every colour, size and radius is a theme
// token, so the preset, the scheme and the accent re-skin the screen with them.
const css = `
main[data-theme-page]{min-height:0;padding:clamp(12px,4vw,40px)}
.app{container:app/inline-size;font-size:var(--rind-text-sm);max-width:52rem;margin-inline:auto;background:var(--rind-color-surface);color:var(--rind-color-text);border:var(--rind-border-width) solid var(--rind-color-border);border-radius:var(--rind-radius-panel);overflow:hidden}
.bar{display:flex;align-items:center;justify-content:space-between;gap:var(--rind-space-3);padding:var(--rind-space-3) var(--rind-space-6);border-block-end:var(--rind-border-width) solid var(--rind-color-border);background:var(--rind-color-bg)}
.crumbs{display:flex;align-items:center;gap:var(--rind-space-3);min-width:0}
.body{display:grid;gap:var(--rind-space-6);padding:var(--rind-space-8) var(--rind-space-6)}
.title{display:flex;align-items:center;gap:var(--rind-space-2);margin:0}
.lede{margin:var(--rind-space-1) 0 0;color:var(--rind-color-text-muted);max-width:44ch}
.panel{padding-block-start:var(--rind-space-2)}
.setting{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);column-gap:var(--rind-space-8);row-gap:var(--rind-space-1);align-items:center;padding-block:var(--rind-space-4)}
.setting>*{grid-column:2;grid-row:1/span 2}
.setting>:is([data-part="label"],[data-part="description"]){grid-column:1;align-self:end}
.setting>[data-part="description"]{grid-row:2;align-self:start;margin:0}
.setting>[data-part="label"]{grid-row:1}
.setting>[data-part="value-text"]{grid-row:1;justify-self:end;align-self:end}
.setting>[data-part="control"]{grid-row:2}
.setting>[data-scope="select"][data-part="trigger"],.setting>input{inline-size:100%}
.setting>[data-scope="switch"][data-part="control"]{justify-self:end;grid-row:1/span 2}
.choices{display:flex;flex-wrap:wrap;gap:var(--rind-space-4)}
.person{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--rind-space-3);padding-block:var(--rind-space-3)}
.person p{margin:0}
.person small{color:var(--rind-color-text-muted);font-size:var(--rind-text-xs)}
.danger{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--rind-space-4);padding:var(--rind-space-4) var(--rind-space-6);border:var(--rind-border-width) solid var(--rind-color-danger-border);border-radius:var(--rind-radius-lg)}
.danger p{margin:0}
.danger small{color:var(--rind-color-text-muted)}
.foot{display:flex;justify-content:flex-end;gap:var(--rind-space-2);padding:var(--rind-space-4) var(--rind-space-6);border-block-start:var(--rind-border-width) solid var(--rind-color-border);background:var(--rind-color-bg)}
@container app (max-width:34rem){
  .setting{grid-template-columns:minmax(0,1fr)}
  .setting>*,.setting>[data-part]{grid-column:1;grid-row:auto;justify-self:stretch}
  .setting>[data-scope="switch"][data-part="control"]{justify-self:start}
  .bar .crumbs nav{display:none}
}`

function Info() {
  return (
    <svg viewBox="0 0 256 256" aria-hidden="true">
      <path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm-4 48a12 12 0 1 1-12 12 12 12 0 0 1 12-12Zm12 112a16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16 16 16 0 0 1 16 16v40a8 8 0 0 1 0 16Z" />
    </svg>
  )
}

/**
 * The theme page's preview: one settings screen made of rind components and styled by
 * @rind-ui/theme alone. The docs page around it switches the preset, the scheme and the accent.
 */
export function PreviewApp() {
  // client only, as the examples harness: generated ids never meet a server render
  const mounted = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  if (!mounted) return null
  return (
    <div data-preview-root="">
      <style>{css}</style>
      <div className="app">
        <div className="bar">
          <div className="crumbs">
            <Avatar.Root aria-label="Acme" data-variant="solid" data-size="sm">
              <Avatar.Fallback>AC</Avatar.Fallback>
            </Avatar.Root>
            <Breadcrumbs.Root>
              <Breadcrumbs.List>
                {["Acme", "Storefront", "Settings"].map((c, i, all) => (
                  <Breadcrumbs.Item key={c} value={c}>
                    <Breadcrumbs.Link {...(i < all.length - 1 ? { href: "#" } : {})}>
                      {c}
                    </Breadcrumbs.Link>
                    {i < all.length - 1 && <Breadcrumbs.Separator>/</Breadcrumbs.Separator>}
                  </Breadcrumbs.Item>
                ))}
              </Breadcrumbs.List>
            </Breadcrumbs.Root>
          </div>
          <Menu.Root>
            <Menu.Trigger render={<Button data-variant="ghost" data-size="sm" />}>
              More
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item>Duplicate project</Menu.Item>
                  <Menu.Item>Transfer ownership</Menu.Item>
                  <Menu.Separator />
                  <Menu.Item disabled>Archive</Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>

        <div className="body">
          <div>
            <Heading level={1} className="title">
              Settings <Badge.Root>Pro</Badge.Root>
            </Heading>
            <p className="lede">How Storefront builds, where it runs, and who hears about it.</p>
          </div>

          <Tabs.Root defaultValue="general">
            <Tabs.List aria-label="Settings">
              <Tabs.Tab value="general">General</Tabs.Tab>
              <Tabs.Tab value="members">Members</Tabs.Tab>
              <Tabs.Tab value="notifications">Notifications</Tabs.Tab>
              <Tabs.Indicator />
            </Tabs.List>

            <Tabs.Panel value="general" className="panel">
              <TextField.Root className="setting" name="name" defaultValue="Acme Storefront">
                <TextField.Label>Project name</TextField.Label>
                <TextField.Description>On invoices and in the dashboard.</TextField.Description>
                <TextField.Input />
              </TextField.Root>
              <Separator.Root />
              <div className="setting">
                <Select.Root items={REGIONS} defaultValue="fra">
                  <Select.Label>Region</Select.Label>
                  <Select.Description>Where builds run and data is kept.</Select.Description>
                  <Select.Trigger>
                    <Select.ValueText />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner>
                      <Select.Content>
                        <Select.List>
                          {REGIONS.map((r) => (
                            <Select.Item key={r.key} value={r.key}>
                              <Select.ItemText>{r.label}</Select.ItemText>
                              <Select.ItemIndicator>✓</Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.List>
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </div>
              <Separator.Root />
              <RadioGroup.Root className="setting" defaultValue="team">
                <RadioGroup.Label>Visibility</RadioGroup.Label>
                <RadioGroup.Description>Who can open preview deploys.</RadioGroup.Description>
                <div className="choices">
                  {["Private", "Team", "Public"].map((label) => (
                    <RadioGroup.Item key={label} value={label.toLowerCase()}>
                      <RadioGroup.ItemControl>
                        <RadioGroup.ItemIndicator />
                      </RadioGroup.ItemControl>
                      <RadioGroup.ItemLabel>{label}</RadioGroup.ItemLabel>
                    </RadioGroup.Item>
                  ))}
                </div>
              </RadioGroup.Root>
              <Separator.Root />
              <Switch.Root className="setting" defaultChecked>
                <Switch.Label>Deploy previews</Switch.Label>
                <Switch.Description>A preview for every pull request.</Switch.Description>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
              <Separator.Root />
              <Slider.Root
                className="setting"
                defaultValue={80}
                step={5}
                formatOptions={{ style: "unit", unit: "percent" }}
              >
                <Slider.Label>Storage alert</Slider.Label>
                <Slider.Description>Email the owners when storage passes it.</Slider.Description>
                <Slider.ValueText />
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Indicator />
                  </Slider.Track>
                  <Slider.Thumb index={0} />
                </Slider.Control>
              </Slider.Root>
            </Tabs.Panel>

            <Tabs.Panel value="members" className="panel">
              {MEMBERS.map((m, i) => (
                <Fragment key={m.email}>
                  {i > 0 && <Separator.Root />}
                  <div className="person">
                    <Avatar.Root aria-label={m.name}>
                      <Avatar.Fallback>{m.initials}</Avatar.Fallback>
                    </Avatar.Root>
                    <p>
                      {m.name}
                      <br />
                      <small>{m.email}</small>
                    </p>
                    <Badge.Root data-tone={m.role === "Owner" ? "accent" : "neutral"}>
                      {m.role}
                    </Badge.Root>
                  </div>
                </Fragment>
              ))}
            </Tabs.Panel>

            <Tabs.Panel value="notifications" className="panel">
              <CheckboxGroup.Root
                className="setting"
                defaultValue={["fails"]}
                allValues={["fails", "ready", "joins"]}
              >
                <CheckboxGroup.Label>Email me when</CheckboxGroup.Label>
                <CheckboxGroup.Description>Sent to your account address.</CheckboxGroup.Description>
                <div className="choices" style={{ flexDirection: "column" }}>
                  {[
                    { value: "fails", label: "A deploy fails" },
                    { value: "ready", label: "A preview is ready" },
                    { value: "joins", label: "Someone joins the project" },
                  ].map((o) => (
                    <CheckboxGroup.Item key={o.value} value={o.value}>
                      <CheckboxGroup.ItemControl>
                        <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
                      </CheckboxGroup.ItemControl>
                      <CheckboxGroup.ItemLabel>{o.label}</CheckboxGroup.ItemLabel>
                    </CheckboxGroup.Item>
                  ))}
                </div>
              </CheckboxGroup.Root>
            </Tabs.Panel>
          </Tabs.Root>

          <Alert.Root announce="off">
            <Alert.Icon>
              <Info />
            </Alert.Icon>
            <Alert.Title>Changes go live on the next deploy</Alert.Title>
            <Alert.Description>The current build keeps its settings until then.</Alert.Description>
          </Alert.Root>

          <div className="danger">
            <p>
              Delete this project
              <br />
              <small>Its deploys, domains and history go for everyone.</small>
            </p>
            <Dialog.Root role="alertdialog">
              <Dialog.Trigger render={<Button data-tone="danger" data-variant="soft" />}>
                Delete project
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                  <Dialog.Content>
                    <Dialog.Title>Delete Storefront?</Dialog.Title>
                    <Dialog.Description>
                      Its deploys, domains and history go for everyone. This cannot be undone.
                    </Dialog.Description>
                    <Dialog.Cancel>Cancel</Dialog.Cancel>
                    <Dialog.Action data-tone="danger">Delete</Dialog.Action>
                  </Dialog.Content>
                </Dialog.Positioner>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>

        <div className="foot">
          <Button data-variant="ghost">Cancel</Button>
          <Tooltip.Root>
            <Tooltip.Trigger render={<Button data-variant="outline" />}>Preview</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Content>
                  Open a preview deploy
                  <Tooltip.Arrow />
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Button onPress={() => toaster.show("Settings saved")}>Save changes</Button>
        </div>
      </div>
      <Toaster toaster={toaster}>
        {() => (
          <Toast.Root>
            <Toast.Title />
            <Toast.CloseTrigger aria-label="Dismiss">✕</Toast.CloseTrigger>
          </Toast.Root>
        )}
      </Toaster>
    </div>
  )
}
