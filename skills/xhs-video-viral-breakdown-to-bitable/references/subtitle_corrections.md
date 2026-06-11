# Subtitle Correction Rules

Xiaohongshu auto subtitles often corrupt product names, English terms, and person names. Correct obvious ASR errors before writing `口播文案（原始字幕）`.

## Known Corrections

```text
codes -> Codex
codax -> Codex
codesi -> Codex
s q -> Skill
sq -> Skill
华人勋 -> 黄仁勋
mac档 -> Markdown
卡巴西 -> 卡帕西
入手 -> 助手
外科手术师修改 -> 外科手术式修改
```

## Rules

- Correct high-confidence domain terms.
- Preserve original meaning.
- Do not "polish" the speaker into a different style.
- Merge broken subtitle fragments into readable paragraphs.
- If correction is uncertain, keep the original phrase or mention uncertainty in the run summary.

If the user asks for raw SRT preservation, save both raw SRT and corrected transcript in the backup.

