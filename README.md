# Xiaohongshu Viral Breakdown Skills

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

## Install in Codex

Recommended: ask Codex to install both skills from this GitHub repository:

```text
Use $skill-installer to install these two skills from sunyusheng9664-hash/xhs-viral-breakdown-skills:
skills/xhs-image-text-viral-breakdown-to-bitable
skills/xhs-video-viral-breakdown-to-bitable
```

After installation, restart Codex so it picks up the new skills.

If you want to install manually:

```bash
git clone https://github.com/sunyusheng9664-hash/xhs-viral-breakdown-skills.git
mkdir -p ~/.codex/skills
cp -R xhs-viral-breakdown-skills/skills/xhs-image-text-viral-breakdown-to-bitable ~/.codex/skills/
cp -R xhs-viral-breakdown-skills/skills/xhs-video-viral-breakdown-to-bitable ~/.codex/skills/
```

Then restart Codex.

Verify the files exist:

```bash
ls ~/.codex/skills/xhs-image-text-viral-breakdown-to-bitable/SKILL.md
ls ~/.codex/skills/xhs-video-viral-breakdown-to-bitable/SKILL.md
```

Use the skills by describing the task naturally, or invoke them explicitly:

```text
Use $xhs-image-text-viral-breakdown-to-bitable to拆解这些小红书图文笔记并写入飞书。
Use $xhs-video-viral-breakdown-to-bitable to拆解这些小红书视频笔记并写入飞书。
```

## First-Run Rule

Both skills require a Feishu/Lark CLI setup gate before processing Xiaohongshu links.

On first run, the agent must ask the user for permission to create two long-lived Feishu Bitables:

1. `小红书视频爆款拆解库`
2. `小红书图文爆款拆解库`

After creation, future video notes are written to the video library and future image-text notes are written to the image-text library. The local binding is stored at:

```text
~/.codex/xhs-viral-breakdown-to-bitable/config.json
```

## Fallback

If Feishu CLI or authorization is unavailable, the skills should still produce an Excel backup and report the Feishu failure clearly.
