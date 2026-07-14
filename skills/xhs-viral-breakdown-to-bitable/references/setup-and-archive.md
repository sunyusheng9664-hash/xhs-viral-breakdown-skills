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

## 更新已有 Skill

先识别是首次安装还是更新，并只读检查现有表结构：

```text
node "<skill-dir>/scripts/xhs-breakdown.mjs" upgrade-check --output-dir <报告目录>
```

返回 `install` 时继续首次配置；返回 `ready` 时直接使用；返回 `upgrade` 时，必须把 `customer_message` 原样展示给用户并停止。用户明确同意本次方案后，使用同一次检查返回的 `plan_id` 运行：

```text
node "<skill-dir>/scripts/xhs-breakdown.mjs" upgrade-apply --plan-id <plan_id> --confirm-upgrade --output-dir <报告目录>
```

命令会保存升级前后的字段和视图报告。它只新增缺失字段、保留旧字段和自定义字段。若方案发生变化，旧 `plan_id` 会失效，必须重新说明并授权。`schema-plan` 和 `schema-migrate` 仅保留为兼容入口，同样要求匹配的 `plan_id` 和明确确认。

## 修复历史图片

先预览最多 50 条候选记录：

```text
node "<skill-dir>/scripts/xhs-breakdown.mjs" repair-images --dry-run --limit 50 --output-dir <报告目录>
```

用户确认后执行：

```text
node "<skill-dir>/scripts/xhs-breakdown.mjs" repair-images --confirm-repair --limit 50 --output-dir <报告目录>
```

可用 `--type image_text` 或 `--type video` 只处理一个库。修复流程只读取“链接”字段并重新访问原笔记，不读取、不验证、不重试旧 CDN 地址。失败时保留旧字段和已有附件，并写入准确状态；再次运行只补同名缺失附件。

## 失败处理

- `doctor` 显示 Node.js 版本低于18：停止并提示升级。
- `doctor` 首次运行时若只因配置缺失返回非零状态，继续执行本页配置流程，配置完成后重新检查。
- 飞书 CLI 缺失或配置所选身份未就绪：仍允许 `extract` 和本地备份；`archive` 返回飞书失败。
- 配置不完整：不得猜测 Base token、Table ID 或 View ID。
- 页面公开数据不足：保留原始链接、最终链接、失败阶段和原因。
- 旧 CDN 地址失效：不要重试旧地址，使用“链接”字段重新访问原笔记。
- 403、404、验证码或登录限制：不得直接声称笔记已删除，按“抓取受限/短链失效/源笔记不可访问”分级记录。
