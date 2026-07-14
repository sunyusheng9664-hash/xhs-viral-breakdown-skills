# 视频 Lite 初始化与归档

## 配置位置

- macOS/Linux：`~/.config/xhs-video-lite/config.json`
- Windows：`%APPDATA%/xhs-video-lite/config.json`

配置只保存视频试用库的 Base、Table、View 元数据，不保存飞书登录凭证。飞书身份由官方 `lark-cli` 管理。

## 首次使用

先运行：

```text
node "<skill-dir>/scripts/xhs-video-lite.mjs" doctor
```

如果用户已经安装过 Pro 版，可迁移 Pro 配置中的视频库绑定：

```text
node "<skill-dir>/scripts/xhs-video-lite.mjs" configure --migrate
```

如果需要绑定已有视频库，使用不含凭证的绑定 JSON：

```text
node "<skill-dir>/scripts/xhs-video-lite.mjs" configure --bind <绑定文件.json>
```

如果需要创建新的试用库，必须先询问：

```text
我需要创建一个飞书多维表格：小红书视频采集试用库。它只用于公开视频基础数据采集，不包含字幕、逐字稿和爆款分析能力。是否现在创建？
```

用户明确同意后运行：

```text
node "<skill-dir>/scripts/xhs-video-lite.mjs" configure --create --confirm-create
```

## 绑定 JSON

```json
{
  "timezone": "Asia/Shanghai",
  "feishu": {
    "identity": "bot",
    "video": {
      "base_name": "小红书视频采集试用库",
      "base_token": "",
      "base_url": "",
      "table_name": "视频采集库",
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
链接
封面
作者
视频时长
点赞数
收藏数
评论数
分享数
正文
采集时间
失败原因
```

视频 Lite 不创建或写入字幕、逐字稿、爆款拆解或可复制部分字段。

