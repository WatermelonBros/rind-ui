# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/WatermelonBros/rind-ui/security/advisories/new)
("Report a vulnerability" under the repository's **Security** tab). If that is
unavailable, email **matteo@watermelon-studio.it**.

Please include a description of the issue and its impact, steps to reproduce (a proof
of concept if you have one), and the affected package and version.

## Scope

rind-ui runs in your users' browsers. Relevant reports include, for example: script
injection through component props or generated attributes, Content Security Policy
violations caused by the library (it injects no inline scripts and no runtime
styles), and focus or dismissal behaviour that lets content escape a modal in a way
that defeats a security boundary.

## Supported versions

rind-ui is pre-1.0. Fixes land on the latest release only.
