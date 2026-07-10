---
name: xhs-video-viral-breakdown-to-bitable
description: Use when the user wants to collect, analyze, and save Xiaohongshu video notes into a persistent Feishu/Lark Bitable. Handles public Xiaohongshu share links, extracts title, cover, author, engagement metrics, video duration, mediaV2 subtitle data, corrected spoken script, viral breakdown, and reusable tactics. Requires first-run Feishu CLI initialization and writes future video notes into the same configured Feishu Bitable.
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
~/.codex/xhs-viral-breakdown-to-bitable/config.json
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

The video analysis must be diagnostic and framework-driven. Use the models in [analysis_templates.md](references/analysis_templates.md) to produce evidence-based, operational insights.

### Core Principles

1. **Timeline + density dual analysis**: Analyze both the time-axis structure (what happens every 3-5 seconds) and the information density curve (where it accelerates, where it slows down, and why).
2. **Trust hierarchy**: Distinguish three layers of trust building — authenticity (real person), professionalism (expertise), and empathy (understanding). Identify which layer the video primarily relies on.
3. **Conversion mechanics**: Analyze CTA type, position, timing, action threshold, and conversion funnel design.
4. **Modular extraction**: Break reusable parts into independent modules, each with function, structure, replaceable variables, and applicable scenarios.
5. **Success factor ranking**: Rank key success factors from high to low, estimating impact if removed.

### Quality Examples

**Bad (vague, no evidence):**

```text
这条视频节奏好，开头很抓人，内容有价值，所以爆了。
```

**Medium (specific but shallow):**

```text
开头用了反常识观点，中间讲了方法论，结尾引导关注。适合想做自媒体的人看。
```

**Good (mechanics-focused):**

```text
开头用"90%的人都做错了"制造认知冲突，3秒内留住用户；中段用"工具名→痛点→能力→结果"的结构展开，每10秒一个信息高点；结尾用"评论区领资料"降低行动门槛。
```

**Excellent (framework-driven, all dimensions covered):**

```text
时间轴分析：0-3秒用反常识钩子（"为什么我不建议你做自媒体"），决策机制为好奇心+恐惧感；3-10秒放大痛点（"每天花3小时，播放量不到500"），情绪曲线焦虑上升；10-35秒价值交付（"3个工具+1个流程"），信息密度高，每3秒一个要点；35-40秒CTA（"评论区扣1领流程图"），门槛中等，即时回报明确。

信息密度：0-10秒低密度（铺垫），10-30秒高密度（干货），30-35秒低密度（过渡），35-40秒中密度（CTA）。加速点在10秒处（进入方法论），减速点在30秒处（强调重点）。

信任建立：主要依赖第一层（真实感）——口语化表达（"说实话""我自己也踩过坑"）+具体细节（"去年3月""花了2万"）。第二层（专业性）辅助——使用"SOP""变现闭环"等术语。

可复制模块：①反常识钩子="为什么我不建议X"（X=常见做法）；②痛点三段式="你是不是也___→每次___都特别___→其实根本原因是___"；③低门槛CTA="如果你也想___，可以先___"。

脚本公式：反常识钩子(3秒)+痛点放大(7秒)+方法论步骤(主体)+信任案例(穿插)+低门槛CTA(5秒)。信息密度曲线：低→高→低→中。
```

### Hard Rules

- **Timeline analysis**: Must cover 0-3s, 3-10s, 10-30s, and 30s+ segments. Each segment must specify hook type, information delivery, and emotion/function.
- **Density analysis**: Must identify high-density segments, low-density segments, and transition points with rationale.
- **Trust analysis**: Must distinguish three layers (authenticity/professionalism/empathy) and identify the primary layer.
- **Conversion analysis**: Must specify CTA type, position, timing, action threshold, and immediate reward.
- **Reusable parts**: Must be extracted as independent modules with function, structure, variables, and scenarios. Must include a complete script formula with replaceable variables.
- **Success ranking**: Must rank top 3 success factors and estimate impact if removed.
- **Quality gate**: Before final output, run the Analysis Quality Checklist in [analysis_templates.md](references/analysis_templates.md).
- **Subtitle limitation**: If only subtitles are available, insert the required disclaimer at the beginning of analysis and use cautious phrasing for visual elements.

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

