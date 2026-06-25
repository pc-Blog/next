"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "./layout/ThemeProvider";
import { get as getAbout } from "@/lib/api/about";
import { siteConfig, loadConfig } from "@/lib/config";
import { assetUrl } from "@/lib/asset-url";

declare global {
  interface Window {
    Paul_Pio: new (config: Record<string, unknown>) => Record<string, any>;
    pio_reference?: Record<string, any>;
    pio_alignment?: string;
    pio_onHitArea?: (hitAreas: string[], model: any) => void;
    TweenLite: { to: (target: any, duration: number, props: Record<string, any>) => void };
  }
}

const IDLE_MESSAGES = [
  "嗯…这里好像没什么人",
  "好无聊啊，有谁陪我玩~",
  "我是不是该做点什么？",
  "今天也要加油鸭！",
  "偷偷告诉你，其实我很厉害的！",
  "你说，宇宙有没有尽头呢…",
  "唔…想喝奶茶了",
  "这样站着好累哦",
  "我昨晚做了一个很有趣的梦~",
  "哼！不跟你玩了！",
  "你在看什么呢？",
  "其实我是会魔法的哦！",
  "好想出去玩啊…",
  "我是不是长胖了？",
  "你猜我现在在想什么？",
  "今天天气真好啊~",
  "人生就像一杯茶，慢慢品味…",
  "噗嗤，你刚才的样子好逗！",
  "我在想晚饭吃什么好呢？",
  "你有没有听过一个故事…算了，不讲了",
  "我是不是说话太多了？",
  "你相信世界上有圣诞老人吗？",
  "感觉好久没人跟我说话了",
  "偷偷瞄你一眼~",
  "唉…有点困了",
  "我最近学了一首新歌，要听吗？",
  "你专注的样子还挺好看的",
  "唔…我在想怎么跟你搭话来着",
  "感觉今天很适合出去走走！",
  "偷偷告诉你，旁边的猫猫在看你呢~",
];

export default function Live2DWidget() {
  const { isDark } = useTheme();
  const pathname = usePathname();
  const githubRef = useRef(`https://github.com/${siteConfig.repo}`);
  const loaded = useRef(false);
  const currentModel = useRef<string | null>(null);
  const pioRef = useRef<any>(null);
  const live2dModel = useRef<any>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseoverRef = useRef<((e: MouseEvent) => void) | null>(null);

  // AI 对话
  const [inputOpen, setInputOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [inputPos, setInputPos] = useState({ x: 0, y: 0 });
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputOpenRef = useRef(false);

  const closeInput = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setClosing(false); setInputOpen(false); }, 200);
  }, []);

  useEffect(() => {
    inputOpenRef.current = inputOpen;
    if (inputOpen) setTimeout(() => aiInputRef.current?.focus(), 100);
  }, [inputOpen]);

  // 点击输入框外部关闭（排除 AI 按钮本身）
  useEffect(() => {
    if (!inputOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target?.closest?.(".pio-ai")) return;
      if (inputContainerRef.current && !inputContainerRef.current.contains(target)) {
        closeInput();
      }
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [inputOpen]);

  const sendAiChat = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    const char = currentModel.current || (isDark ? "Ava" : "Diana");
    setAiInput("");
    setAiLoading(true);

    // 读历史
    const key = `chat_${char}`;
    let history: { role: string; content: string }[] = [];
    try { const h = localStorage.getItem(key); if (h) history = JSON.parse(h); } catch {}

    try {
      const res = await fetch(`https://${siteConfig.analytics}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, character: char, history }),
      });
      const json = await res.json();
      const reply = json?.data?.reply || "(唔…不知道说什么了)";

      // 存历史（保留最近3组 = 6条）
      history.push({ role: "user", content: text }, { role: "assistant", content: reply });
      if (history.length > 6) history = history.slice(-6);
      try { localStorage.setItem(key, JSON.stringify(history)); } catch {}

      const pio = window.pio_reference;
      if (pio?.modules) pio.modules.render(reply);
      // 随机动作
      const model = live2dModel.current || pioRef.current?.model;
      if (model) {
        const name = model.internalModel?.settings?.name || char;
        const tapMotions: Record<string, string[]> = {
          Ava: ["Shake", "Tap右手", "Tap左手", "Tap嘴", "Tap胸口项链", "Tap中间刘海", "Tap右眼", "Tap左眼", "Tap腰", "Tap脖子", "Tap左马尾", "Tap右手臂"],
          Diana: ["Shake", "Tap抱阿草-左手", "Tap右头发", "Tap左头发", "Tap笑- 脸", "Tap生气 -领结", "Tap= =  左蝴蝶结", "Tap哭 -眼角", "Tap摇头- 身体", "Tap耳朵-发卡", "Tap打瞌睡- 呆毛"],
        };
        const list = tapMotions[name] || ["Shake"];
        if (list.length > 0) model.motion(list[Math.floor(Math.random() * list.length)]);
      }
    } catch {
      const pio = window.pio_reference;
      if (pio?.modules) pio.modules.render("哎呀，网络出问题了～(；′⌒`)");
    } finally {
      setAiLoading(false);
    }
  };

  const startIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const delay = 15000 + Math.random() * 30000; // 15-45秒
    idleTimer.current = setTimeout(() => {
      // 对话中不显示随机文本
      if (inputOpenRef.current) { startIdleTimer(); return; }
      const pio = window.pio_reference;
      const model = live2dModel.current;
      if (model) {
        const modelName = model.internalModel?.settings?.name || (isDark ? "Ava" : "Diana");
        if (Math.random() < 0.3) {
          const motions: Record<string, string[]> = { Diana: ["Shake", "Leave"], Ava: ["Shake"] };
          const list = motions[modelName] || [];
          if (list.length > 0) {
            model.motion(list[Math.floor(Math.random() * list.length)]);
          }
        }
      }
      if (pio?.modules) {
        const msg = IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)];
        pio.modules.render(msg);
      }
      startIdleTimer();
    }, delay);
  };

  const stopIdleTimer = () => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  const isAdmin = pathname?.startsWith("/admin");

  // admin 时销毁，返回时重建
  const wasAdmin = useRef(false);
  useEffect(() => {
    if (isAdmin) {
      wasAdmin.current = true;
      document.querySelector(".pio-container")?.remove();
      (document.getElementById("pio-container") as HTMLElement)?.remove();
      return;
    }
    if (wasAdmin.current) {
      wasAdmin.current = false;
      loaded.current = false;
      // 小延迟确保 DOM 已清理
      setTimeout(() => initPio(), 100);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (loaded.current) return;
    loaded.current = true;

    (window as any).pio_alignment = "left";

    // 获取已合并的 GitHub 链接
    getAbout().then((about) => {
      loadConfig(about);
      if (siteConfig.github) {
        githubRef.current = siteConfig.github;
        const pio = window.pio_reference as any;
        if (pio?.config?.content) pio.config.content.link = siteConfig.github;
      }
    }).catch(() => {});

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = assetUrl("/pio/pio.css");
    document.head.appendChild(link);

    const scripts = [
      assetUrl("/pio/TweenLite.js"),
      assetUrl("/pio/live2dcubismcore.min.js"),
      assetUrl("/pio/pixi.min.js"),
      assetUrl("/pio/cubism4.min.js"),
      assetUrl("/pio/pio.js"),
      assetUrl("/pio/pio_sdk4.js"),
    ];

    let idx = 0;
    const loadNext = () => {
      if (idx >= scripts.length) {
        initPio();
        return;
      }
      const s = document.createElement("script");
      s.src = scripts[idx];
      s.onload = () => { idx++; loadNext(); };
      document.body.appendChild(s);
    };
    loadNext();

    return () => { stopIdleTimer(); if (mouseoverRef.current) document.removeEventListener("mouseover", mouseoverRef.current); };
  }, []);

  const initPio = () => {
    if (!window.Paul_Pio) return;

    (window as any).pio_alignment = "left";
    if (typeof (window as any)._pio_initialize_pixi === "function") {
      (window as any)._pio_initialize_pixi();
    }

    const modelFile = isDark ? "Ava" : "Diana";
    currentModel.current = modelFile;

    window.pio_reference = new window.Paul_Pio({
      mode: "fixed",
      hidden: false,
      content: {
        link: githubRef.current,
        welcome: ["Hi~"],
        touch: ["你在干什么？", "再摸我就报警了！", "HENTAI!", "不可以这样欺负我啦！", "今天天气不错呢~", "要和我一起玩吗？", "盯——", "别戳了啦！", "好无聊啊，陪我聊聊天吧", "呜呜...你欺负我", "嘿！抓到你了！", "你是不是喜欢我呀？", "努力工作，加油！", "我可爱吗？", "喂喂，有人在吗？"],
        custom: [],
      },
      model: [assetUrl(`/live2d-models/${modelFile}/${modelFile}.model3.json`)],
      tips: true,
      onModelLoad: (model: any) => {
        const name = model.internalModel?.settings?.name;
        if (name === "Ava") {
          const coreModel = model.internalModel.coreModel;
          const hideParts = ["Part15", "Part5", "neko", "game", "Part21", "Part22", "Part", "Part16", "Part12"];
          setTimeout(() => {
            hideParts.forEach(id => {
              const idx = coreModel._partIds.indexOf(id);
              if (idx >= 0 && window.TweenLite) {
                window.TweenLite.to(coreModel._partOpacities, 3.6, { [idx]: 0 });
              } else if (idx >= 0) {
                coreModel._partOpacities[idx] = 0;
              }
            });
          }, 2400);
        }
      },
    });
    pioRef.current = window.pio_reference;

    // 添加 AI 对话按钮到 Pio 菜单
    const pioContainer = document.querySelector(".pio-container");
    const menu = pioContainer?.querySelector(".pio-action");
    if (menu && !document.querySelector(".pio-ai")) {
      const btn = document.createElement("span");
      btn.className = "pio-ai";
      btn.title = "AI 聊天";
      btn.onmouseover = () => {
        const pio = window.pio_reference;
        if (pio?.modules) pio.modules.render("要和我聊聊天吗？(๑•̀ㅂ•́)و✧");
      };
      btn.onclick = (e) => {
        if (inputOpenRef.current) { closeInput(); return; }
        setInputPos({ x: e.clientX, y: e.clientY });
        setInputOpen(true);
      };
      menu.appendChild(btn);
    }

    // 动作测试按钮（顺序触发）
    const motionList: Record<string, string[]> = {
      Ava: ["Shake", "Tap右手", "Tap左手", "Tap嘴", "Tap胸口项链", "Tap中间刘海", "Tap右眼", "Tap左眼", "Tap腰", "Tap脖子", "Tap左马尾", "Tap右手臂"],
      Diana: ["Shake", "Tap抱阿草-左手", "Tap右头发", "Tap左头发", "Tap笑- 脸", "Tap生气 -领结", "Tap= =  左蝴蝶结", "Tap哭 -眼角", "Tap摇头- 身体", "Tap耳朵-发卡", "Tap打瞌睡- 呆毛"],
    };
    let motionIdx = 0;
    if (menu && !document.querySelector(".pio-motion")) {
      const mBtn = document.createElement("span");
      mBtn.className = "pio-motion";
      mBtn.title = "测试动作";
      mBtn.onmouseover = () => {
        const pio = window.pio_reference;
        if (pio?.modules) pio.modules.render("按顺序测试动作");
      };
      mBtn.onclick = () => {
        const model = live2dModel.current || pioRef.current?.model;
        if (!model) return;
        const name = model.internalModel?.settings?.name || (isDark ? "Ava" : "Diana");
        const list = motionList[name] || ["Shake"];
        const motion = list[motionIdx % list.length];
        motionIdx++;
        model.motion(motion);
        const pio = window.pio_reference;
        if (pio?.modules) pio.modules.render("▶ " + motion);
      };
      menu.appendChild(mBtn);
    }

    // 点击部位不同反应（多组对话，随机选取）
    const hitTexts: Record<string, Record<string, string[]>> = {
      Diana: {
        "生气 -领结": ["哼！我生气了！哄不好的那种！", "你惹到我了知道吗！", "气死我啦！", "不理你了！哼！"],
        "= =  左蝴蝶结": ["盯——你这样看着我干嘛", "你脸上有东西…骗你的！", "看什么看，没见过美女吗~"],
        "笑- 脸": ["嘿嘿~今天心情不错哦", "有什么开心的事吗？", "笑一笑，十年少~", "嘿嘿嘿~"],
        "哭 -眼角": ["呜呜...好难过", "你欺负我！", "眼角有泪花…", "呜哇——"],
        "害羞-中间刘海": ["哎呀！不要碰那里啦！", "好害羞…别碰我刘海", "脸都红啦！", "讨厌！"],
        "抱阿草-左手": ["阿草是我最好的朋友~", "阿草软软的，好舒服", "你想抱抱阿草吗？"],
        "打瞌睡- 呆毛": ["好困啊…让我睡一会", "哈欠~~~", "别碰呆毛，会变笨的！", "已经睁不开眼睛了…"],
        "耳朵-发卡": ["啊！好痒！不要碰耳朵！", "耳朵是很敏感的地方啦！", "再碰耳朵我就咬你！"],
        "摇头- 身体": ["不要不要——", "不行不行！", "摇头晃脑~", "再摇就要散架啦！"],
        "左头发": ["我的头发好看吗？嘿嘿", "左分也很美吧~", "你是不是想摸我的头发？"],
        "右头发": ["再摸头发要掉光啦！", "右分也很漂亮哦", "头发可是我的骄傲！"],
      },
      Ava: {
        "左手": ["嘿！接招！", "看我的左手攻击！", "嘿嘿，抓到你啦", "左手也很灵活的！"],
        "右手": ["干嘛呀~", "右手是用来写代码的！", "别碰我右手啦", "再摸我就弹你！"],
        "腰": ["哈哈…好痒！别碰我腰！", "痒痒痒！投降！", "腰是不能碰的！", "你再碰我就笑死了"],
        "中间刘海": ["发型都弄乱啦！", "我好不容易才弄好的刘海！", "别碰我刘海啦！"],
        "嘴": ["我唱歌可好听了，要听吗？", "啊——你有蛀牙吗？", "说话就说话，别动嘴！"],
        "胸口项链": ["这个项链好看吧~", "这是我最重要的项链！", "好看吗？我也觉得~"],
        "脖子": ["唔…好敏感的地方", "脖子不可以碰！", "痒—"],
        "右边头饰小花": ["小花可爱吗？", "她叫小可爱~", "别弄疼小花了！"],
        "右头饰": ["别碰歪了我的头饰", "头饰歪了就不好看了！", "这个可是限量版的！"],
        "右眼": ["你再戳我眼睛试试！", "眼睛很重要！！", "戳瞎了你负责吗？！"],
        "左眼": ["我的眼睛是不是很漂亮？", "左眼是心灵的窗户~", "再盯着看我会害羞的…"],
        "右马尾": ["我的双马尾可爱吧~", "右马尾晃呀晃~", "揪马尾会疼的啦！"],
        "左马尾": ["扎了很久才弄好的！", "左马尾可是我的得意之作！", "别弄乱了啦！"],
        "右手臂": ["揪你手臂！", "手臂肉肉的~", "你再揪我我就揪回去！"],
        "左中马尾": ["中间的马尾也很有精神！", "三马尾才是完全体！", "嘿嘿，被我发现了吧！"],
      },
    };

    // 额外随机动效配置
    const extraMotions: Record<string, { motion: string; chance: number }[]> = {
      Diana: [
        { motion: "Shake", chance: 0.3 },
        { motion: "Leave", chance: 0.15 },
      ],
      Ava: [
        { motion: "Shake", chance: 0.25 },
      ],
    };

    window.pio_onHitArea = (hitAreas: string[], model: any) => {
      live2dModel.current = model;
      const modelName = model.internalModel?.settings?.name || (isDark ? "Ava" : "Diana");
      const texts = hitTexts[modelName] || {};
      const extras = extraMotions[modelName] || [];
      const motionFix: Record<string, string> = {
        "右边头饰小花": "Tap 右边头饰小花",
        "右马尾": "Tap右马尾   ",
        "左马尾": "Tap左马尾",
        "左中马尾": "Tap左中马尾",
        "右头饰": "Tap右头饰",
      };
      const pio = window.pio_reference;
      for (const area of hitAreas) {
        const clean = area.trim();
        const textsArr = texts[clean];
        const text = textsArr ? textsArr[Math.floor(Math.random() * textsArr.length)] : "唔…";
        if (pio?.modules) pio.modules.render(text);
        model.motion(motionFix[clean] || `Tap${clean}`);
        // 随机触发额外动作
        for (const extra of extras) {
          if (Math.random() < extra.chance) {
            setTimeout(() => model.motion(extra.motion), 800);
          }
        }
        return;
      }
    };

    // 事件委托悬浮提示（用 closest 支持子元素触发）
    const tooltipRules: { test: (el: Element) => string | null }[] = [
      { test: (el) => { const c = el.closest(".giscus-wrapper"); return c ? "来聊聊你的想法吧~" : null; }},
      { test: (el) => { const a = el.closest("a"); if (!a) return null; const h = a.getAttribute("href") || ""; return h.startsWith("/article/") || h.startsWith("/project/") || h.startsWith("/literature/") || h.startsWith("/gallery") ? a.textContent?.trim().slice(0, 30) || "去看看~" : null; }},
      { test: (el) => { const a = el.closest("a"); return a?.getAttribute("href") === "/timeline" ? "看看博主的学习历程~" : null; }},
      { test: (el) => { const a = el.closest("a"); return a?.getAttribute("href") === "/about" ? "想了解博主是什么样的人吗？" : null; }},
      { test: (el) => { const a = el.closest("a"); return a?.getAttribute("href") === "/friends" ? "去交个朋友吧~" : null; }},
      { test: (el) => { const a = el.closest("a"); return a?.getAttribute("href")?.startsWith("/admin") ? "管理员入口，闲人勿入！" : null; }},
      { test: (el) => { const a = el.closest("a"); return a?.getAttribute("href") === "/auth/login" || a?.getAttribute("href") === "/auth/register" ? "登录后可以管理博客哦~" : null; }},
      { test: (el) => el.closest("header")?.querySelector("a") && !el.closest("header")?.querySelector("[class*='glass-btn']") ? "想去哪里看看？" : null },
      { test: (el) => el.closest("footer") ? "到底部了呢，感谢阅读~" : null },
      { test: (el) => { const a = el.closest("a"); if (a && a.closest(".article-prose")) return "想了解一下 " + (a.textContent?.trim().slice(0, 20) || "") + " 吗？"; return null; }},
      { test: (el) => el.closest(".article-prose")?.querySelector("img") === el ? "这张图真好看~" : null },
    ];

    const mouseoverHandler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target || !window.pio_reference?.modules) return;
      if ((mouseoverHandler as any)._lastTarget === target) return;
      (mouseoverHandler as any)._lastTarget = target;
      setTimeout(() => { (mouseoverHandler as any)._lastTarget = null; }, 300);
      for (const rule of tooltipRules) {
        const msg = rule.test(target);
        if (msg) {
          window.pio_reference.modules.render(msg);
          return;
        }
      }
    };
    document.addEventListener("mouseover", mouseoverHandler);
    mouseoverRef.current = mouseoverHandler;

    // 闲置自言自语 — 等模型加载完启动
    const waitForCanvas = setInterval(() => {
      const canvas = document.getElementById("pio") as HTMLCanvasElement;
      if (canvas && canvas.width > 50) {
        clearInterval(waitForCanvas);
        // 点击角色时重置闲置计时
        canvas.onclick = () => { startIdleTimer(); };
        startIdleTimer();
      }
    }, 500);
  };

  // Switch model on theme change
  useEffect(() => {
    const modelFile = isDark ? "Ava" : "Diana";
    if (currentModel.current === modelFile) return;
    currentModel.current = modelFile;
    stopIdleTimer();
    document.querySelector(".pio-container")?.remove();
    (document.getElementById("pio-container") as HTMLElement)?.remove();
    initPio();
  }, [isDark]);

  return (
    <>
      {inputOpen && (
        <div
          ref={inputContainerRef}
          className={`fixed z-[9999] ${closing ? "animate-pio-chat-out" : "animate-pio-chat"}`}
          style={{ left: inputPos.x + 15, top: inputPos.y - 22 }}
        >
          <div className="relative">
            <input
              ref={aiInputRef}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendAiChat(); }}
              placeholder="和看板娘聊天～"
              disabled={aiLoading}
              className="w-40 sm:w-48 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl px-3 py-2 pr-8 text-sm outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 border border-white/40 dark:border-white/10 shadow-lg"
            />
            <button
              onClick={sendAiChat}
              disabled={aiLoading || !aiInput.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-500 disabled:opacity-30 transition-colors text-xs"
            >
              ↗
            </button>
          </div>
        </div>
      )}
    </>
  );
}
