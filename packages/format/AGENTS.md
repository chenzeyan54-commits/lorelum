# AGENTS.md — packages/format

`@lorelum/format` owns public-format behavior and its verification boundary.

## Public contract boundary

`@lorelum/format` owns the public Practice/Pack format: schema entities, frontmatter parsing, validation, localization helpers, canonical formatting, and fixtures.

- Treat changes to Practice/Pack schema, accepted values, canonical bytes, validation severity, or localization behavior as public-contract work. Confirm design alignment and compatibility before implementation.
- Keep schema, parser, validator, formatter, localization manifest/state, and fixtures consistent. Do not update one layer while relying on downstream consumers to infer the new behavior.
- Preserve stable IDs and deterministic canonical behavior. A formatter or parser change must not silently alter a release or localization digest without the required synchronization/migration path.
- Diagnostics should remain typed and machine-readable. Distinguish invalid author input, structural validation failures, warnings/infos, and localization synchronization state.

## File placement

- `src/schema/` owns schema definitions; `src/frontmatter/` owns parsing; `src/validate/` owns cross-document validation; `src/localization/` owns localization/digest/formatting behavior; `src/fixtures/` provides reusable valid and invalid inputs.
- Keep shared format helpers within the relevant domain rather than moving public-format semantics into a generic utility module.
- Update colocated tests and fixtures with every behavior change. Fixtures are structural or semantic evidence only; they do not by themselves prove retrieval quality or downstream Agent behavior.

## Verification

- Run focused tests, then `bun test packages/format` for package-wide changes and `bun run --filter @lorelum/format typecheck` for exported-type changes.
- Run the applicable CLI format/validate/localization workflow when a change crosses from library behavior into Pack authoring output. Do not claim a Pack is ready or installable until its separate repository/release workflow verifies it.
- Update current format-facing documentation and any affected Pack fixtures without copying behavior into unrelated README files.

## Canonical references

- [Practice/Pack format ADR](../../docs/adr/0003-practice-pack-format.md)
- [Pack localization ADR](../../docs/adr/0009-pack-localization-authoring.md)
- [Pack and Registry CLI documentation](../../docs/cli/packs.md)
