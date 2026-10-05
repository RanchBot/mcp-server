# Security Policy

Ranch.Bot takes security reports seriously. This public repository is an exported distribution of
maintainer-controlled monorepo development, so please use the private contact below rather than a
public GitHub issue.

## Reporting a vulnerability

Email [support@ranch.bot](mailto:support@ranch.bot) with the subject line "Security report".

Include the smallest reproduction you can, plus the package version from
`ranchbot-mcp --version` and the environment you observed it in. Do **not** send tokens, credentials,
API keys, session caches, or customer records. If a secret may be involved, describe its type and
location without including its value.

Helpful reports usually cover authentication or session handling, access control and farm scoping,
credential storage, or unintended data exposure.

## What to expect

This is a small, founder-run project. We read every report, but we do not promise a response
deadline, a fix timeline, or a bug bounty. We will treat reports as confidential and coordinate any
disclosure with you.

## Supported versions

Only the current published release is supported. Upgrade guidance is in
[Troubleshooting](docs/troubleshooting.md); a source checkout or candidate version is not a
supported release.
