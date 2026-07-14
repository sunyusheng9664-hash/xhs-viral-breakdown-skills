# Feishu CLI Setup Gate

This setup gate is mandatory before Xiaohongshu processing.

## Check CLI Availability

Run `lark-cli --version`. If it is unavailable, try `npx -y @larksuite/cli --version`, then run `doctor` on the available command.

Use user identity when it can edit the target Bitables; otherwise use a ready bot identity. If neither identity works, produce the local Excel backup and report the authorization failure.

## Persistent Config

Read platform-neutral bindings from:

- macOS/Linux: `~/.config/xhs-viral-breakdown/config.json`
- Windows: `%APPDATA%/xhs-viral-breakdown/config.json`

If the neutral config is missing, an existing legacy Codex config may be migrated from `~/.codex/xhs-viral-breakdown-to-bitable/config.json`. Never delete the legacy file during migration.

The config stores only Base, table, view, and routing metadata. Never embed a user's Base tokens, table IDs, view IDs, or login credentials in a Skill or release archive.

## First-Run Permission

If no valid bindings exist, ask for explicit permission before creating two long-lived Bitables:

1. `小红书视频爆款拆解库`
2. `小红书图文爆款拆解库`

If the user provides existing Bitable bindings, verify their fields and reuse them instead of creating new libraries.

## Creation Rules

Create two independent Bases with a table named `内容拆解库`. Set visible field order and verify read/write access after creation. Never delete tables from an existing user-provided Base unless the user explicitly asks.

