# Video Bitable Fields

Use these v1 fields in order.

| Field | Type | Rule |
|---|---|---|
| 标题 | text | Xiaohongshu title |
| 链接 | text url | original user-provided share link |
| 封面 | text url | cover image URL |
| 作者 | text | author nickname |
| 视频时长 | text | seconds or human-readable duration |
| 点赞数 | number | integer |
| 收藏数 | number | integer |
| 评论数 | number | integer |
| 分享数 | number | integer |
| 正文 | text | Xiaohongshu note description or topics |
| 口播文案（原始字幕） | text | corrected full subtitle transcript |
| 爆款拆解 | text | 150-200 Chinese characters preferred |
| 可复制部分 | text | 150-200 Chinese characters preferred |

## Feishu Field JSON

```json
[
  {"name":"标题","type":"text"},
  {"name":"链接","type":"text","style":{"type":"url"}},
  {"name":"封面","type":"text","style":{"type":"url"}},
  {"name":"作者","type":"text"},
  {"name":"视频时长","type":"text"},
  {"name":"点赞数","type":"number","style":{"type":"plain","precision":0,"thousands_separator":true}},
  {"name":"收藏数","type":"number","style":{"type":"plain","precision":0,"thousands_separator":true}},
  {"name":"评论数","type":"number","style":{"type":"plain","precision":0,"thousands_separator":true}},
  {"name":"分享数","type":"number","style":{"type":"plain","precision":0,"thousands_separator":true}},
  {"name":"正文","type":"text"},
  {"name":"口播文案（原始字幕）","type":"text"},
  {"name":"爆款拆解","type":"text"},
  {"name":"可复制部分","type":"text"}
]
```

