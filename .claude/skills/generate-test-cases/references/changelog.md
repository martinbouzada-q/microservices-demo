# Version History — `generate-test-cases`

- **1.3.0** (2026-05-05): Inline always-loaded references
  - Inlined `references/test-design.md` (Phase 3b technique catalog) and `references/quality-checks.md` (per-case/batch/adapter validation) directly into SKILL.md. They were always loaded during execution, so the separate files added a Read step without saving tokens. The remaining references (`format-config.md`, `examples.md`, `changelog.md`) are kept separate since they load conditionally or not at all.
  - Compressed redundant prose: merged "Test Case Quality Standards" into the Canonical Format section, consolidated Do's/Don'ts into a single Best Practices list, converted Error Handling blocks into a table, and tightened the Adding-a-New-Adapter section.
  - SKILL.md trimmed from ~446 lines to 368 (well under the ~500-line limit) with no functional loss — every rule, heuristic, technique, checklist item, and error message is preserved.

- **1.2.0** (2026-04-27): Progressive disclosure restructure
  - Adopted Anthropic's standard skill layout: top-level `adapters/` (loaded by `--to-*` flag) and `references/` (loaded on-demand at the relevant phase).
  - Moved each output adapter's requirements, flag syntax, field mapping, MCP calls, progress announcements, and references to its own file under `adapters/`. Phase 4 now reads only the adapter file matching the selected `--to-*` flag.
  - Moved Phase 2 first-run flow, JSON schema, and "Changing the Saved Format" details to `references/format-config.md`, loaded only when the config is missing or being changed.
  - Extracted Phase 3b technique catalog to `references/test-design.md`, full usage examples to `references/examples.md`, and the validation checklists to `references/quality-checks.md`.
  - Moved version history to `references/changelog.md`, loaded on demand.
  - SKILL.md trimmed from 801 lines to ~446; canonical format, generation rules, and quick examples kept inline.

- **1.1.0** (2026-04-24): Added per-step progress announcements
  - Phase 3 now announces each sub-step as it starts (3a–3e) with `⏳` progress lines
  - Phase 4 announces before each MCP call or file write to eliminate silent gaps
  - Final Phase 3 summary reports case count, area count, and positive/negative ratio

- **1.0.0** (2026-04-22): Initial release
  - Input modes: `--from-jira`, `--from-text`, `--from-markdown`
  - Output adapters: `--to-qase`, `--to-jira`, `--to-testrail`, `--to-xray`, `--to-markdown`, plus display-only fallback
  - Canonical test case format with classic and gherkin step styles
  - Extensibility guide for adding new output adapters
