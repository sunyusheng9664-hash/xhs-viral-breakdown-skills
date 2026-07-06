# 图文分析与字段

只处理 `type=image_text` 的记录。

## analysis 对象

```json
{
  "body_summary": "正文结构化摘要",
  "cover_analysis": "封面分析",
  "interaction_drivers": "互动诱因",
  "viral_reasons": "爆款原因",
  "reusable_tactics": "可复制点"
}
```

## 分析要求

- `body_summary`：概括主题、痛点、展开方式和承诺结果，不复制完整原文。
- `cover_analysis`：仅根据实际检查过的封面或页面明确暴露的信息分析视觉类型、主标题和点击诱因。
- `interaction_drivers`：说明评论、收藏、转发分别可能由什么具体机制触发。
- `viral_reasons`：从选题、封面承诺、正文结构和行动价值解释，避免“标题吸引人”式空话。
- `reusable_tactics`：抽象标题结构、封面结构、正文组织和结尾动作，不复述或洗稿原文。

如果没有实际检查封面，`cover_analysis` 必须说明分析仅基于标题、正文和封面 URL，不能描述具体颜色、排版或画面元素。

## 飞书字段顺序

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
封面分析
互动诱因
爆款原因
可复制点
```

其中点赞、收藏、评论、转发为数字；图片为封面之后的图片 URL，以换行分隔。
