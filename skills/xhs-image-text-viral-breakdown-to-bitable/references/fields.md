# Image-Text Bitable Fields

Use these v1 fields in order.

| Field | Type | Rule |
|---|---|---|
| 标题 | text | Xiaohongshu title |
| 正文 | text | structured summary, not full verbatim copy |
| 链接 | text url | original user-provided share link |
| 话题 | text | `#话题` joined by spaces |
| 封面 | text url | first image URL |
| 点赞 | number | integer |
| 收藏 | number | integer |
| 评论 | number | integer |
| 转发 | number | integer |
| 图片 | text | extra image URLs after cover, newline-separated |
| 封面分析 | text | visual click trigger and promise |
| 互动诱因 | text | why users comment, save, or share |
| 爆款原因 | text | why the content's performance makes sense |
| 可复制点 | text | reusable title, cover, structure, and CTA tactics |

## Feishu Field JSON

Use number fields for engagement metrics.

```json
[
  {"name":"标题","type":"text"},
  {"name":"正文","type":"text"},
  {"name":"链接","type":"text","style":{"type":"url"}},
  {"name":"话题","type":"text"},
  {"name":"封面","type":"text","style":{"type":"url"}},
  {"name":"点赞","type":"number","style":{"type":"plain","precision":0,"thousands_separator":true}},
  {"name":"收藏","type":"number","style":{"type":"plain","precision":0,"thousands_separator":true}},
  {"name":"评论","type":"number","style":{"type":"plain","precision":0,"thousands_separator":true}},
  {"name":"转发","type":"number","style":{"type":"plain","precision":0,"thousands_separator":true}},
  {"name":"图片","type":"text"},
  {"name":"封面分析","type":"text"},
  {"name":"互动诱因","type":"text"},
  {"name":"爆款原因","type":"text"},
  {"name":"可复制点","type":"text"}
]
```

