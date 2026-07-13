"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";

type Status = "queued" | "processing" | "done" | "error";
type CompressResult = "ok" | "quota" | "error";

interface Item {
  id: string;
  file: File;
  name: string;
  path: string; // đường dẫn tương đối trong folder (nếu có), mặc định = tên file
  originalSize: number;
  previewUrl: string;
  status: Status;
  compressedSize?: number;
  blob?: Blob;
  outType?: string;
  error?: string;
}

// File kèm đường dẫn tương đối, dùng khi kéo folder / chọn folder.
interface IncomingFile {
  file: File;
  path: string;
}

interface KeyEntry {
  label: string;
  value: string; // "" = use the default key from the server's .env
  removable: boolean;
}

const CONCURRENCY = 4;
const ACCEPT = "image/png,image/jpeg,image/webp";
const IMG_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LS_KEYS = "tc_api_keys";
const LS_ACTIVE = "tc_active_key";

// Primary action button — signature violet → pink gradient
const BTN_PRIMARY =
  "rounded-lg bg-gradient-to-r from-violet-600 to-pink-500 text-white font-semibold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-fuchsia-500/30 hover:from-violet-700 hover:to-pink-600 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none";

// Danh sách API key có sẵn cho nội bộ — bấm để thêm nhanh.
// CẢNH BÁO: các key này nằm trong mã nguồn phía client và sẽ lộ nếu repo public.
const PRESET_KEYS: { label: string; value: string }[] = [
  { label: "Key nội bộ 1", value: "mCZ31zPsBZPJn03BRN7l8YB8h2JbMH9W" },
  // Thêm key khác tại đây, ví dụ:
  // { label: "Key nội bộ 2", value: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
];

const FORMATS = [
  { value: "", label: "Keep original format" },
  { value: "image/webp", label: "→ WebP" },
  { value: "image/png", label: "→ PNG" },
  { value: "image/jpeg", label: "→ JPEG" },
];

const RESIZE_METHODS = [
  { value: "", label: "No resize" },
  { value: "fit", label: "Fit (within bounds)" },
  { value: "scale", label: "Scale (single dimension)" },
  { value: "cover", label: "Cover (fill & crop)" },
  { value: "thumb", label: "Thumb (smart thumbnail)" },
];

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [convertTo, setConvertTo] = useState("");
  const [resizeMethod, setResizeMethod] = useState("");
  const [rw, setRw] = useState("");
  const [rh, setRh] = useState("");
  const [quality, setQuality] = useState(100); // 100 = giữ chất lượng tối đa (tắt re-encode)
  const [isDark, setIsDark] = useState(false);
  const [quota, setQuota] = useState<{ count: number; limit: number } | null>(
    null
  );
  const [dragId, setDragId] = useState<string | null>(null);

  const [userKeys, setUserKeys] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showKeys, setShowKeys] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [newKey, setNewKey] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const keyList: KeyEntry[] = useMemo(
    () => [
      { label: "Default (.env)", value: "", removable: false },
      ...userKeys.map((k) => ({
        label: maskKey(k),
        value: k,
        removable: true,
      })),
    ],
    [userKeys]
  );
  const keyListRef = useRef<KeyEntry[]>(keyList);
  keyListRef.current = keyList;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const activeKey = keyList[activeIndex]?.value ?? "";

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEYS) || "[]");
      if (Array.isArray(saved))
        setUserKeys(saved.filter((k) => typeof k === "string"));
      const ai = Number(localStorage.getItem(LS_ACTIVE));
      if (Number.isFinite(ai) && ai > 0) setActiveIndex(ai);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshQuota = useCallback(async (key: string) => {
    try {
      const res = await fetch("/api/compress", {
        headers: key ? { "x-api-key": key } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === "number") setQuota(data);
      } else {
        setQuota(null);
      }
    } catch {
      setQuota(null);
    }
  }, []);

  useEffect(() => {
    refreshQuota(activeKey);
  }, [activeKey, refreshQuota]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
  }, []);

  // Bật chế độ chọn cả thư mục cho input ẩn (thuộc tính không chuẩn của DOM).
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const persistKeys = (keys: string[]) => {
    setUserKeys(keys);
    localStorage.setItem(LS_KEYS, JSON.stringify(keys));
  };
  const selectKey = (idx: number) => {
    setActiveIndex(idx);
    localStorage.setItem(LS_ACTIVE, String(idx));
  };
  const addKey = () => {
    const k = newKey.trim();
    if (!k || userKeys.includes(k)) {
      setNewKey("");
      return;
    }
    const next = [...userKeys, k];
    persistKeys(next);
    setNewKey("");
    selectKey(next.length);
  };
  const removeKey = (value: string) => {
    const next = userKeys.filter((k) => k !== value);
    persistKeys(next);
    selectKey(0);
  };
  // Chọn nhanh một key có sẵn: thêm vào danh sách (nếu chưa có) rồi kích hoạt.
  const usePresetKey = (value: string) => {
    setShowPresets(false);
    const existing = userKeys.indexOf(value);
    if (existing >= 0) {
      selectKey(existing + 1); // +1 vì index 0 là "Default (.env)"
      return;
    }
    const next = [...userKeys, value];
    persistKeys(next);
    selectKey(next.length);
  };

  const update = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }, []);

  const addFiles = useCallback(
    (input: FileList | File[] | IncomingFile[]) => {
      // Chuẩn hóa về IncomingFile[] (có đường dẫn tương đối).
      const arr = Array.from(input as ArrayLike<File | IncomingFile>);
      const normalized: IncomingFile[] = arr.map((x) =>
        x instanceof File
          ? { file: x, path: x.webkitRelativePath || x.name }
          : (x as IncomingFile)
      );
      const incoming = normalized.filter((n) => IMG_TYPES.includes(n.file.type));
      if (!incoming.length) return;

      setItems((prev) => {
        // Tính năng 1: lọc trùng theo đường dẫn + kích thước (bỏ ảnh đã có).
        const seen = new Set(prev.map((it) => `${it.path}|${it.originalSize}`));
        const fresh: Item[] = [];
        for (const { file, path } of incoming) {
          const dupKey = `${path}|${file.size}`;
          if (seen.has(dupKey)) continue;
          seen.add(dupKey);
          fresh.push({
            id: `${path}-${file.size}-${crypto.randomUUID()}`,
            file,
            name: file.name,
            path,
            originalSize: file.size,
            previewUrl: URL.createObjectURL(file),
            status: "queued" as Status,
          });
        }
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    },
    []
  );

  const compressOne = useCallback(
    async (item: Item, key: string): Promise<CompressResult> => {
      update(item.id, { status: "processing", error: undefined });
      try {
        const fd = new FormData();
        fd.append("file", item.file);
        if (convertTo) fd.append("convertTo", convertTo);
        if (resizeMethod) {
          fd.append("resizeMethod", resizeMethod);
          if (rw) fd.append("resizeWidth", rw);
          if (rh) fd.append("resizeHeight", rh);
        }

        const res = await fetch("/api/compress", {
          method: "POST",
          body: fd,
          headers: key ? { "x-api-key": key } : undefined,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 402 || data.code === "account") {
            update(item.id, { status: "queued" });
            return "quota";
          }
          throw new Error(data.error || `Error ${res.status}`);
        }

        let blob = await res.blob();
        const outType = res.headers.get("X-Output-Type") || item.file.type;
        const count = Number(res.headers.get("X-Compression-Count"));
        const limit = Number(res.headers.get("X-Compression-Limit"));
        if (Number.isFinite(count) && count > 0) {
          setQuota({ count, limit: limit || 500 });
        }

        // Tính năng 4: re-encode phía client theo mức chất lượng đã chọn.
        // Chỉ áp dụng cho JPEG/WebP và khi quality < 100.
        if (
          quality < 100 &&
          (outType === "image/jpeg" || outType === "image/webp")
        ) {
          const re = await reencode(blob, outType, quality / 100).catch(
            () => null
          );
          if (re) blob = re;
        }

        update(item.id, {
          status: "done",
          compressedSize: blob.size,
          blob,
          outType,
        });
        return "ok";
      } catch (err) {
        update(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
        return "error";
      }
    },
    [convertTo, resizeMethod, rw, rh, quality, update]
  );

  const runQueue = useCallback(async () => {
    setRunning(true);
    const list = keyListRef.current;
    let keyIdx = activeIndexRef.current;
    let queue = itemsRef.current.filter((it) => it.status === "queued");

    while (queue.length && keyIdx < list.length) {
      const key = list[keyIdx].value;
      const work = queue;
      queue = [];
      let i = 0;
      let quotaHit = false;
      const requeue: Item[] = [];

      const worker = async () => {
        while (i < work.length && !quotaHit) {
          const it = work[i++];
          const r = await compressOne(it, key);
          if (r === "quota") {
            quotaHit = true;
            requeue.push(it);
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, work.length) }, worker)
      );

      if (quotaHit) {
        const remaining = work.slice(i);
        queue = [...requeue, ...remaining];
        keyIdx += 1;
        if (keyIdx < list.length) {
          selectKey(keyIdx);
        }
      } else {
        queue = [];
      }
    }

    if (queue.length) {
      const ids = new Set(queue.map((q) => q.id));
      setItems((prev) =>
        prev.map((it) =>
          ids.has(it.id)
            ? {
                ...it,
                status: "error",
                error: "All API keys have been tried but are out of quota.",
              }
            : it
        )
      );
    }

    setRunning(false);
  }, [compressOne]);

  const downloadOne = (item: Item) => {
    if (item.blob) triggerDownload(item.blob, outName(item));
  };

  const downloadAll = async () => {
    const done = items.filter((it) => it.status === "done" && it.blob);
    if (!done.length) return;
    const zip = new JSZip();
    const used = new Map<string, number>();
    for (const it of done) {
      const base = outName(it);
      const n = used.get(base) ?? 0;
      let name = base;
      if (n > 0) {
        const dot = base.lastIndexOf(".");
        name =
          dot > 0
            ? `${base.slice(0, dot)}-${n}${base.slice(dot)}`
            : `${base}-${n}`;
      }
      used.set(base, n + 1);
      zip.file(name, it.blob!);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, "tinycompress.zip");
  };

  const removeItem = (id: string) =>
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.id !== id);
    });

  const clearAll = () =>
    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return [];
    });

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === dragId);
      const to = prev.findIndex((i) => i.id === targetId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const stats = useMemo(() => {
    const done = items.filter((it) => it.status === "done");
    const original = done.reduce((s, it) => s + it.originalSize, 0);
    const compressed = done.reduce((s, it) => s + (it.compressedSize ?? 0), 0);
    const saved = original - compressed;
    const pct = original ? Math.round((saved / original) * 100) : 0;
    return { count: done.length, original, compressed, saved, pct };
  }, [items]);

  const queuedCount = items.filter((it) => it.status === "queued").length;
  const hasDone = items.some((it) => it.status === "done");
  const showResizeDims = resizeMethod !== "";
  const quotaNear = quota ? quota.count / quota.limit >= 0.8 : false;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex-1 text-center sm:pl-24">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="animate-gradient-x bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              TinyCompress
            </span>
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Smart PNG, JPEG & WebP compression. Unlimited number of images.
          </p>
        </div>
        <button
          onClick={toggleDark}
          className="rounded-lg border border-violet-200 bg-white/70 p-2 text-lg backdrop-blur transition hover:bg-violet-50 dark:border-violet-800/60 dark:bg-white/5 dark:hover:bg-white/10"
          aria-label="Toggle light/dark theme"
          title="Light / Dark"
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </header>

      {/* Quota + key management */}
      <div className="rounded-xl border border-violet-100 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-violet-900/50 dark:bg-white/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Quota — key:{" "}
            <b className="text-slate-700 dark:text-slate-200">
              {keyList[activeIndex]?.label ?? "—"}
            </b>
          </span>
          <div className="flex items-center gap-3">
            {quota ? (
              <span
                className={`font-semibold ${
                  quotaNear
                    ? "text-amber-600"
                    : "text-fuchsia-600 dark:text-fuchsia-400"
                }`}
              >
                {quota.count} / {quota.limit}
              </span>
            ) : (
              <span className="text-slate-400">invalid key</span>
            )}
            {PRESET_KEYS.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowPresets((v) => !v)}
                  className="rounded-md border border-fuchsia-300 px-2 py-1 text-xs font-medium text-fuchsia-700 transition hover:bg-fuchsia-50 dark:border-fuchsia-700/60 dark:text-fuchsia-300 dark:hover:bg-white/10"
                >
                  Chọn key ▾
                </button>
                {showPresets && (
                  <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-violet-200 bg-white shadow-lg dark:border-violet-800/60 dark:bg-slate-900">
                    {PRESET_KEYS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => usePresetKey(p.value)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-fuchsia-50 dark:hover:bg-white/10"
                      >
                        <span className="text-slate-700 dark:text-slate-200">
                          {p.label}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          {maskKey(p.value)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowKeys((v) => !v)}
              className="rounded-md border border-violet-200 px-2 py-1 text-xs text-violet-700 transition hover:bg-violet-50 dark:border-violet-800/60 dark:text-violet-300 dark:hover:bg-white/10"
            >
              {showKeys ? "Hide keys" : "Manage keys"}
            </button>
          </div>
        </div>

        {quota && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                quotaNear
                  ? "bg-amber-500"
                  : "animate-gradient-x bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round((quota.count / quota.limit) * 100)
                )}%`,
              }}
            />
          </div>
        )}

        {showKeys && (
          <div className="mt-4 space-y-2 border-t border-violet-100 pt-3 dark:border-violet-900/50">
            <p className="text-xs text-slate-400">
              When a key runs out of quota, the system automatically switches to
              the next one. The 500 conversions/month limit is counted per{" "}
              <b>account</b> — use keys from different accounts to stack quota.
              Keys are stored in your browser.
            </p>
            {keyList.map((k, idx) => (
              <div
                key={k.value || "default"}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  idx === activeIndex
                    ? "border-fuchsia-400 bg-fuchsia-50 dark:border-fuchsia-500/60 dark:bg-fuchsia-950/30"
                    : "border-violet-100 dark:border-violet-900/50"
                }`}
              >
                <button
                  onClick={() => selectKey(idx)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={`h-3 w-3 rounded-full border ${
                      idx === activeIndex
                        ? "border-transparent bg-gradient-to-r from-violet-600 to-pink-500"
                        : "border-violet-300 dark:border-violet-600"
                    }`}
                  />
                  <span className="font-mono text-slate-700 dark:text-slate-200">
                    {k.label}
                  </span>
                  {idx === activeIndex && (
                    <span className="text-xs text-fuchsia-600 dark:text-fuchsia-400">
                      in use
                    </span>
                  )}
                </button>
                {k.removable && (
                  <button
                    onClick={() => removeKey(k.value)}
                    className="text-slate-300 hover:text-red-400"
                    aria-label="Remove key"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKey()}
                placeholder="Paste a new API key…"
                className="flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400 dark:border-violet-900/50 dark:bg-slate-900"
              />
              <button onClick={addKey} className={`${BTN_PRIMARY} px-3 py-2 text-sm`}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          const files = await collectFilesFromDrop(e.dataTransfer);
          addFiles(files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-5 cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition duration-300 ${
          dragOver
            ? "scale-[1.02] border-fuchsia-400 bg-fuchsia-50 shadow-lg shadow-fuchsia-500/20 dark:border-fuchsia-500 dark:bg-fuchsia-950/30"
            : "border-violet-200 bg-white/70 hover:border-fuchsia-300 hover:shadow-md dark:border-violet-800/60 dark:bg-white/5 dark:hover:border-fuchsia-500/70"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className={`text-5xl ${dragOver ? "animate-pop" : "animate-float"}`}>
          🎵
        </div>
        <p className="mt-3 text-lg font-medium text-slate-700 dark:text-slate-200">
          Drag & drop images or a whole folder here
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          click to select files — PNG, JPEG, WebP (max 30MB per image)
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            folderInputRef.current?.click();
          }}
          className="mt-3 rounded-lg border border-violet-300 bg-white/70 px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:-translate-y-0.5 hover:bg-violet-50 dark:border-violet-700 dark:bg-white/5 dark:text-violet-200 dark:hover:bg-white/10"
        >
          📁 Select a folder
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Select value={convertTo} onChange={setConvertTo} options={FORMATS} />
        <Select
          value={resizeMethod}
          onChange={setResizeMethod}
          options={RESIZE_METHODS}
        />
        {showResizeDims && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              placeholder="Width"
              value={rw}
              onChange={(e) => setRw(e.target.value)}
              className="w-20 rounded-lg border border-violet-200 bg-white px-2 py-2 text-sm outline-none focus:border-fuchsia-400 dark:border-violet-900/50 dark:bg-slate-900"
            />
            <span className="text-slate-400">×</span>
            <input
              type="number"
              min={1}
              placeholder="Height"
              value={rh}
              onChange={(e) => setRh(e.target.value)}
              className="w-20 rounded-lg border border-violet-200 bg-white px-2 py-2 text-sm outline-none focus:border-fuchsia-400 dark:border-violet-900/50 dark:bg-slate-900"
            />
            <span className="text-xs text-slate-400">px</span>
          </div>
        )}

        {/* Tính năng 4: mức chất lượng (chỉ áp dụng cho JPEG/WebP) */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500 dark:text-slate-400">
            Quality
          </label>
          <input
            type="range"
            min={40}
            max={100}
            step={5}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="accent-fuchsia-500"
            title="Chỉ áp dụng cho JPEG/WebP. 100 = giữ nguyên chất lượng tối đa."
          />
          <span className="w-14 text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-400">
            {quality === 100 ? "Max" : `${quality}%`}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Quality chỉ áp dụng cho JPEG/WebP (nén lại phía trình duyệt). PNG bỏ qua
        tùy chọn này.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={runQueue}
          disabled={running || queuedCount === 0}
          className={`${BTN_PRIMARY} px-4 py-2 text-sm`}
        >
          {running ? "Compressing…" : `Compress ${queuedCount || ""} image${queuedCount === 1 ? "" : "s"}`}
        </button>
        <button
          onClick={downloadAll}
          disabled={!hasDone}
          className="rounded-lg border border-violet-300 bg-white/70 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-violet-700 dark:bg-white/5 dark:text-violet-200 dark:hover:bg-white/10"
        >
          Download all (.zip)
        </button>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="ml-auto rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Clear all
          </button>
        )}
      </div>

      {stats.count > 0 && (
        <div className="animate-fade-in mt-6 rounded-xl border border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 to-violet-50 p-4 text-center text-sm text-violet-800 dark:border-fuchsia-900/40 dark:from-fuchsia-950/30 dark:to-violet-950/30 dark:text-fuchsia-200">
          Compressed <b>{stats.count}</b> image{stats.count === 1 ? "" : "s"} — from{" "}
          <b>{formatBytes(stats.original)}</b> down to{" "}
          <b>{formatBytes(stats.compressed)}</b>, saving{" "}
          <b className="text-fuchsia-600 dark:text-fuchsia-400">{stats.pct}%</b>{" "}
          ({formatBytes(stats.saved)}).
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {items.map((it) => (
          <li
            key={it.id}
            draggable
            onDragStart={() => setDragId(it.id)}
            onDragEnter={() => reorder(it.id)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => setDragId(null)}
            className={`animate-slide-up flex items-center gap-3 rounded-xl border bg-white/80 p-3 shadow-sm backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-white/5 ${
              dragId === it.id
                ? "scale-[1.01] border-fuchsia-400 opacity-70 shadow-lg"
                : "border-violet-100 dark:border-violet-900/50"
            }`}
          >
            <span
              className="cursor-grab select-none px-1 text-violet-300 active:cursor-grabbing dark:text-violet-700"
              title="Drag to reorder"
            >
              ⠿
            </span>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.previewUrl}
              alt={it.name}
              className="h-12 w-12 flex-shrink-0 rounded-lg border border-violet-100 object-cover dark:border-violet-900/50"
            />

            <div className="min-w-0 flex-1">
              {dirOf(it.path) && (
                <p
                  className="truncate text-xs text-violet-500 dark:text-violet-400"
                  title={it.path}
                >
                  📁 {dirOf(it.path)}
                </p>
              )}
              <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                {it.name}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {formatBytes(it.originalSize)}
                {it.status === "done" && it.compressedSize != null && (
                  <>
                    {" → "}
                    <span className="text-fuchsia-600 dark:text-fuchsia-400">
                      {formatBytes(it.compressedSize)}
                    </span>{" "}
                    <span className="font-semibold text-fuchsia-600 dark:text-fuchsia-400">
                      (-{savedPct(it.originalSize, it.compressedSize)}%)
                    </span>
                  </>
                )}
                {it.status === "error" && (
                  <span className="text-red-500"> — {it.error}</span>
                )}
              </p>
            </div>

            <StatusBadge status={it.status} />

            {it.status === "done" && (
              <button
                onClick={() => downloadOne(it)}
                className="animate-fade-in rounded-lg border border-fuchsia-400 px-3 py-1.5 text-sm font-medium text-fuchsia-600 transition hover:-translate-y-0.5 hover:bg-fuchsia-50 active:scale-95 dark:text-fuchsia-400 dark:hover:bg-fuchsia-950/40"
              >
                Download
              </button>
            )}
            <button
              onClick={() => removeItem(it.id)}
              className="text-slate-300 hover:text-red-400"
              aria-label="Remove"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400 dark:border-violet-900/50 dark:bg-slate-900 dark:text-slate-100"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    queued: {
      label: "Queued",
      cls: "bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300",
    },
    processing: {
      label: "Compressing…",
      cls: "bg-fuchsia-100 text-fuchsia-700 animate-pulse dark:bg-fuchsia-950/50 dark:text-fuchsia-300",
    },
    done: {
      label: "Done",
      cls: "animate-pop bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-sm shadow-fuchsia-500/40",
    },
    error: {
      label: "Error",
      cls: "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300",
    },
  };
  const { label, cls } = map[status];
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// Mã hóa lại ảnh ở mức chất lượng cho trước (0..1) qua canvas — cho JPEG/WebP.
async function reencode(
  blob: Blob,
  type: string,
  quality: number
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || blob), type, quality);
  });
}

// Lấy toàn bộ file từ thao tác kéo-thả, duyệt đệ quy nếu là folder.
async function collectFilesFromDrop(dt: DataTransfer): Promise<IncomingFile[]> {
  const items = dt.items;
  // Grab entries synchronously (bắt buộc, vì dataTransfer bị vô hiệu sau await)
  if (
    items &&
    items.length &&
    typeof items[0].webkitGetAsEntry === "function"
  ) {
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    if (entries.length) {
      const out: IncomingFile[] = [];
      await Promise.all(entries.map((en) => traverseEntry(en, out)));
      return out;
    }
  }
  // Fallback: trình duyệt không hỗ trợ entry API
  return Array.from(dt.files).map((f) => ({ file: f, path: f.name }));
}

// Duyệt đệ quy 1 entry (file hoặc thư mục) và gom file vào `out`.
// Đường dẫn lấy từ entry.fullPath (bỏ dấu "/" đầu) để giữ cấu trúc folder.
function traverseEntry(entry: FileSystemEntry, out: IncomingFile[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        (file) => {
          out.push({ file, path: entry.fullPath.replace(/^\//, "") || file.name });
          resolve();
        },
        () => resolve()
      );
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const collected: FileSystemEntry[] = [];
      // readEntries trả về theo lô, phải gọi lặp tới khi rỗng.
      const readBatch = () => {
        reader.readEntries(
          (batch) => {
            if (!batch.length) {
              Promise.all(collected.map((e) => traverseEntry(e, out))).then(
                () => resolve()
              );
            } else {
              collected.push(...batch);
              readBatch();
            }
          },
          () => resolve()
        );
      };
      readBatch();
    } else {
      resolve();
    }
  });
}

// Lấy phần thư mục của đường dẫn tương đối (rỗng nếu file nằm ở gốc).
function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "";
}

function maskKey(k: string): string {
  if (k.length <= 6) return "••••";
  return `${k.slice(0, 3)}••••${k.slice(-4)}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function outName(item: Item): string {
  const base = item.name.replace(/\.[^.]+$/, "");
  return `${base}.${extFor(item.outType || item.file.type)}`;
}

function extFor(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  return "img";
}

function savedPct(orig: number, comp: number): number {
  if (!orig) return 0;
  return Math.max(0, Math.round(((orig - comp) / orig) * 100));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}
