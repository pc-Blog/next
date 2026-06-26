import { create } from "zustand";

export interface PageContent {
  type: "article" | "project" | "about" | "literature";
  title: string;
  summary: string;
  categoryName: string;
  tags: string[];
  /** about 页专用：个人介绍全文 */
  content?: string;
  /** 项目额外链接信息 */
  hasDemo?: boolean;
  hasGithub?: boolean;
}

interface ContentState {
  content: PageContent | null;
  setContent: (c: PageContent) => void;
  clearContent: () => void;
}

export const useContentStore = create<ContentState>()((set) => ({
  content: null,
  setContent: (content) => set({ content }),
  clearContent: () => set({ content: null }),
}));
