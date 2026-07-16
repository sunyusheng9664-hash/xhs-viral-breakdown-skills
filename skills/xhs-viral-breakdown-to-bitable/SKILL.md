---
name: xhs-viral-breakdown-to-bitable
description: 当用户提供一个或多个小红书公开图文、视频或博主主页链接，希望自动识别内容类型、提取公开内容与互动数据、生成笔记拆解或博主分析，并归档到包含图文笔记、视频笔记和博主主页的统一飞书内容工作台时使用。支持三类链接混合输入、博主关联、字幕提取、真实图片附件、Excel 备份、去重、旧版双库安全合并、授权引导、历史图片修复和失败分级。
---

# 小红书爆款拆解与飞书归档

把用户主动提供的公开小红书链接转换成可复用的图文或视频内容资产。只处理公开页面，不登录小红书、不绕过权限、不批量搜索平台内容。

## 固定流程

1. 将本文件所在目录记为 `<skill-dir>`。所有命令都必须使用 `<skill-dir>/scripts/xhs-breakdown.mjs` 的绝对路径，不得假设当前工作目录是 Skill 目录。先运行 `node "<skill-dir>/scripts/xhs-breakdown.mjs" doctor` 检查本机环境。
2. 每次新版 Skill 首次被调用时，在提取或归档前运行 `node "<skill-dir>/scripts/xhs-breakdown.mjs" upgrade-check --output-dir <报告目录>`，并按返回的 `mode` 处理：
   - `install`：首次安装，不发升级提示，继续初始化；
   - `authorization_required`：读取 [update-onboarding.md](references/update-onboarding.md)，先展示返回的 `customer_message`。若为 user 身份，按最小 Base 范围发起授权并展示授权链接和二维码；若为 bot 身份，只提示开发者后台补齐权限，禁止执行 `auth login`。授权完成后重新运行检查；
   - `ready`：统一内容工作台已适配，直接继续；
   - `upgrade`：读取 [update-onboarding.md](references/update-onboarding.md)，把返回的 `customer_message` 原样展示给用户，然后停止并等待明确授权；
   - `blocked`：说明配置问题并停止，不猜测表格标识。
3. 若平台中立配置不存在，读取 [setup-and-archive.md](references/setup-and-archive.md)：
   - 优先识别并迁移旧 Codex 配置；
   - 或验证并绑定用户提供的飞书库；
   - 只有用户明确同意后，才创建一个包含“图文笔记”“视频笔记”“博主主页”的长期内容工作台。
4. 只有用户明确同意本次说明中的表结构方案后，才运行返回的 `upgrade-apply --plan-id <plan_id> --confirm-upgrade`。不得复用旧授权；`plan_id` 变化时必须重新说明并重新授权。
5. 把用户原始输入保存到临时文本文件，运行：

   ```text
   node "<skill-dir>/scripts/xhs-breakdown.mjs" extract --input <输入文件> --output <提取结果.json>
   ```

6. 对每条成功记录按 `type` 路由：
   - `image_text`：读取 [image-text.md](references/image-text.md) 并填写图文分析字段。
   - `video`：读取 [video.md](references/video.md) 并填写视频分析字段。
   - `blogger_profile`：读取 [blogger.md](references/blogger.md)，只根据主页公开资料和 `visible_notes` 填写博主分析字段。尝试保存当前未登录可见的完整主页截图，把本地绝对路径写入 `analysis.homepage_screenshot_path`；无法截图时留空并写入数据限制，不得伪造。
7. 不修改提取结果中的 `original_url`、`final_url`、`note_id`、`type` 和 `data`。只填写每条记录的 `analysis` 对象。
8. 运行归档：

   ```text
   node "<skill-dir>/scripts/xhs-breakdown.mjs" archive --input <已分析结果.json> --output-dir <备份目录>
   ```

   归档会先写入或复用博主记录，再写图文和视频，并仅按笔记 `author_id` 与主页 `user_id` 的一致性填写“所属博主”。图文首图写入“封面图片”，全部图片按原顺序写入“图片附件”；视频封面写入“封面图片”；博主头像写入“头像截图”，本地主页截图写入“主页截图”。
9. 返回检测链接数、分类结果、写入数、附件状态、重复数、失败原因、飞书链接和 Excel 备份路径。

## 历史图片修复

只有用户明确要求修复旧记录时，才读取 [setup-and-archive.md](references/setup-and-archive.md) 并执行 `repair-images`。先用 `--dry-run` 预览；取得同意后传入 `--confirm-repair`。历史修复必须从记录的“链接”字段重新访问原笔记，不尝试旧 CDN 地址，不清空旧字段或已有附件。

## 硬性边界

- 不得编造标题、互动数、图片、字幕、评论、作者或未看到的画面。
- 无字幕不是整条失败；保留元数据并标注 `未获取字幕`。
- 未检查图片或视频帧时，不得声称看到了具体视觉细节。
- 必须先生成 Excel 备份，再尝试写飞书。
- 不得把单次 403、404、登录页或空页面直接判定为笔记已删除；应区分短链失效、抓取受限与明确不可访问。
- 旧版升级以图文库所在 Base 作为统一工作台：保留原视频库作为备份，复制记录和附件，不删除、不改型、不清空旧字段。
- 表结构升级授权不包含历史图片修复；两项操作必须分别说明、分别授权。
- 未取得明确授权、缺少 `plan_id` 或 `plan_id` 已变化时，不得修改多维表格。
- 历史修复不得尝试旧 CDN 地址，只能从原笔记重新获取图片。
- 飞书失败时交付备份和可操作的失败原因。
- 不得把飞书凭证、Base token 或用户内容写入 Skill 文件。
- 不得新建飞书库，除非用户在当前对话中明确同意。

## 输入与分析契约

`extract` 输出 JSON。每条成功记录包含：

```json
{
  "status": "success",
  "type": "image_text、video或blogger_profile",
  "original_url": "用户提交的链接",
  "final_url": "跳转后的链接",
  "note_id": "笔记ID；博主主页为空",
  "profile_id": "仅博主主页存在",
  "data": {},
  "analysis": {}
}
```

只按对应参考文件填写 `analysis`。缺失字段保留为空或 `null`，不得猜测。

## 完成标准

- 所有输入链接都有成功、重复或失败结论。
- 图文、视频和博主主页分别进入统一 Base 的对应数据表，Excel 备份也包含三张工作表。
- 两张笔记表都包含指向“博主主页”的“所属博主”关联字段。
- 只按公开 `author_id` 关联博主；不同作者、缺少作者 ID 或没有匹配主页记录时保持未关联并说明原因。
- 数字字段保持数字类型。
- 重复运行同一链接不新增记录。
- 重复运行图片修复不重复上传同名附件；部分成功时只补缺失附件。
- 返回可打开的 `.xlsx` 备份。
