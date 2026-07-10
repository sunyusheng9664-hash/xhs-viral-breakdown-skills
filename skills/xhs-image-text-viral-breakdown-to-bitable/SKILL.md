---
name: xhs-image-text-viral-breakdown-to-bitable
description: Use when the user wants to collect, analyze, and save Xiaohongshu image-text notes into a persistent Feishu/Lark Bitable. Handles public Xiaohongshu share links, extracts title, summary, topics, cover, image URLs, engagement metrics, and produces cover analysis, interaction drivers, viral reasons, and reusable tactics. Requires first-run Feishu CLI initialization and writes future image-text notes into the same configured Feishu Bitable.
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
~/.codex/xhs-viral-breakdown-to-bitable/config.json
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

Analysis must be diagnostic, not descriptive. Use the frameworks in [analysis_templates.md](references/analysis_templates.md) to produce evidence-based, operational insights.

### Core Principles

1. **From description to diagnosis**: Do not ask "what does the cover look like?" Ask "what problem is the cover solving for the user?"
2. **From listing to causation**: Do not list elements side by side. Explain the causal chain.
3. **From summary to formula**: Reusable tactics must be formulaic templates with replaceable variables, not descriptive summaries.
4. **From static to dynamic**: Consider information density curves and user psychological curves.
5. **From single-layer to multi-layer**: Viral reasons must be separated into necessary conditions, sufficient conditions, and amplifiers.

### Quality Examples

**Bad (vague, no evidence):**

```text
标题吸引人，内容有价值，所以容易爆。
```

**Medium (specific but shallow):**

```text
封面用了大字标题，突出了痛点，用户一看就想点。正文是清单形式，方便收藏。
```

**Good (diagnostic, causal, operational):**

```text
封面把结果界面直接前置，降低用户判断成本；标题用"不是资料库，是内容运营系统"制造反常识，正文再用模块化结构证明这个系统能落地。收藏动机来自可复用流程，而评论动机来自用户追问模板和工具设置。
```

**Excellent (framework-driven, all dimensions covered):**

```text
封面分析（VISUAL-D）：视觉焦点为左上角的"30天"红色大字（占30%面积）；信息层级为"数字→痛点词→结果承诺"三层；信号类型为利益信号（"月入3W"）；差异化在于使用真实数据截图而非普通配图；决策成本低，用户0.3秒即可判断价值。

互动诱因（TRIGGER）：主要驱动力为Gain（收藏后可复用的清单）和Gap（标题留下"如何做到"的缺口）；次要驱动力为Identity（"打工人"标签）。互动入口：标题埋入反常识钩子，正文结尾设置"评论区领模板"CTA。

爆款原因（三层归因）：第一层（必要）——选题击中"副业刚需"高需求场景；第二层（充分/可复制）——封面决策成本极低+正文3秒交付核心价值+算法关键词匹配；第三层（放大）——踩中Q1求职季趋势+作者有职场博主背书。

可复制点：标题公式=[数字]+[反常识判断]+[结果承诺]；封面公式=[大字数字]+[痛点关键词]+[真实截图]；正文结构=痛点共鸣(20%)→反常识观点(30%)→方法论步骤(40%)→CTA(10%)。
```

### Hard Rules

- **Cover analysis**: Every VISUAL-D dimension must have at least one concrete evidence. Never use adjectives like "attractive" "beautiful" "valuable" without evidence.
- **Interaction drivers**: Must distinguish primary drivers (1-2) from secondary drivers (1-2). Do not list all possibilities equally.
- **Viral reasons**: Must separate into Layer 1 (necessary), Layer 2 (sufficient/replicable), and Layer 3 (amplifiers). Include a causal chain summary.
- **Reusable tactics**: Must be formulaic with replaceable variables. Bad: "use numbers in title". Good: "Title formula = [number] + [counter-intuitive judgment] + [result promise]".
- **Quality gate**: Before final output, run the Analysis Quality Checklist in [analysis_templates.md](references/analysis_templates.md).

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

