# 小红书爆款拆解与飞书归档 Skill

把用户主动提供的公开小红书图文或视频链接转换成结构化内容资产，生成 Excel 备份，并分别写入长期使用的飞书多维表格。

## 支持范围

- 统一 Skill：`skills/xhs-viral-breakdown-to-bitable`
- 已验证平台：Codex（macOS）
- 已生成待验收包：TRAE IDE、WorkBuddy 桌面端
- 运行要求：Node.js 18+、可访问公开小红书链接、已授权的飞书官方 CLI
- 不处理：登录后私密内容、批量平台搜索、绕过访问限制、自动发布或互动

仓库仍保留原图文和视频两个 Codex Skill 作为兼容入口。新用户应安装统一 Skill。

## 安装

运行发布脚本后，在 `dist/` 获取三个不含凭证的安装包：

```text
node scripts/package-release.mjs
```

### Codex

解压 `xhs-viral-breakdown-to-bitable-codex.zip` 到 `~/.codex/skills/`，或使用 Codex Skill 安装器安装其中的 Skill 目录。重启 Codex 后使用。

### TRAE

TRAE 安装包已经生成，但客户端导入方式和端到端运行尚待实际验收。验收前不要在销售页面标记为“已支持”。如客户端支持本地 Agent Skill，可解压后选择其中的 `SKILL.md` 或将完整 Skill 目录放入客户端要求的位置。

### WorkBuddy

在“技能 → 添加技能 → 上传技能”中导入 `xhs-viral-breakdown-to-bitable-workbuddy.zip`。首轮只承诺桌面端；网页端和移动端未完成端到端验证。

## 首次授权

先检查环境：

```text
node "/完整路径/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs" doctor
```

首次运行时如果只因 Skill 配置尚不存在而返回失败，继续完成下方初始化，之后重新运行 `doctor`。其他失败项应先修复。

首次使用飞书 CLI 需要先初始化应用配置：

```text
lark-cli config init --new
```

默认配置使用 bot 身份。bot 不执行 `auth login`，应在飞书开发者后台为应用开通 Base 权限，然后检查状态：

```text
lark-cli auth status --json --verify
```

只有配置明确选择 user 身份时，才按最小权限发起用户授权：

```text
lark-cli auth login --domain base --no-wait --json
```

授权后再次运行 `auth status --json --verify`，确认配置所选身份为 `ready` 且 `verified`。登录状态和凭证始终由官方 CLI 管理。

统一 Skill 的平台中立配置位于：

- macOS/Linux：`~/.config/xhs-viral-breakdown/config.json`
- Windows：`%APPDATA%/xhs-viral-breakdown/config.json`

配置只保存 Base、Table、View 元数据，不保存飞书登录凭证。旧 Codex 配置可通过以下命令迁移，原文件不会删除：

```text
node "/完整路径/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs" configure --migrate
```

自动化测试可临时设置 `XHS_VIRAL_CONFIG_HOME` 隔离配置，不应覆盖用户的正式绑定。

## 使用和故障降级

用户可直接发送一条、多条或混合的小红书分享文案。统一 Skill 自动提取链接并按图文或视频分流。

- 无字幕：保留视频元数据并标记 `未获取字幕`。
- 飞书不可用：仍生成 `.xlsx` 备份并返回错误。
- 重复链接：通过 noteId、原始链接、最终链接和本地归档索引去重。
- 页面不再公开：记录失败阶段和原因，不编造内容。

Windows、TRAE、WorkBuddy 只有在实际端到端验收后才应在销售页面标记为“已验证”。
