# 更新用户引导

本页只用于“已有旧版配置”的更新流程，不用于首次安装。

## 必须执行

1. 运行 `upgrade-check`。命令必须先检查当前配置所选飞书身份是否就绪，权限未就绪时不得读取表结构。
2. 若返回 `mode: authorization_required`，把 `customer_message` 原样发给用户：
   - user 身份：执行返回的最小范围授权命令，使用飞书 CLI 生成授权链接和二维码，展示后停止；用户确认授权完成后，由 Agent 完成设备授权并重新运行 `upgrade-check`；
   - bot 身份：禁止执行 `auth login`，按返回说明引导用户在飞书开发者后台开通 Base 读写和附件相关权限。
3. 若返回 `mode: upgrade`，把 `customer_message` 原样发给用户。消息先说明统一工作台带来的可见结果，再列迁移动作、权限范围和不会执行的操作。
4. 停止后续操作，等待用户明确同意。沉默、继续使用 Skill 或之前对其他操作的同意，都不算本次迁移授权。
5. 用户同意后，使用本次返回的 `plan_id` 执行：

   ```text
   node "<skill-dir>/scripts/xhs-breakdown.mjs" upgrade-apply --plan-id <plan_id> --confirm-upgrade --output-dir <报告目录>
   ```

6. 若提示方案变化，重新运行 `upgrade-check`、重新展示说明并重新授权。

升级会以原图文库所在 Base 作为统一工作台，将图文表改名为“图文笔记”，创建或复用“视频笔记”和“博主主页”，复制原视频记录及附件，并新增“所属博主”关联字段。原视频库保留为备份，不删除旧字段、旧数据或自定义字段。升级完成后，删除旧库和历史图片修复都必须另行授权。
