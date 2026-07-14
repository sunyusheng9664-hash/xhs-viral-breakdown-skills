---
name: xhs-image-text-lite-to-bitable
description: 当用户提供一个或多个小红书公开图文笔记链接，只希望采集标题、正文、话题、图片 URL、点赞、收藏、评论、转发等公开数据，并生成 Excel 备份和归档到飞书多维表格时使用。Lite 版不做爆款分析，不处理视频，不获取字幕或逐字稿。
---

# 小红书图文采集归档 Skill Lite

把用户主动提供的公开小红书图文链接采集为基础素材记录。Lite 版只做采集、备份、去重和飞书归档，不生成爆款原因、互动诱因、可复制点，不处理视频笔记。

## 固定流程

1. 将本文件所在目录记为 `<skill-dir>`。所有命令都必须使用 `<skill-dir>/scripts/xhs-image-text-lite.mjs` 的绝对路径，不得假设当前工作目录是 Skill 目录。
2. 先运行：

   ```text
   node "<skill-dir>/scripts/xhs-image-text-lite.mjs" doctor
   ```

3. 若 Lite 配置不存在，读取 [setup-and-archive.md](references/setup-and-archive.md)：
   - 优先从 Pro 版配置迁移图文库绑定；
   - 或绑定用户提供的已有图文库；
   - 只有用户明确同意后，才创建一个 `小红书图文采集试用库`。
4. 把用户原始输入保存到临时文本文件，运行：

   ```text
   node "<skill-dir>/scripts/xhs-image-text-lite.mjs" extract --input <输入文件> --output <采集结果.json>
   ```

5. 不填写 `analysis` 对象，不补充爆款分析字段。Lite 版只使用提取到的公开数据。
6. 运行归档：

   ```text
   node "<skill-dir>/scripts/xhs-image-text-lite.mjs" archive --input <采集结果.json> --output-dir <备份目录>
   ```

7. 返回检测链接数、图文成功数、视频或失败链接原因、写入数、重复数、飞书链接和 Excel 备份路径。

## 字段边界

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

不得新增或填写以下付费版字段：

```text
封面分析
互动诱因
爆款原因
可复制点
口播文案（原始字幕）
爆款拆解
可复制部分
```

## 硬性边界

- 只处理公开图文笔记，不登录小红书、不绕过权限、不批量搜索。
- 遇到视频笔记，记录失败原因并提示使用 Pro 版。
- 不得编造标题、正文、互动数、图片、话题或作者信息。
- 不得进行爆款分析、仿写建议、互动诱因判断或可复制点总结。
- 必须先生成 Excel 备份，再尝试写飞书。
- 飞书失败时交付备份和可操作的失败原因。
- 不得把飞书凭证、Base token 或用户内容写入 Skill 文件。
- 不得新建飞书库，除非用户在当前对话中明确同意。

## 输入与输出契约

`extract` 输出 JSON。每条成功记录包含：

```json
{
  "status": "success",
  "type": "image_text",
  "original_url": "用户提交的链接",
  "final_url": "跳转后的链接",
  "note_id": "笔记ID",
  "data": {}
}
```

失败记录必须包含 `reason`。视频链接不是 Lite 成功项。

## 完成标准

- 所有输入链接都有成功或失败结论。
- 成功项只包含图文公开数据。
- 数字字段保持数字类型。
- 重复运行同一链接不新增记录。
- 返回可打开的 `.xlsx` 备份。

