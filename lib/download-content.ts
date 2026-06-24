"use client";

/**
 * Download article/project content as a ZIP (markdown + images)
 */

import { assetUrl } from "@/lib/asset-url";

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function extractImageUrls(markdown: string): string[] {
  const urls: string[] = [];
  const regex = /!\[.*?\]\((.*?)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

export interface DownloadResult {
  title: string;
  imageTotal: number;
  imageSuccess: number;
  imageFailed: number;
}

function buildFooter(about?: Record<string, string>): string {
  if (!about) return "";

  const lines: string[] = ["\n\n---\n"];

  const blog = about["blog"];
  if (blog) {
    lines.push(`📝 本文发布于 [栏轩阁](${blog})\n`);
  }

  const links: { key: string; label: string }[] = [
    { key: "cnblogs", label: "博客园" },
    { key: "juejin", label: "掘金" },
    { key: "csdn", label: "CSDN" },
    { key: "github", label: "GitHub" },
    { key: "gitee", label: "Gitee" },
  ];

  const existing = links.filter((l) => about[l.key]);
  if (existing.length > 0) {
    lines.push("\n🌐 欢迎关注我的其他平台：\n");
    for (const l of existing) {
      lines.push(`- [${l.label}](${about[l.key]})`);
    }
  }

  const email = about["email"];
  if (email) {
    lines.push(`\n📧 联系我：${email}`);
  }

  return lines.join("\n");
}

/** Download only the markdown content (images stay as remote references) */
export function downloadMarkdown(params: {
  title: string;
  content: string;
  about?: Record<string, string>;
  origin?: string;
}) {
  const { title, about } = params;
  let { content } = params;
  const safeName = title.replace(/[<>:"/\\|?*]/g, "_");

  // Convert relative image URLs to absolute so they work offline
  if (params.origin) {
    content = content.replace(/!\[([^\]]*)\]\((\/[^)]+)\)/g, (_, alt, url) => {
      return `![${alt}](${params.origin!}${assetUrl(url)})`;
    });
  }

  const blob = new Blob([content + buildFooter(about)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadContentAsZip(params: {
  title: string;
  content: string;
  coverImage?: string;
  about?: Record<string, string>;
}): Promise<DownloadResult> {
  const { title, content, coverImage, about } = params;

  // Collect all image URLs (deduplicated)
  const imageUrls = new Set(extractImageUrls(content));
  if (coverImage) imageUrls.add(coverImage);

  // Download images in parallel, tolerant of failures
  const results = await Promise.allSettled(
    [...imageUrls].map(async (url) => {
      const base64 = await fetchImageAsBase64(assetUrl(url));
      return { url, base64 };
    })
  );

  // Build URL -> local filename mapping from successful downloads
  const urlToFilename = new Map<string, string>();
  const seen = new Set<string>();
  for (const result of results) {
    if (result.status === "fulfilled") {
      const filename = result.value.url.split("/").pop() || "image";
      const deduped = seen.has(filename) ? `${seen.size}-${filename}` : filename;
      seen.add(filename);
      urlToFilename.set(result.value.url, deduped);
    }
  }

  // Replace image URLs in content with local media/ references
  let finalContent = content;
  for (const [url, filename] of urlToFilename) {
    finalContent = finalContent.replaceAll(url, `media/${filename}`);
  }

  // Create ZIP
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // Add markdown file with updated local paths (content + footer)
  const safeName = title.replace(/[<>:"/\\|?*]/g, "_");
  zip.file(`${safeName}.md`, finalContent + buildFooter(about));

  // Add images
  for (const [url, filename] of urlToFilename) {
    const result = results.find(r => r.status === "fulfilled" && r.value.url === url);
    if (result && result.status === "fulfilled") {
      zip.file(`media/${filename}`, result.value.base64, { base64: true });
    }
  }

  // Trigger download
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}.zip`;
  link.click();
  URL.revokeObjectURL(url);

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  return {
    title,
    imageTotal: imageUrls.size,
    imageSuccess: succeeded,
    imageFailed: imageUrls.size - succeeded,
  };
}
