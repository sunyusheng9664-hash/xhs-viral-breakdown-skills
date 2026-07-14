---
name: xhs-image-text-viral-breakdown-to-bitable
description: Legacy compatibility skill for collecting Xiaohongshu image-text notes into Feishu/Lark Bitable. Use only when the user explicitly names this legacy skill or an existing automation depends on it. For new image-text, video, or mixed-link requests, use xhs-viral-breakdown-to-bitable instead.
---

# Xiaohongshu Image-Text Viral Breakdown to Feishu Bitable

## Purpose

Turn public Xiaohongshu image-text note links into a durable content benchmark library in Feishu Bitable.

This skill is not a generic crawler. It exists to convert proven public content samples into reusable assets for topic selection, cover design, note structure, interaction design, and future content production.

## Mandatory First-Run Flow

Before processing Xiaohongshu links, run the Feishu setup gate in [feishu_setup.md](references/feishu_setup.md).

Hard rules:

1. First check whether the user's computer has Feishu/Lark CLI access.
2. If no persistent config exists, ask the user for permission to create two Bitables:
   - `小红书视频爆款拆解库`
   - `小红书图文爆款拆解库`
3. Create both libraries during initialization, even if this invocation only processes image-text notes. This keeps future writes stable.
4. Return both Bitable links to the user after creation.
5. Save both base tokens, table ids, view ids, and URLs in the local config.
6. For later runs, write image-text records only to the configured `小红书图文爆款拆解库`.
7. Do not create a new Bitable unless the user explicitly asks for a new library or the configured one is inaccessible and the user confirms replacement.

Recommended config path:

```text
~/.config/xhs-viral-breakdown/config.json
```

## Inputs

Accept:

- One Xiaohongshu public share URL.
- Multiple URLs, one per line.
- Mixed Xiaohongshu share text containing URLs.
- Optional existing Feishu Bitable URLs for rebinding if local config is missing.

Do not process private/login-only content. If the public share page does not expose enough data, record a failure reason instead of inventing fields.

## Default Output Fields

Create or verify the image-text table using these fields in this order:

```text
标题
正文
链接
话题
封面
点赞
收藏
评论
转发
图片
封面分析
互动诱因
爆款原因
可复制点
```

Rules:

- `正文` is a structured summary, not a full verbatim copy.
- `封面` is the first image URL.
- `图片` contains image URLs after the cover, separated by newlines. Leave empty if there are no extra images.
- `点赞`, `收藏`, `评论`, and `转发` must be number fields.
- Image fields are URL text fields in v1. Do not upload attachments unless the user explicitly asks.

See [fields.md](references/fields.md) for the full schema.

## Workflow

1. Run the Feishu setup gate.
2. Extract all Xiaohongshu URLs from the user input.
3. Fetch each original share URL and follow redirects.
4. Extract the final URL, note id, HTML, and `window.__INITIAL_STATE__`.
5. Parse the state safely, replacing `:undefined` with `:null` before JSON parse when needed.
6. Recursively locate the note object. Do not depend on one fixed path.
7. Confirm this is an image-text note by checking for `imageList` and no video-only payload requirement.
8. Normalize title, description, topics, cover, extra images, author if available, publish time if available, and engagement metrics.
9. Download or inspect the cover only when needed for analysis. Use browser-like headers and Xiaohongshu referer.
10. Generate the five analysis fields:
    - structured body summary
    - cover analysis
    - interaction drivers
    - viral reasons
    - reusable tactics
11. Save an Excel backup before Feishu write.
12. Write successful records to the configured image-text Bitable.
13. Set visible field order.
14. Verify record count, required fields, and numeric engagement fields.
15. Return the Bitable link, backup path, success count, and failed links with reasons.

Use [xhs_scraping.md](references/xhs_scraping.md), [analysis_templates.md](references/analysis_templates.md), and [feishu_bitable.md](references/feishu_bitable.md) as needed.

## Analysis Standards

Analysis must be specific and operational.

Bad:

```text
标题吸引人，内容有价值，所以容易爆。
```

Good:

```text
封面把结果界面直接前置，降低用户判断成本；标题用“不是资料库，是内容运营系统”制造反常识，正文再用模块化结构证明这个系统能落地。收藏动机来自可复用流程，而评论动机来自用户追问模板和工具设置。
```

Do not claim you saw visual details unless you inspected the image or the HTML exposes enough visible information.

## Error Handling

If Feishu fails, still deliver the Excel backup.

If some Xiaohongshu links fail, write successful records and list failed records separately.

Never fabricate:

- engagement counts
- note title
- image URLs
- topics
- cover contents
- comments

Use `未获取` only when the field is required and unavailable.

## Acceptance Criteria

A completed run must report:

- image-text Bitable URL
- video Bitable URL if first-run initialization happened
- number of links detected
- number of records written
- failed links and reasons
- Excel backup path
- whether field order was verified
