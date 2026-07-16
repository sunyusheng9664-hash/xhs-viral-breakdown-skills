# 小红书爆款拆解与飞书归档 Skill

把用户主动提供的公开小红书图文、视频或博主主页链接转换成结构化内容资产，生成 Excel 备份，并写入包含图文笔记、视频笔记和博主主页的统一飞书内容工作台。

当前版本：v1.3.1。已补齐博主主页链接的识别、分析、Excel 备份、飞书归档和按作者 ID 关联笔记的完整链路。旧用户更新后，Skill 会先检查飞书权限，再说明双库合并方案、体验提升、权限范围和安全边界；取得一次性授权后才迁移。详见 [RELEASE_NOTES_v1.3.1.md](RELEASE_NOTES_v1.3.1.md)。

本仓库现在包含两个对外交付版本：

- Pro：`skills/xhs-viral-breakdown-to-bitable`，图文、视频和博主主页统一入口，包含爆款拆解、博主分析、视频字幕、Excel 备份、去重、博主关联和飞书归档。
- Lite：`skills/xhs-image-text-lite-to-bitable`，只采集小红书公开图文笔记的基础数据并归档到飞书，不包含爆款分析、视频和字幕能力。
- Video Lite：`skills/xhs-video-lite-to-bitable`，只采集小红书公开视频笔记的基础数据并归档到飞书，不包含字幕、逐字稿和爆款分析。

## 支持范围

- 统一 Skill：`skills/xhs-viral-breakdown-to-bitable`
- 试用 Skill：`skills/xhs-image-text-lite-to-bitable`
- 试用 Skill：`skills/xhs-video-lite-to-bitable`
- 已验证平台：Codex（macOS）
- 已生成待验收包：TRAE IDE、WorkBuddy 桌面端
- 运行要求：Node.js 18+、可访问公开小红书链接、已授权的飞书官方 CLI
- 不处理：登录后私密内容、批量平台搜索、绕过访问限制、自动发布或互动

仓库仍保留原图文和视频两个 Codex Skill 作为兼容入口。新用户应安装统一 Skill。

## 安装

运行发布脚本后，在 `dist/` 获取不含凭证的安装包：

```text
node scripts/package-release.mjs
```

Pro 包：

- `xhs-viral-breakdown-to-bitable-codex.zip`
- `xhs-viral-breakdown-to-bitable-trae.zip`
- `xhs-viral-breakdown-to-bitable-workbuddy.zip`

Lite 试用包：

- `xhs-image-text-lite-to-bitable.zip`
- `xhs-video-lite-to-bitable.zip`
- `xhs-basic-lite-bundle.zip`：基础版组合包，包含图文 Lite 和视频 Lite，可作为 9.9 元档交付。

### Codex

解压 `xhs-viral-breakdown-to-bitable-codex.zip` 到 `~/.codex/skills/`，或使用 Codex Skill 安装器安装其中的 Skill 目录。重启 Codex 后使用。

试用版可解压 `xhs-basic-lite-bundle.zip` 到 `~/.codex/skills/`。基础版包含两个独立 Skill：图文 Lite 创建或绑定 `小红书图文采集试用库`，视频 Lite 创建或绑定 `小红书视频采集试用库`。

### TRAE

TRAE 安装包已经生成，但客户端导入方式和端到端运行尚待实际验收。验收前不要在销售页面标记为“已支持”。如客户端支持本地 Agent Skill，可解压后选择其中的 `SKILL.md` 或将完整 Skill 目录放入客户端要求的位置。

### WorkBuddy

在“技能 → 添加技能 → 上传技能”中导入 `xhs-viral-breakdown-to-bitable-workbuddy.zip`。首轮只承诺桌面端；网页端和移动端未完成端到端验证。

## 首次授权与旧用户升级

先检查环境：

```text
node "/完整路径/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs" doctor
```

首次运行时如果只因 Skill 配置尚不存在而返回失败，继续完成下方初始化，之后重新运行 `doctor`。其他失败项应先修复。

首次使用飞书 CLI 需要先初始化应用配置。旧用户更新后也会先检查当前身份是否具备 Base 读写及附件权限：

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

用户可直接发送一条、多条或混合的小红书分享文案。统一 Skill 自动提取链接并按图文、视频或博主主页分流。

- 无字幕：保留视频元数据并标记 `未获取字幕`。
- 飞书不可用：仍生成 `.xlsx` 备份并返回错误。
- 重复链接：通过 noteId、原始链接、最终链接和本地归档索引去重。
- 博主关联：只在笔记 `author_id` 与主页 `user_id` 一致时填写“所属博主”；同批但不同作者的链接不会误关联。
- 页面不再公开：记录失败阶段和原因，不编造内容。
- 图片归档：图片先下载为本地临时文件，再上传到飞书附件字段，不把临时 CDN 链接当作长期存储。
- 已有表升级：先运行 `upgrade-check` 并向用户展示返回的说明；用户明确同意后，按返回的 `plan_id` 运行 `upgrade-apply --confirm-upgrade`。
- 旧版双库：升级后统一到原图文库所在 Base，原视频库保留为备份。
- 授权不足：`upgrade-check` 返回 `authorization_required`；user 身份发起 Base 最小授权，bot 身份引导开发者后台补权限。
- 历史图片：先运行 `repair-images --dry-run`；确认后再运行 `repair-images --confirm-repair`。

## 回滚

- 升级前完整基线：Git 标签 `pre-v1.2.0-20260714`
- v1.2.1 升级前基线：Git 标签 `pre-v1.2.1-20260714`（指向 v1.2.0）
- 已发布标签：`v1.2.1`
- 当前主分支版本：v1.3.1；v1.3.0 的统一表迁移能力保持不变，v1.3.1 补齐博主主页归档链路。
- 回滚只切换代码版本，不会自动删除飞书中已新增的字段或附件；这些新增内容与旧版兼容，可保留。

Windows、TRAE、WorkBuddy 只有在实际端到端验收后才应在销售页面标记为“已验证”。

## Lite 与 Pro 的售卖边界

Lite 版只写入：

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
采集时间
失败原因
```

Lite 版不包含：

- 图文爆款分析；
- 封面分析、互动诱因、爆款原因、可复制点；
- 视频字幕或逐字稿；
- 视频爆款拆解或可复制部分；
- 混合链接自动分流。

这些能力属于 Pro 版。
