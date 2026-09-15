# AGENTS.md — docs

This directory owns repository documentation authority, time status, and maintenance rules.

## Documentation roles

- `openspec/specs/` owns accepted capability contracts. `docs/api/`, `docs/cli/`, `docs/configuration/`, and `docs/development/` document current contracts and supported workflows; link to the owning spec or domain instead of copying a command/API/configuration contract into a README.
- `docs/adr/` records durable architectural decisions. Follow its lifecycle and templates; Accepted ADRs are immutable history, and a changed decision needs a new ADR that supersedes the old one.
- `openspec/changes/` holds active proposals and their planning artifacts; they do not become current contracts until synchronized and accepted. `openspec/changes/archive/` is provenance only and is not a normal implementation source.
- `docs/research/` preserves evidence and exploration. It does not authorize product behavior, a dependency, or a release without the required design and implementation evidence.
- Public site-user documentation belongs in `apps/site/content/docs/`; repository maintenance and development documentation belongs here. Do not duplicate user guides across both locations.

## Authority and progressive reading

- Start from the relevant domain README and current spec/contract page. Do not recursively read all changes, ADRs, or research files while editing one document.
- State an active change's status and point readers to current behavior when a document is historical, superseded, or describes only a completed stage. Do not use historical wording to implement or validate current behavior.
- When sources conflict, follow the root instruction hierarchy and record the disagreement rather than silently promoting a detailed, recent, or convenient document into authority.
- Keep links directional: current API/CLI/configuration pages may link to rationale; rationale documents should link back to current contracts instead of duplicating operational fields and examples.

## Documentation changes and verification

- Keep a document focused on one reader purpose. README files are navigation and common context; OpenSpec change artifacts and ADRs explain decisions; they are not interchangeable.
- Preserve existing language and terminology conventions in the target document. Do not translate or reformat unrelated documentation as part of a focused change.
- Check every changed relative link and every stated command/path. Run a relevant focused verification command when the document instructs one; do not claim a command was run merely because it is documented.
- Do not add a parallel `docs/architecture/` hierarchy. Use current domain documentation for behavior and `docs/adr/` for durable architectural rationale.

## Canonical references

- [API documentation](./api/README.md)
- [CLI documentation](./cli/README.md)
- [Configuration documentation](./configuration/README.md)
- [Development guide](./development/README.md)
- [ADR convention](./adr/README.md)
