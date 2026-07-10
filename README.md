# Xiaohongshu Viral Breakdown Skills

The core advantage of these skills is not aggressive Xiaohongshu crawling, but a low-risk public-link workflow. They only process public share links provided by the user. They do not require Xiaohongshu login, cookies, account sessions, likes, saves, comments, search scraping, or bulk page crawling. They simply open the public link and organize the title, body, images, engagement data, subtitles, and other content already returned to the browser.

This keeps the risk much lower: no account access, no private data, no login bypassing, and no high-frequency collection. If a public page exposes the data, the skills organize it; if not, they mark it as unavailable instead of forcing extraction. The product is best understood as public content organization, viral-content analysis, and Feishu Bitable archiving, not a high-risk crawler.

This repository contains two Codex skills for turning public Xiaohongshu notes into persistent Feishu/Lark Bitable content libraries.

## Skills

- `skills/xhs-image-text-viral-breakdown-to-bitable`
  - Processes Xiaohongshu image-text notes.
  - Extracts title, summary, topics, cover, image URLs, engagement metrics.
  - Produces cover analysis, interaction drivers, viral reasons, and reusable tactics.

- `skills/xhs-video-viral-breakdown-to-bitable`
  - Processes Xiaohongshu video notes.
  - Extracts title, cover, author, engagement metrics, duration, `mediaV2`, and subtitles when available.
  - Produces corrected spoken transcript, viral breakdown, and reusable tactics.

## Installation 安装

### Codex

```text
# From Codex
Use $skill-installer to install:
https://github.com/sunyusheng9664-hash/xhs-viral-breakdown-skills/tree/main/skills/xhs-image-text-viral-breakdown-to-bitable
https://github.com/sunyusheng9664-hash/xhs-viral-breakdown-skills/tree/main/skills/xhs-video-viral-breakdown-to-bitable
```

Or manually:

```bash
git clone https://github.com/sunyusheng9664-hash/xhs-viral-breakdown-skills.git
mkdir -p ~/.codex/skills
cp -R xhs-viral-breakdown-skills/skills/xhs-image-text-viral-breakdown-to-bitable ~/.codex/skills/
cp -R xhs-viral-breakdown-skills/skills/xhs-video-viral-breakdown-to-bitable ~/.codex/skills/
```

Restart Codex after installation.

## First-Run Rule

Both skills require a Feishu/Lark CLI setup gate before processing Xiaohongshu links.

On first run, the agent must ask the user for permission to create two long-lived Feishu Bitables:

1. `小红书视频爆款拆解库`
2. `小红书图文爆款拆解库`

After creation, future video notes are written to the video library and future image-text notes are written to the image-text library. The local binding is stored at:

```text
~/.codex/xhs-viral-breakdown-to-bitable/config.json
```

## Changelog

### v1.1.0 (2026-07-10) - Diagnostic Analysis Framework Upgrade

**Major upgrade to analysis methodology** — transformed from simple fill-in templates to comprehensive diagnostic frameworks.

- **Image-Text Skill**: Added VISUAL-D cover model, TRIGGER interaction model, 3-layer viral attribution, and formulaic reusable tactics
- **Video Skill**: Added 4D diagnostic model (timeline + density + trust + conversion), modular extraction, and script formula templates
- **Both Skills**: Upgraded Analysis Standards with 5 core principles, 4-tier quality examples, and hard rules
- See [RELEASE_NOTES_v1.1.0.md](RELEASE_NOTES_v1.1.0.md) for full details

### v1.0.0 (2026-06-11) - Initial Release

- Initial release with image-text and video viral breakdown skills
- Public-link workflow with Feishu Bitable integration
- Basic analysis templates for cover, interaction, viral reasons, and reusable tactics

## Fallback

If Feishu CLI or authorization is unavailable, the skills should still produce an Excel backup and report the Feishu failure clearly.
