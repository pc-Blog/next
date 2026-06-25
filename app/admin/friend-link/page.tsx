"use client";

import { useState, useEffect, useCallback } from "react";
import type { FriendLink } from "@/lib/types";
import { getList, create, update, remove } from "@/lib/api/friend-link";
import Tooltip from "@/app/_components/common/Tooltip";
import Dialog from "@/app/_components/common/Dialog";
import Pagination from "@/app/_components/common/Pagination";
import { showSuccessToast } from "@/lib/toast";
import { useConfirm } from "@/app/_components/common/ConfirmDialog";

function hexToRgb(hex: string) {
  const c = hex.replace("#", "");
  if (c.length !== 6 && c.length !== 3) return null;
  const full = c.length === 3 ? c[0] + c[0] + c[1] + c[1] + c[2] + c[2] : c;
  const n = parseInt(full, 16);
  if (isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

function parseRgba(val: string) {
  const m = val.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: +m[4] };
  if (val.startsWith("#")) { const c = hexToRgb(val); if (c) return { ...c, a: 1 }; }
  return null;
}

const PRESET_COLORS = ["#6366f1", "#8b5cf6", "#a18cd1", "#fbc2eb", "#f43f5e", "#06b6d4"];

export default function AdminFriendLinkPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [items, setItems] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("");
  const [themeColor, setThemeColor] = useState("");
  const [colorHex, setColorHex] = useState("#6366f1");
  const [opacity, setOpacity] = useState(0.5);
  const [sortOrder, setSortOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(1);
  const [rss, setRss] = useState("");
  const [email, setEmail] = useState("");

  const refresh = useCallback(async (kw?: string, pn?: number, ps?: number) => {
    try {
      const d = await getList(kw || undefined, pn, ps);
      setItems(d.rows);
      setTotal(d.total);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    setPageNum(1);
    const timer = setTimeout(() => refresh(keyword || undefined, 1, pageSize), 300);
    return () => clearTimeout(timer);
  }, [keyword, refresh, pageSize]);

  const openAdd = () => {
    setEditingId(null);
    setName("");
    setUrl("");
    setDescription("");
    setAvatar("");
    setThemeColor("rgba(99,102,241,0.5)");
    setColorHex("#6366f1");
    setOpacity(0.5);
    setSortOrder(0);
    setIsPublished(1);
    setRss("");
    setEmail("");
    setDialogOpen(true);
  };

  const openEdit = (f: FriendLink) => {
    setEditingId(f.id!);
    setName(f.name);
    setUrl(f.url);
    setDescription(f.description || "");
    setAvatar(f.avatar || "");
    const initC = parseRgba(f.themeColor || "rgba(99,102,241,0.5)");
    setThemeColor(f.themeColor || "rgba(99,102,241,0.5)");
    setColorHex(initC ? rgbToHex(initC.r, initC.g, initC.b) : "#6366f1");
    setOpacity(initC?.a ?? 0.5);
    setSortOrder(f.sortOrder ?? 0);
    setIsPublished(f.isPublished ?? 1);
    setRss(f.rss || "");
    setEmail(f.email || "");
    setDialogOpen(true);
  };

  const handleColorPick = (hex: string) => {
    setColorHex(hex);
    const rgb = hexToRgb(hex);
    if (rgb) setThemeColor(`rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`);
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    const rgb = hexToRgb(colorHex);
    if (rgb) setThemeColor(`rgba(${rgb.r},${rgb.g},${rgb.b},${val})`);
  };

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) return;
    const data: FriendLink = {
      name: name.trim(),
      url: url.trim(),
      description: description.trim() || undefined,
      avatar: avatar.trim() || undefined,
      rss: rss.trim() || undefined,
      email: email.trim() || undefined,
      themeColor: themeColor || undefined,
      sortOrder,
      isPublished,
    };
    if (editingId) {
      await update({ id: editingId, ...data });
      showSuccessToast("Updated");
    } else {
      await create(data);
      showSuccessToast("Created");
    }
    setDialogOpen(false);
    refresh(keyword || undefined, pageNum, pageSize);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm("Delete this friend link?"); if (!ok) return;
    await remove(id);
    showSuccessToast("Deleted");
    refresh(keyword || undefined, pageNum, pageSize);
  };

  const handleTogglePublish = async (f: FriendLink) => {
    await update({ id: f.id, ...f, isPublished: f.isPublished ? 0 : 1 });
    showSuccessToast(f.isPublished ? "Hidden" : "Published");
    refresh(keyword || undefined, pageNum, pageSize);
  };

  if (loading) return <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-10" />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Friend Links</h1>

      {/* Search + Add */}
      <div className="flex gap-3 mb-6">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search friend links..."
          className="glass-card !rounded-xl px-4 py-2.5 flex-1 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
        />
        <button onClick={openAdd} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">
          Add Friend
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto flex flex-col gap-2">
        {items.map((f) => (
          <div key={f.id} className="glass-card px-4 py-3 flex items-center gap-4 group">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-[2px] flex-shrink-0 overflow-hidden">
              <img src={f.avatar || "/bg/1.jpg"} alt={`${f.name} 头像`} className="w-full h-full rounded-full object-cover bg-white dark:bg-slate-900"
                onError={(e) => { (e.target as HTMLImageElement).src = "/bg/1.jpg"; }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{f.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.isPublished ? "bg-green-50 dark:bg-green-900/30 text-green-600" : "bg-slate-100 dark:bg-slate-700 text-slate-400"}`}>
                  {f.isPublished ? "Published" : "Hidden"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{f.url}</p>
              {f.description && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{f.description}</p>
              )}
              <div className="flex gap-2 mt-0.5">
                {f.rss && <span className="text-[10px] text-orange-500 font-bold">RSS</span>}
                {f.email && <span className="text-[10px] text-blue-500 font-bold">Email</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Tooltip text={f.isPublished ? "Hide" : "Publish"}>
                <button onClick={() => handleTogglePublish(f)} className="p-1 text-slate-400 hover:text-indigo-500 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {f.isPublished
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    }
                  </svg>
                </button>
              </Tooltip>
              <Tooltip text="Edit">
                <button onClick={() => openEdit(f)} className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </Tooltip>
              <Tooltip text="Delete">
                <button onClick={() => handleDelete(f.id!)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      <Pagination total={total} pageNum={pageNum} pageSize={pageSize} onChange={(pn) => { setPageNum(pn); refresh(keyword || undefined, pn, pageSize); }} onPageSizeChange={(ps) => { setPageSize(ps); setPageNum(1); refresh(keyword || undefined, 1, ps); }} />

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? "Edit Friend Link" : "Add Friend Link"}>
        <div className="flex flex-col gap-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Site name *" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Site URL * (https://...)" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="Avatar URL" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input value={rss} onChange={(e) => setRss(e.target.value)} placeholder="RSS URL (optional)" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          {/* Color picker */}
          <div className="glass-card !rounded-xl p-3 space-y-3 bg-white/50 dark:bg-slate-800/50">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Theme Color</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Preset swatches */}
              {PRESET_COLORS.map((c) => (
                <button key={c} onClick={() => handleColorPick(c)}
                  className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110 flex-shrink-0"
                  style={{
                    backgroundColor: c,
                    borderColor: colorHex === c ? "#6366f1" : "transparent",
                    boxShadow: colorHex === c ? "0 0 0 2px rgba(99,102,241,0.25)" : "none",
                  }}
                />
              ))}
              {/* Custom color picker */}
              <label className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/20 cursor-pointer hover:bg-white/30 dark:hover:bg-white/20 transition-colors flex-shrink-0 ml-1">
                <input type="color" value={colorHex} onChange={(e) => handleColorPick(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: colorHex }} />
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{colorHex}</span>
              </label>
            </div>
            {/* Opacity slider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400 w-10">Opacity</span>
              <input type="range" min="0" max="100" value={Math.round(opacity * 100)}
                onChange={(e) => handleOpacityChange(Number(e.target.value) / 100)}
                className="flex-1 accent-indigo-500 h-1 rounded-full cursor-pointer" />
              <span className="text-[10px] text-slate-400 w-7 text-right tabular-nums">{Math.round(opacity * 100)}%</span>
            </div>
            {/* Preview */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/20 dark:border-white/10">
              <div className="w-5 h-5 rounded border border-white/20" style={{ backgroundColor: themeColor || "transparent" }} />
              <code className="text-[10px] text-slate-400 font-mono">{themeColor}</code>
            </div>
          </div>
          <div className="flex gap-3">
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} placeholder="Sort order" className="w-24 glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={isPublished === 1} onChange={(e) => setIsPublished(e.target.checked ? 1 : 0)} className="rounded" />
              Published
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">Save</button>
        </div>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
