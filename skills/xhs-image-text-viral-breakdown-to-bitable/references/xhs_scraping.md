# Xiaohongshu Image-Text Scraping Notes

## Fetch Order

1. Use the user's original URL.
2. Follow redirects and save the final URL.
3. Extract note id from `/explore/{id}` or `/discovery/item/{id}`.
4. Extract `window.__INITIAL_STATE__`.
5. If state is missing or empty, retry with a mobile user agent.
6. If still missing, mark the link failed.

## State Parsing

The state may contain JavaScript-only values. Before JSON parse, replace clear `:undefined` occurrences with `:null`.

Do not hardcode only:

```text
state.note.noteDetailMap[noteId].note
```

Different share pages can use different nesting. Recursively search for an object matching the note id and containing fields such as `title`, `desc`, `imageList`, and `interactInfo`.

## Normalized Fields

Extract when available:

- note id
- title
- desc
- user nickname
- tag list
- image list
- liked count
- collected count
- comment count
- share count
- publish time
- update time
- ip location

Image choice:

- cover = `imageList[0].urlDefault` or equivalent best URL
- extra images = all images after cover

Normalize escaped URLs and prefer `https://` when safe.

## Failure Rules

Never invent fields. For a failed link, preserve:

- original URL
- final URL if available
- failure stage
- failure reason

