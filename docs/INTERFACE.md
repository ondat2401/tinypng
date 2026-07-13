# TinyCompress — Interface Guide

A quick reference to every control in the TinyCompress web UI.

## Layout overview

```
┌───────────────────────────────────────────────┐
│  TinyCompress            [🌙 / ☀️ theme toggle] │
├───────────────────────────────────────────────┤
│  Quota bar   [Select key ▾] [Manage keys]      │
│  ▓▓▓▓▓▓▓░░░░  123 / 500                          │
├───────────────────────────────────────────────┤
│              Drag & drop images or a            │
│                  whole folder here              │
│              [📁 Select a folder]               │
├───────────────────────────────────────────────┤
│  [Format ▾] [Resize ▾] [W]×[H] Quality ──●  85%│
├───────────────────────────────────────────────┤
│  [Compress N images] [Download all (.zip)]     │
├───────────────────────────────────────────────┤
│  ⠿ 📁 sub/folder                                │
│    image.png   1.2 MB → 340 KB (-72%)  [✓ Done] │
└───────────────────────────────────────────────┘
```

## Top bar

| Control | Description |
| --- | --- |
| **Theme toggle** (🌙 / ☀️) | Switch between light and dark mode. The choice is remembered. |
| **Quota bar** | Shows how many compressions the active key has used this month (`used / 500`). Turns amber when near the limit. |
| **Select key ▾** | Opens a dropdown of preset (built-in) API keys. Click one to add and activate it instantly. |
| **Manage keys** | Expands the key manager to add, switch, or remove API keys. |

## Adding images

- **Drag & drop** one or many image files onto the drop zone.
- **Drag a whole folder** — the app recursively scans it (including sub-folders) and imports every PNG / JPEG / WebP inside.
- **📁 Select a folder** — opens a folder picker (same recursive import) for browsers where dragging a folder is limited.
- **Click the drop zone** — opens a normal multi-file picker.
- **Duplicate filter** — an image with the same relative path + size as one already in the list is skipped automatically.
- Each image row shows its **relative folder path** (📁 prefix) above the file name when it came from a folder.

## Processing options

| Control | Description |
| --- | --- |
| **Format** | Keep original, or convert to WebP / PNG / JPEG. |
| **Resize** | None, Fit, Scale, Cover, or Thumb. Choosing a method reveals Width/Height inputs (px). |
| **Quality** | Slider 40–100 %. `Max` (100) leaves the image untouched. **Applies to JPEG/WebP only** — the compressed image is re-encoded in the browser at the chosen quality. PNG ignores it. |

## Actions

| Button | Description |
| --- | --- |
| **Compress N images** | Runs the queue (4 images in parallel). Auto-rotates to the next key when one runs out of quota. |
| **Download all (.zip)** | Bundles every finished image into a single ZIP. |
| **Clear all** | Removes all items from the list. |
| Per-row **Download** | Saves a single finished image. |
| Per-row **✕** | Removes that item. |
| **⠿ drag handle** | Reorder items by dragging. |

## Key manager (Manage keys)

- Lists every key: `Default (.env)` plus any keys you added.
- The **active key** is highlighted and marked *in use*.
- Paste a new key in the input and press **Add** (or Enter).
- Keys are stored in the browser's `localStorage`.
- When the active key hits its monthly limit, the app **automatically switches to the next key** and continues. Use keys from different accounts to stack quota.

## Status badges

| Badge | Meaning |
| --- | --- |
| **Queued** | Waiting to be processed. |
| **Compressing…** | Currently being sent to the API. |
| **Done** | Finished; download available. |
| **Error** | Failed (reason shown next to the file name). |
