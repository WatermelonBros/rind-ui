## MODIFIED Requirements

### Requirement: Agent Presence Theme

`@rind-ui/theme` SHALL draw an empty Visual as a glass orb with a ribbon of coloured light
that follows `--rind-agent-presence-level` while listening or speaking, with a distinct shape
and motion per state (not colour alone), and every state's shape kept, still, under reduced
motion.

#### Scenario: Thinking looks different

- **WHEN** the state is `thinking`
- **THEN** the Visual's shape differs from `listening`'s

#### Scenario: Speaking looks different

- **WHEN** the state is `speaking`
- **THEN** the Visual's shape differs from `listening`'s
