# 每日具身智能产业简报

飞书多维表格是内容源，GitHub Actions 拉取最新记录并生成 `public/data.json`，随后自动部署 `public/` 到 GitHub Pages。

## 飞书表格字段

| 飞书字段 | 网页数据字段 | 是否必填 |
| --- | --- | --- |
| 整理日期 | 整理日期 | 是 |
| 标题 | 标题 | 是 |
| 主题 | 主题 | 否 |
| 简介 | 简介 | 否 |
| 链接（URL） | 链接 | 否 |

脚本也兼容飞书表格将最后一个字段命名为 `链接` 的情况。

## GitHub Secrets

仓库创建并推送后，在仓库的 `Settings → Secrets and variables → Actions` 中新增：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_APP_TOKEN`：多维表格 App Token
- `FEISHU_TABLE_ID`：数据表 Table ID

不要将 App Secret、GitHub Token 或其他密钥写入任何被提交的文件。

## 本地同步（可选）

配置同名环境变量后运行：

```bash
npm run sync
```

## 图片

将需要公开发布的页面图片放入 `public/assets/images/`，并在页面中使用相对路径，例如 `assets/images/airs-logo.png`。

当前飞书附件不会自动下载到本仓库；首版只同步表格文本字段。若要在网页中展示每日 PNG，需要后续单独配置附件下载与公开图片归档策略。
