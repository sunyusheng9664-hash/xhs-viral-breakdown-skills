---
name: xhs-viral-breakdown-to-bitable
description: 当用户提供一个或多个小红书公开分享链接，希望自动识别图文或视频、提取公开内容与互动数据、生成爆款拆解，并分别归档到长期使用的飞书多维表格时使用。支持混合链接、字幕提取、Excel 备份、去重、失败降级和首次飞书初始化。
---

# 小红书爆款拆解与飞书归档

把用户主动提供的公开小红书链接转换成可复用的图文或视频内容资产。只处理公开页面，不登录小红书、不绕过权限、不批量搜索平台内容。

## 固定流程

1. 将本文件所在目录记为 `<skill-dir>`。所有命令都必须使用 `<skill-dir>/scripts/xhs-breakdown.mjs` 的绝对路径，不得假设当前工作目录是 Skill 目录。先运行 `node "<skill-dir>/scripts/xhs-breakdown.mjs" doctor` 检查本机环境。
2. 若平台中立配置不存在，读取 [setup-and-archive.md](references/setup-and-archive.md)：
   - 优先迁移旧 Codex 配置；
   - 或验证并绑定用户提供的飞书库；
   - 只有用户明确同意后，才创建两个长期飞书库。
3. 把用户原始输入保存到临时文本文件，运行：

   ```text
   node "<skill-dir>/scripts/xhs-breakdown.mjs" extract --input <输入文件> --output <提取结果.json>
   ```

4. 对每条成功记录按 `type` 路由：
   - `image_text`：读取 [image-text.md](references/image-text.md) 并填写图文分析字段。
   - `video`：读取 [video.md](references/video.md) 并填写视频分析字段。
5. 不修改提取结果中的 `original_url`、`final_url`、`note_id`、`type` 和 `data`。只填写每条记录的 `analysis` 对象。
6. 运行归档：

   ```text
   node "<skill-dir>/scripts/xhs-breakdown.mjs" archive --input <已分析结果.json> --output-dir <备份目录>
   ```

7. 返回检测链接数、分类结果、写入数、重复数、失败原因、飞书链接和 Excel 备份路径。

## 硬性边界

- 不得编造标题、互动数、图片、字幕、评论、作者或未看到的画面。
- 无字幕不是整条失败；保留元数据并标注 `未获取字幕`。
- 未检查图片或视频帧时，不得声称看到了具体视觉细节。
- 必须先生成 Excel 备份，再尝试写飞书。
- 飞书失败时交付备份和可操作的失败原因。
- 不得把飞书凭证、Base token 或用户内容写入 Skill 文件。
- 不得新建飞书库，除非用户在当前对话中明确同意。

## 输入与分析契约

`extract` 输出 JSON。每条成功记录包含：

```json
{
  "status": "success",
  "type": "image_text或video",
  "original_url": "用户提交的链接",
  "final_url": "跳转后的链接",
  "note_id": "笔记ID",
  "data": {},
  "analysis": {}
}
```

只按对应参考文件填写 `analysis`。缺失字段保留为空或 `null`，不得猜测。

## 完成标准

- 所有输入链接都有成功、重复或失败结论。
- 图文和视频分别进入配置的飞书库。
- 数字字段保持数字类型。
- 重复运行同一链接不新增记录。
- 返回可打开的 `.xlsx` 备份。
