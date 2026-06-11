# Xiaohongshu Video Scraping Notes

## Fetch Order

1. Use the user's original URL.
2. Follow redirects and save the final URL.
3. Extract note id from `/explore/{id}` or `/discovery/item/{id}`.
4. Extract `window.__INITIAL_STATE__`.
5. If state is missing or empty, retry with a mobile user agent.
6. If still missing, mark the link failed.

## mediaV2

`mediaV2` may be stored as an escaped JSON string, not a normal object.

Parsing pattern:

1. Locate the `mediaV2` value.
2. Decode the outer JSON string.
3. Parse the inner JSON.

Look for:

- `stream.h264[].master_url`
- subtitle URLs under `video.subtitles`
- `duration`
- `width`
- `height`

## Subtitles

Prefer source Chinese subtitles when available. Common keys include:

- `source`
- `zh-CN`
- `en-US`

Download subtitles with:

```text
User-Agent: normal desktop browser UA
Referer: https://www.xiaohongshu.com/
```

If subtitle download fails, retry once with the final note URL as referer.

## Failure Rules

No subtitle is not a total failure. Continue with metadata and mark transcript as `未获取字幕`.

Preserve:

- original URL
- final URL
- note id
- whether mediaV2 was found
- whether subtitles were found
- failure reason

