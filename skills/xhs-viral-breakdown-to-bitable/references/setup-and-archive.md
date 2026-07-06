# 飞书初始化与归档

## 配置位置

- macOS/Linux：`~/.config/xhs-viral-breakdown/config.json`
- Windows：`%APPDATA%/xhs-viral-breakdown/config.json`

配置只保存 Base、Table、View 元数据，不保存飞书登录凭证。飞书身份由官方 `lark-cli` 管理。

## 首次使用

先运行：

```text
node "<skill-dir>/scripts/xhs-breakdown.mjs" configure --migrate
```

若没有旧配置，可让用户提供一个不含凭证的绑定 JSON，再运行：

```text
node "<skill-dir>/scripts/xhs-breakdown.mjs" configure --bind <绑定文件.json>
```

需要创建新库时，必须先询问：

```text
我需要创建两个长期使用的飞书多维表格：小红书视频爆款拆解库和小红书图文爆款拆解库。之后会分别追加内容。是否现在创建？
```

用户明确同意后运行：

```text
node "<skill-dir>/scripts/xhs-breakdown.mjs" configure --create --confirm-create
```

测试时使用：

```text
node "<skill-dir>/scripts/xhs-breakdown.mjs" configure --create-test --confirm-create
```

## 绑定 JSON

```json
{
  "timezone": "Asia/Shanghai",
  "feishu": {
    "identity": "bot",
    "video": {
      "base_name": "小红书视频爆款拆解库",
      "base_token": "",
      "base_url": "",
      "table_name": "内容拆解库",
      "table_id": "",
      "view_id": ""
    },
    "image_text": {
      "base_name": "小红书图文爆款拆解库",
      "base_token": "",
      "base_url": "",
      "table_name": "内容拆解库",
      "table_id": "",
      "view_id": ""
    }
  }
}
```

不得把填写后的绑定文件放回 Skill 目录或发布包。

## 失败处理

- `doctor` 显示 Node.js 版本低于18：停止并提示升级。
- `doctor` 首次运行时若只因配置缺失返回非零状态，继续执行本页配置流程，配置完成后重新检查。
- 飞书 CLI 缺失或配置所选身份未就绪：仍允许 `extract` 和本地备份；`archive` 返回飞书失败。
- 配置不完整：不得猜测 Base token、Table ID 或 View ID。
- 页面公开数据不足：保留原始链接、最终链接、失败阶段和原因。
