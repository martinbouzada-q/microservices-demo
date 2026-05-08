# TestRail Adapter

Publishes canonical test cases to **TestRail**.

## Requirements

- TestRail MCP configured in `.mcp.json` (preferred), OR
- Fallback: write a markdown export the user can import via TestRail's CSV import feature.

## Flag syntax

```
--to-testrail [PROJECT-ID]
```

## MCP tool (when available)

- TestRail MCP `create_case` (one call per canonical case, attached to the chosen section/suite).

## Field mapping (canonical → TestRail)

| Canonical | TestRail field |
|-----------|---------------|
| `title` | `title` |
| `preconditions` | `custom_preconds` |
| `steps[].action` | `custom_steps_separated[].content` |
| `steps[].expected_result` | `custom_steps_separated[].expected` |
| `priority: "high"` | `priority_id: 4` (Critical) |
| `priority: "medium"` | `priority_id: 2` (Medium) |
| `priority: "low"` | `priority_id: 1` (Low) |
| `type: "functional"` | `type_id: 1` |
| `type: "accessibility"` | `type_id: 3` |
| `type: "compatibility"` | `type_id: 4` |
| `type: "usability"` | `type_id: 5` |
| `type: "performance"` | `type_id: 7` |
| `type: "security"` | `type_id: 10` |

## Phase 4 progress announcements

- Before the create loop (MCP): `⏳ Publishing test cases to TestRail...`
- Before fallback markdown write: `⏳ TestRail MCP not configured — writing CSV-importable markdown to <path>...`

## Fallback behavior

If no TestRail MCP is configured:

```
⚠️  TestRail MCP not configured in .mcp.json.
   Falling back to --to-markdown ./testrail-import.md
   You can import this file via TestRail's CSV import feature.
```

Generate markdown using the same conventions as `adapters/markdown.md`, then exit with the fallback note in the success report.

## References

- [TestRail API — Add Case](https://support.testrail.com/hc/en-us/articles/7077292642580)
