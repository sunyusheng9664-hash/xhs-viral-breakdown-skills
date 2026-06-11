# Feishu Bitable Write Rules

Prefer `lark-cli` when available; otherwise try `npx -y @larksuite/cli`.

## Common Commands

Create Base:

```bash
npx -y @larksuite/cli base +base-create --as bot --name "$BASE_NAME" --time-zone Asia/Shanghai --format json
```

Create table:

```bash
npx -y @larksuite/cli base +table-create --as bot --base-token "$BASE_TOKEN" --name "内容拆解库" --fields @fields.json --format json
```

Batch create records:

```bash
npx -y @larksuite/cli base +record-batch-create --as bot --base-token "$BASE_TOKEN" --table-id "$TABLE_ID" --json "$RECORDS_JSON" --format json
```

Set visible fields:

```bash
npx -y @larksuite/cli base +view-set-visible-fields --as bot --base-token "$BASE_TOKEN" --table-id "$TABLE_ID" --view-id "$VIEW_ID" --json "$VISIBLE_FIELDS_JSON" --format json
```

## Known Pitfalls

- `--fields @/absolute/path/fields.json` can fail. Use a relative path from the current directory.
- A new Base may contain a default table and empty records. Delete only the default empty table from a newly created Base.
- Do not delete primary fields to "clean up" a table. Create a correct target table instead.
- Consecutive table deletes may trigger a platform limit. Wait 2-5 seconds and retry once.
- Chinese field names in jq require bracket notation: `fields["标题"]`.
- Field creation order and visible order can differ. Always set visible fields.

## Fallback

Always create an Excel backup before Feishu write. If Feishu write fails, return the backup path and the failure reason.

