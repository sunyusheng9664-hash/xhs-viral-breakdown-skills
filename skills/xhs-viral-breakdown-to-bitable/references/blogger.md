# 博主主页分析

只分析 `type=blogger_profile` 的记录。依据 `data` 中的公开主页资料、`visible_notes`、`top_visible_notes` 和实际查看到的主页画面填写 `analysis`；没有证据的字段留空并在 `data_limitations` 说明。

## 输出字段

```json
{
  "avatar_style": "头像主体、构图、色彩和识别度",
  "content_positioning": "账号主要解决什么问题或提供什么内容",
  "persona_tags": ["3-6个可观察的人设标签"],
  "audience_profile": "目标受众及其需求",
  "value_proposition": "关注该账号能持续获得什么",
  "differentiation": "相对同类账号的可观察差异",
  "note_count": "仅有公开总数证据时填写，否则留空",
  "update_frequency": "仅有时间样本时填写，否则留空",
  "topic_directions": ["主要选题方向"],
  "content_types": ["知识/经验/测评/记录等"],
  "content_formats": ["图文/视频/清单/教程等"],
  "high_frequency_keywords": ["公开样本中反复出现的词"],
  "common_topics": ["公开样本中可见的话题"],
  "publishing_times": "仅有发布时间样本时填写，否则留空",
  "content_style": "表达语气与内容气质",
  "cover_style": "封面布局和统一性",
  "cover_palette": "主要配色",
  "cover_font_style": "字体大小、粗细和层级；看不到文字时留空",
  "cover_elements": ["人物/商品/截图/大字等"],
  "title_patterns": "标题结构和常用钩子",
  "body_structure": "只有看过正文样本时填写",
  "opening_patterns": "只有看过正文或字幕样本时填写",
  "ending_patterns": "只有看过正文或字幕样本时填写",
  "top_posts": [
    {"title": "公开可见标题", "public_interaction_data": "公开点赞数或页面显示值"}
  ],
  "top_post_patterns": "前三条公开高点赞样本的共性；不足三条时说明样本数",
  "monetization": "仅记录公开可见的变现方式",
  "brand_content": "仅记录公开可见的品牌合作或品牌内容",
  "traffic_methods": "仅记录主页公开展示的引流方式",
  "reusable_elements": ["可复用的选题、结构或视觉元素"],
  "data_limitations": "明确写出未登录公开页、首屏样本数、缺失字段和不能确认的内容",
  "collection_status": "基础分析完成、完整分析完成或部分字段缺失",
  "homepage_screenshot_path": "/本机可读取的主页截图绝对路径，无法截图时为空"
}
```

## 判断规则

- `/m/` 只是分享短链形式，不能据此判断主页；以提取结果的 `type` 为准。
- `visible_note_count` 只是本次公开页首屏样本数，不等于账号作品总数。
- 高点赞样本只在当前公开样本内排序，不得写成账号历史全量 TOP3。
- 不填写 IP 属地、公开认证信息、账号等级或账号内部 ID。
- 不通过昵称关联笔记与博主，也不因为三条链接同批提交就默认属于同一作者。
- 未登录页面无法验证的数据必须留空，不能用行业常识补齐。
