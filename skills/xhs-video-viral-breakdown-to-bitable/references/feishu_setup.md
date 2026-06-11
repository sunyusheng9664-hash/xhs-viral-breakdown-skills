# Feishu CLI Setup Gate

This setup gate is mandatory before any Xiaohongshu processing.

## Check CLI Availability

Check in this order:

```bash
command -v lark-cli
command -v feishu
command -v lark
test -d ~/.lark-cli
test -d "$HOME/Library/Application Support/lark-cli"
npx -y @larksuite/cli doctor
```

Do not fail only because `lark-cli` is not in `PATH`. `npx -y @larksuite/cli` may still work.

## Identity Rules

Run `doctor` when possible.

Decision rules:

- user identity works: use user identity if it can create and edit Bitables.
- user token expired but bot identity works: use `--as bot`.
- both unavailable: do not attempt Feishu write. Produce Excel backup and tell the user to install/login to Feishu CLI.

## First-Run Permission

If `~/.codex/xhs-viral-breakdown-to-bitable/config.json` does not exist or lacks valid base tokens, ask the user for confirmation before creating long-lived Bitables.

Use this plain-language confirmation:

```text
我需要为你创建两个长期使用的飞书多维表格：
1. 小红书视频爆款拆解库
2. 小红书图文爆款拆解库

之后视频笔记会固定追加到视频库，图文笔记会固定追加到图文库。创建后我会把两个链接发给你。是否现在创建？
```

Only continue after explicit user confirmation.

## Required Persistent Config

Save:

```json
{
  "initialized": true,
  "created_at": "YYYY-MM-DD",
  "timezone": "Asia/Shanghai",
  "feishu": {
    "video_base_name": "小红书视频爆款拆解库",
    "video_base_token": "",
    "video_base_url": "",
    "video_table_name": "内容拆解库",
    "video_table_id": "",
    "video_view_id": "",
    "image_text_base_name": "小红书图文爆款拆解库",
    "image_text_base_token": "",
    "image_text_base_url": "",
    "image_text_table_name": "内容拆解库",
    "image_text_table_id": "",
    "image_text_view_id": ""
  }
}
```

If the config is missing but the user provides existing Bitable URLs, rebind them after verifying fields instead of creating new libraries.

## Creation Rules

Create two independent Bases, not one Base with two tables.

Default Base names:

```text
小红书视频爆款拆解库
小红书图文爆款拆解库
```

Default table name in both Bases:

```text
内容拆解库
```

After creation:

1. Create the target table and fields.
2. Delete only the default empty table generated with the new Base.
3. Set visible field order.
4. Verify record/list access.
5. Return both URLs to the user.

Never delete tables from an existing user-provided Base unless the user explicitly asks.

