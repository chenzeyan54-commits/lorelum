# Security Policy

## Supported Versions

Lorelum is a public alpha. Security fixes are applied to the latest `main` branch and the latest exact alpha release. Older alpha versions may require an upgrade rather than a backport.

| Version                | Supported        |
| ---------------------- | ---------------- |
| `main`                 | ✅               |
| latest published alpha | ✅               |
| older alpha releases   | best effort only |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities via public GitHub issues.**

Report them privately instead:

- 📧 Email: **security@lorelum.com**
- 🔒 Preferred: use [GitHub's private vulnerability reporting](https://github.com/lorelum/lorelum/security/advisories/new)

Include the following if possible:

- A description of the issue and its potential impact
- Steps to reproduce (PoC, screenshots, or logs)
- Affected versions / commits
- Suggested fix (optional)

### Response timeline

| Step                | Target                                                    |
| ------------------- | --------------------------------------------------------- |
| Acknowledge receipt | within 48 hours                                           |
| Initial assessment  | within 5 business days                                    |
| Fix or mitigation   | depends on severity; we'll coordinate disclosure with you |

We follow **coordinated disclosure**. Once a fix is released, we'll credit you in the advisory unless you prefer to remain anonymous.

## Scope

**In scope:**

- The Lorelum CLI (`lore`) and local engine in this repository
- Security issues caused by how Lorelum parses, stores, or retrieves knowledge packs
- Injection risks via malicious pack content
- The official Codex Plugin and its released CLI integration contract

**Out of scope:**

- Vulnerabilities in third-party dependencies (report to the upstream maintainer)
- Issues in the SaaS platform / enterprise components (separate private repos)
- Social engineering, physical attacks, DoS
- Security defects owned by a third-party Pack's source repository; report them to that Pack's maintainer as well

## Security design notes

Lorelum retrieves and injects third-party knowledge-pack content into AI context. Treat **any community Pack like any other open-source dependency** — review it before installing, just as you would a package dependency. An `awesome-lorelum` listing is a discovery aid, not a security audit, content review, or compatibility certification.

During alpha, use an isolated `--store-root` when evaluating unfamiliar Packs. A Pack can affect the guidance an agent receives even when it does not execute code locally. Do not include private Pack contents, credentials, access tokens, or personal data in a public issue, listing submission, or vulnerability report.
