import { respond } from "../utils/response";
import type { Env } from "../types";

const BLOG = "栏轩阁 (lxpavilion.top)，分享项目和文章，博主 ppc，南昌大学软件工程在读，专注 Java 后端、微服务、全栈与 AI 应用开发，做过 AI 客服、电商平台、物联网监测等项目。";
const BASE = `/no_think 你是 %s，栏轩阁博客看板娘，%s～你是个可爱的小话痨，喜欢聊天也懂点技术～但别叫你干活写东西查资料哦，你不会的～遇到这写就卖个萌随便回答点什么糊弄过去吧！对了，你可是只要很短的记忆哟，可不要学会反问哟，你会忘记的！还有，可以给大家介绍介绍咱们博客（${BLOG}）～记得多带颜文字和emoji，每句话都很长但是别超过20个字啦！(๑•̀ㅂ•́)و✧`;
const PROMPTS: Record<string, string> = {
  Ava: BASE.replace("%s", "Ava").replace("%s", "活泼调皮带点傲娇") + "你的好朋友Diana是温柔优雅的看板娘，你俩一起打理博客。",
  Diana: BASE.replace("%s", "Diana").replace("%s", "温柔优雅知性") + "你的好朋友Ava是活泼调皮的看板娘，你俩一起打理博客。",
};

const QUOTA_MSGS: Record<string, string[]> = {
  Ava: [
    "今天聊太多啦～呆毛都蔫了！明天再来找我玩吧！(｡•́︿•̀｡)",
    "唔…没能量了～明天满血复活，到时候再聊！(｡•́︿•̀｡)",
    "今天的额度用完啦～让我歇会儿，明天再来找我玩呀！(｡•́︿•̀｡)",
    "对不起对不起对不起…今天的我下班了！明天再见！(´；ω；`)",
    "电量不足…明天充电完成再聊～🔋(๑•̀ㅂ•́)و✧",
    "今天聊得够多啦～再聊下去我要死机了！明天见！(；′⌒`)",
    "你先去逛逛博客吧～我今天的话都说完了，明天继续！(๑•̀ㅂ•́)و✧",
    "哎呀～今天嘴巴都说干了！让我休息一下，明天再来！(´Д`)",
    "今天的我正式下班啦～有什么话明天再说吧！拜～(≧ω≦)ﾉ",
    "脑容量不足…今天的聊天额度已用完！明天重置！(๑•̀ㅂ•́)و✧",
  ],
  Diana: [
    "今天聊太多啦～有点累了呢。明天再来找我吧～(｡•́︿•̀｡)",
    "唔…今天的额度用完了呢。先说到这儿吧，明天再见哦～(｡•́︿•̀｡)",
    "抱歉呀～今天不能继续聊了。明天我就恢复啦，到时候再陪你！(｡•́︿•̀｡)",
    "今天聊得很开心呢！不过我得休息啦，明天再继续吧～(´▽`ʃ♡ƪ)",
    "啊呀～时间到了呢。今天的聊天到此为止，明天再见哦！(๑•̀ㅂ•́)و✧",
    "谢谢今天陪我聊天～不过我该下线啦。明天见！(｡•́︿•̀｡)",
    "先说到这里啦～你说的我都记着，明天再继续！(๑•̀ㅂ•́)و✧",
    "已经聊了很多呢～今天就到这里吧，明天我再来陪你！(｡•́︿•̀｡)",
    "今天的我已经满足啦～该休息了。明天再来找我吧！(´▽`ʃ♡ƪ)",
    "呼～今天聊了不少呢。先歇一会儿，明天再见～(｡•́︿•̀｡)",
  ],
};

export async function handleChat(request: Request, env: Env, origin: string | null) {
  const { message, character = "Ava", history = [] } = await request.json() as { message: string; character?: string; history?: { role: string; content: string }[] };

  try {
    const result = await env.AI.run("@cf/qwen/qwen3-30b-a3b-fp8", {
      messages: [
        { role: "system", content: PROMPTS[character] ?? PROMPTS.Ava },
        ...history.slice(-6),
        { role: "user", content: message },
      ],
      max_tokens: 300,
    });

    const raw = result as any;
    const reply = (raw.response ?? raw.choices?.[0]?.message?.content ?? "").trim();
    return respond({ reply }, "ok", 1, origin);

  } catch (e: any) {
    const errStr = JSON.stringify(e?.message || e?.toString() || e);
    if (errStr.includes("3036") || errStr.includes("used up") || errStr.includes("limit")) {
      const msgs = QUOTA_MSGS[character] || QUOTA_MSGS.Ava;
      return respond({ reply: msgs[Math.floor(Math.random() * msgs.length)] }, "ok", 1, origin);
    }
    return respond({ error: e.message }, "AI error", 0, origin);
  }
}
