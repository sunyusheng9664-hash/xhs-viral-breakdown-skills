---
name: xhs-video-viral-breakdown-to-bitable
description: Legacy compatibility skill for collecting Xiaohongshu video notes into Feishu/Lark Bitable. Use only when the user explicitly names this legacy skill or an existing automation depends on it. For new image-text, video, or mixed-link requests, use xhs-viral-breakdown-to-bitable instead.
---

# Xiaohongshu Video Viral Breakdown to Feishu Bitable

## Purpose

Turn public Xiaohongshu video note links into a durable video script and viral-structure library in Feishu Bitable.

This skill is not just for copying metadata. Its value is in converting video notes into reusable assets: hook, spoken script, rhythm, content structure, viral mechanism, and tactics for future videos.

## Mandatory First-Run Flow

Before processing Xiaohongshu links, run the Feishu setup gate in [feishu_setup.md](references/feishu_setup.md).

Hard rules:

1. First check whether the user's computer has Feishu/Lark CLI access.
2. If no persistent config exists, ask the user for permission to create two Bitables:
   - `小红书视频爆款拆解库`
   - `小红书图文爆款拆解库`
3. Create both libraries during initialization, even if this invocation only processes video notes.
4. Return both Bitable links to the user after creation.
5. Save both base tokens, table ids, view ids, and URLs in the local config.
6. For later runs, write video records only to the configured `小红书视频爆款拆解库`.
7. Do not create a new Bitable unless the user explicitly asks for a new library or the configured one is inaccessible and the user confirms replacement.

Recommended config path:

```text
~/.config/xhs-viral-breakdown/config.json
```

## Inputs

Accept:

- One Xiaohongshu public video share URL.
- Multiple video URLs, one per line.
- Mixed Xiaohongshu share text containing URLs.
- Optional existing Feishu Bitable URLs for rebinding if local config is missing.

Do not process private/login-only content. If subtitles or `mediaV2` are unavailable, do not invent spoken content.

## Default Output Fields

Create or verify the video table using these fields in this order:

```text
标题
链接
封面
作者
视频时长
点赞数
收藏数
评论数
分享数
正文
口播文案（原始字幕）
爆款拆解
可复制部分
```

Rules:

- `口播文案（原始字幕）` stores the corrected full subtitle text. Keep the historical field name, but do not dump uncorrected ASR errors.
- `点赞数`, `收藏数`, `评论数`, and `分享数` must be number fields.
- `封面` is URL text in v1, not an attachment.
- If no subtitle exists, write `未获取字幕` and continue with metadata and non-subtitle analysis only.

See [fields.md](references/fields.md) for the full schema.

## Workflow

1. Run the Feishu setup gate.
2. Extract all Xiaohongshu URLs from the user input.
3. Fetch each original share URL and follow redirects.
4. Extract the final URL, note id, HTML, and `window.__INITIAL_STATE__`.
5. Parse state safely, replacing `:undefined` with `:null` before JSON parse when needed.
6. Recursively locate the note object.
7. Confirm this is a video note by locating video payload, `mediaV2`, or subtitle metadata.
8. Normalize title, description, author, cover, duration, and engagement metrics.
9. Parse `mediaV2` when present. It may be an escaped JSON string requiring two JSON parse passes.
10. Locate subtitle URLs, prefer source Chinese subtitles when available.
11. Download SRT with browser-like headers and Xiaohongshu referer.
12. Correct obvious ASR errors using [subtitle_corrections.md](references/subtitle_corrections.md), then merge into a complete spoken script.
13. Generate video analysis fields:
    - viral breakdown
    - reusable tactics
14. Save an Excel backup before Feishu write.
15. Write successful records to the configured video Bitable.
16. Set visible field order.
17. Verify record count, required fields, and numeric engagement fields.
18. Return the Bitable link, backup path, success count, and failed links with reasons.

Use [xhs_video_scraping.md](references/xhs_video_scraping.md), [analysis_templates.md](references/analysis_templates.md), and [feishu_bitable.md](references/feishu_bitable.md) as needed.

## Analysis Standards

The video analysis must focus on the mechanics of a video:

- opening hook
- pain point
- authority or trend signal
- narrative order
- spoken structure
- likely visual evidence
- CTA or conversion design
- reusable script formula

Do not claim visual details unless you inspected frames, cover, or source data. If only subtitles are available, write from the subtitle and metadata.

## Error Handling

If Feishu fails, still deliver the Excel backup.

If subtitles fail, do not fail the whole record. Mark `口播文案（原始字幕）` as `未获取字幕` and make the analysis explicitly subtitle-limited.

Never fabricate:

- engagement counts
- subtitle lines
- video duration
- author
- cover URL
- unseen visual details

## Acceptance Criteria

A completed run must report:

- video Bitable URL
- image-text Bitable URL if first-run initialization happened
- number of links detected
- number of records written
- failed links and reasons
- whether subtitles were obtained
- Excel backup path
- whether field order was verified
