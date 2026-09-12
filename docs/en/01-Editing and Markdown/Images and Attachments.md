---
title: Images and Attachments
lang: en
translationKey: images-attachments
---

# Images and Attachments

**中文:** [[图片与附件|中文]] · [[Markdown Syntax]] · [[Settings Overview]]

Images are part of reading and Publish — but storage plumbing is still maturing. This page separates **what works today** from **what the Images settings preview**.

## Ways to put an image in a note

### 1. Markdown image syntax

```markdown
![Alt text](assets/diagram.png)
![Alt text](https://example.com/pic.png)
```

Relative paths are resolved from the note (and survive Publish best when assets live inside the library).

### 2. Wikilink image embed

If the file is reachable via the link index:

```markdown
![[photo.png]]
```

Supported common types include png, jpeg, gif, webp, svg (and similar). The editor renders an image embed; notes use a card embed instead — see [[Wikilinks and Embeds]].

### 3. Empty image mark + file picker

Inserting an empty `![]()` image mark can open a file picker. Today this may insert a **blob URL** for preview — convenient locally, **not** a durable library path. Prefer copying the file into your vault and linking by relative path or `![[name]]` when you care about Publish or backups.

## Images settings (honest status)

**Settings → Images** exposes:

| Option | Intent |
| --- | --- |
| Storage mode | `library-assets` vs a fixed absolute folder |
| Filename format | original / timestamp / both |
| Auto-create assets dir | Create an assets folder under the library |
| Fixed directory path | Absolute path when using fixed mode |

> [!WARNING]
> These options are **persisted in settings**, but the paste/drop → disk pipeline is **not fully wired** yet. Do not rely on “paste screenshot and it lands in `assets/`” as a finished workflow. Track progress in [[Roadmap]].

**Practical recommendation until paste-to-disk ships:**

1. Keep an `assets/` (or per-note) folder inside the library.
2. Drop or save image files there with your OS / Finder / Explorer.
3. Reference them with `![](assets/…)` or `![[filename.png]]`.

## What the file tree shows

The Files sidebar lists **Markdown** notes (`.md` / `.markdown` / `.mdown`). Image files can still be embedded when the link index resolves them, but they are not managed as first-class tree rows today. Organize assets in folders on disk; open notes to edit.

## Publish behavior

- Notes and linked assets under the library are candidates for the static build.
- Skipped directories include `.git`, `.obsidian`, `.inimark`, `node_modules`, and the Publish `out` folder (usually `dist`).
- Prefer **in-library relative paths** so `baseHref` deployment does not break images.

See [[Publish a Site]].

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| Image missing in editor | Check path spelling; try `![[basename]]` if the file is in the library |
| Works locally, broken on site | Wrong `baseHref`, or file outside the vault / excluded folder |
| Paste does nothing useful | Expected for binary paste today — save the file manually |
| Blob URL note looks fine until restart | Replace with a vault-relative path |

More help: [[FAQ and Troubleshooting]].

---

Related: [[Markdown Syntax]] · [[Wikilinks and Embeds]] · [[Data Directory]]
