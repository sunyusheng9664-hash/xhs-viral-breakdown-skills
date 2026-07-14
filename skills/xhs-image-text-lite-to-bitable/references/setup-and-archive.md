# Lite 初始化与归档

## 配置位置

- macOS/Linux：`~/.config/xhs-image-text-lite/config.json`
- Windows：`%APPDATA%/xhs-image-text-lite/config.json`

配置只保存图文试用库的 Base、Table、View 元数据，不保存飞书登录凭证。飞书身份由官方 `lark-cli` 管理。

## 首次使用

先运行：

```text
node "<skill-dir>/scripts/xhs-image-text-lite.mjs" doctor
```

如果用户已经安装过 Pro 版，可迁移 Pro 配置中的图文库绑定：

```text
node "<skill-dir>/scripts/xhs-image-text-lite.mjs" configure --migrate
```

如果需要绑定已有图文库，使用不含凭证的绑定 JSON：

```text
node "<skill-dir>/scripts/xhs-image-text-lite.mjs" configure --bind <绑定文件.json>
```

如果需要创建新的试用库，必须先询问：

```text
我需要创建一个飞书多维表格：小红书图文采集试用库。它只用于图文公开数据采集，不包含爆款分析和视频字幕能力。是否现在创建？
```

用户明确同意后运行：

```text
node "<skill-dir>/scripts/xhs-image-text-lite.mjs" configure --create --confirm-create
```

测试时使用：

```text
node "<skill-dir>/scripts/xhs-image-text-lite.mjs" configure --create-test --confirm-create
```

## 绑定 JSON

```json
{
  "timezone": "Asia/Shanghai",
  "feishu": {
    "identity": "bot",
    "image_text": {
      "base_name": "小红书图文采集试用库",
      "base_token": "",
      "base_url": "",
      "table_name": "图文采集库",
      "table_id": "",
      "view_id": ""
    }
  }
}
```

不得把填写后的绑定文件放回 Skill 目录或发布包。

## 字段

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

Lite 版不创建或写入以下 Pro 字段：

```text
封面分析
互动诱因
爆款原因
可复制点
口播文案（原始字幕）
爆款拆解
可复制部分
```

## 失败处理

- `doctor` 显示 Node.js 版本低于 18：停止并提示升级。
- 飞书 CLI 缺失或授权未就绪：仍允许 `extract` 和本地 Excel 备份；`archive` 返回飞书失败。
- 视频链接：记录失败原因，提示使用 Pro 版。
- 页面不公开或字段缺失：记录失败原因，不编造数据。

