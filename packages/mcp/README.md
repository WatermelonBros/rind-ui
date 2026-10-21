# @rind-ui/mcp

An [MCP](https://modelcontextprotocol.io) server that lets coding agents use
[rind-ui](https://rind.watermelon-studio.it), headless React components with behaviour,
keyboard support, accessibility and state, and a test driver for every component.

The agent can list the components, read any component's docs (parts, props, `data-*`
attributes, keyboard, accessibility notes, driver) and search them, before it writes code.
The docs are read from the live site, so they always match the published packages.

## Install

Claude Code:

```sh
claude mcp add rind-ui -- npx -y @rind-ui/mcp
```

Cursor, Windsurf, VS Code and other clients (`mcp.json` or the client's MCP settings):

```json
{
  "mcpServers": {
    "rind-ui": { "command": "npx", "args": ["-y", "@rind-ui/mcp"] }
  }
}
```

## Tools

| Tool | What it returns |
|---|---|
| `list_components` | Every component with a one-line summary |
| `get_component` | One component's full docs as markdown (`name`: `"Combobox"`, `"date-field"`…) |
| `search_docs` | Components and guides matching a keyword |
| `get_started` | Install, compose, style and verify with the drivers |

No dependencies, Node 20 or newer.
