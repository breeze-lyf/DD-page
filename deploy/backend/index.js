const http = require("http");
const tcb = require("@cloudbase/node-sdk");
const fetchImpl = global.fetch || require("node-fetch");

const app = tcb.init({ env: tcb.SYMBOL_DEFAULT_ENV });
const db = app.database();
const collectionName = process.env.STATE_COLLECTION || "workbench_state";
const stateDocId = process.env.STATE_DOC_ID || "lzddd-main";
const allowOrigin = process.env.ALLOW_ORIGIN || "*";

const defaultState = {
  news: [],
  notes: [],
  knowledge: [],
  clients: [],
  opsRecords: [],
  settings: { cloudEndpoint: "", cloudToken: "", aiEndpoint: "", aiModel: "", aiToken: "" },
  syncLog: []
};

const sourcePages = [
  { name: "青眼官网", url: "https://www.iqingyan.cn/", category: "市场趋势", region: "domestic" },
  { name: "青眼情报", url: "https://www.iqyqb.com/index", category: "消费者洞察", region: "domestic" },
  { name: "青眼情报行业资讯", url: "https://www.iqyqb.com/articleDetails?id=1003&types=1", category: "市场趋势", region: "domestic" },
  { name: "品观网", url: "https://www.pinguan.com/", category: "渠道动态", region: "domestic" },
  { name: "化妆品财经在线", url: "https://www.cbo.cn/", category: "渠道动态", region: "domestic" },
  { name: "C2CC 传媒", url: "https://www.c2cc.cn/", category: "市场趋势", region: "domestic" },
  { name: "化妆品资讯", url: "https://www.cosmetic-news.net/", category: "市场趋势", region: "domestic" },
  { name: "国家药监局化妆品", url: "https://www.nmpa.gov.cn/xxgk/fgwj/bmgzh/20200331151901234.html", category: "法规政策", region: "domestic" },
  { name: "Jing Daily Beauty", url: "https://jingdaily.com/beauty/", category: "国际趋势", region: "global" },
  { name: "Cosmetics Design", url: "https://www.cosmeticsdesign.com/", category: "市场趋势", region: "global" },
  { name: "Premium Beauty News", url: "https://www.premiumbeautynews.com/", category: "市场趋势", region: "global" },
  { name: "Global Cosmetics News", url: "https://www.globalcosmeticsnews.com/", category: "品牌案例", region: "global" },
  { name: "Business Wire Cosmetics", url: "https://www.businesswire.com/newsroom/industry/retail/cosmetics", category: "品牌案例", region: "global" }
];

const feedCandidates = [
  { url: "https://www.iqingyan.cn/feed", region: "domestic" },
  { url: "https://www.iqingyan.cn/feed/", region: "domestic" },
  { url: "https://www.cbo.cn/rss.xml", region: "domestic" },
  { url: "https://www.pinguan.com/rss.xml", region: "domestic" },
  { url: "https://www.c2cc.cn/rss.xml", region: "domestic" },
  { url: "https://www.cosmetic-news.net/feed", region: "domestic" },
  { url: "https://jingdaily.com/feed/", region: "global" },
  { url: "https://www.cosmeticsdesign.com/Info/CosmeticsDesign-USA-RSS", region: "global" },
  { url: "https://www.premiumbeautynews.com/spip.php?page=backend", region: "global" },
  { url: "https://www.globalcosmeticsnews.com/feed/", region: "global" }
];

function createId() {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeState(state = {}) {
  return {
    news: Array.isArray(state.news) ? state.news : [],
    notes: Array.isArray(state.notes) ? state.notes : [],
    knowledge: Array.isArray(state.knowledge) ? state.knowledge : [],
    clients: Array.isArray(state.clients) ? state.clients : [],
    opsRecords: Array.isArray(state.opsRecords) ? state.opsRecords : [],
    settings: {
      cloudEndpoint: state.settings?.cloudEndpoint || "",
      cloudToken: state.settings?.cloudToken || "",
      aiEndpoint: state.settings?.aiEndpoint || "",
      aiModel: state.settings?.aiModel || "",
      aiToken: ""
    },
    syncLog: Array.isArray(state.syncLog) ? state.syncLog : []
  };
}

function headers() {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-lzddd-token,authorization",
    "access-control-max-age": "86400"
  };
}

function json(statusCode, payload) {
  return { statusCode, headers: headers(), body: JSON.stringify(payload) };
}

function requestUrl(event) {
  const url = new URL(event.path || "/", "https://cloudbase.local");
  Object.entries(event.queryStringParameters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });
  return url;
}

function requestMethod(event) {
  return String(event.httpMethod || event.method || "GET").toUpperCase();
}

function requestBody(event) {
  if (!event.body) return {};
  const value = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function readState() {
  try {
    const result = await db.collection(collectionName).doc(stateDocId).get();
    const record = Array.isArray(result.data) ? result.data[0] : result.data;
    return normalizeState(record?.state || defaultState);
  } catch {
    return normalizeState(defaultState);
  }
}

async function writeState(state) {
  const nextState = normalizeState(state);
  await db.collection(collectionName).doc(stateDocId).set({
    state: nextState,
    updatedAt: new Date().toISOString()
  });
  return nextState;
}

async function readAiConfig() {
  const state = await readState();
  return {
    aiEndpoint: process.env.AI_BASE_URL || state.settings.aiEndpoint || "https://api.deepseek.com/chat/completions",
    aiModel: process.env.AI_MODEL || state.settings.aiModel || "deepseek-chat",
    aiToken: process.env.AI_API_KEY || ""
  };
}

async function writeAiConfig(config) {
  const state = await readState();
  state.settings.aiEndpoint = config.aiEndpoint || state.settings.aiEndpoint || "https://api.deepseek.com/chat/completions";
  state.settings.aiModel = config.aiModel || state.settings.aiModel || "deepseek-chat";
  await writeState(state);
  return {
    aiEndpoint: state.settings.aiEndpoint,
    aiModel: state.settings.aiModel,
    hasToken: Boolean(process.env.AI_API_KEY),
    message: "云端版不会把 AI 令牌写进网页或数据库，请在云函数环境变量 AI_API_KEY 中配置。"
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "user-agent": "lzddd-cbe-workbench/1.0" }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverFeeds({ includeGlobal = false } = {}) {
  const pages = sourcePages.filter((source) => includeGlobal || source.region === "domestic");
  const candidates = feedCandidates.filter((feed) => includeGlobal || feed.region === "domestic");
  const discovered = new Map(candidates.map((feed) => [feed.url, feed.region]));

  await Promise.allSettled(pages.map(async (source) => {
    const html = await fetchText(source.url);
    const matches = [...html.matchAll(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi)];
    matches.forEach((match) => {
      const href = match[0].match(/href=["']([^"']+)["']/i)?.[1];
      if (href) discovered.set(new URL(href, source.url).toString(), source.region || "domestic");
    });
  }));

  return [...discovered.entries()].map(([url, region]) => ({ url, region }));
}

function parseFeed(xml, feed) {
  const sourceName = new URL(feed.url).hostname.replace(/^www\./, "");
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomBlocks = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = itemBlocks.length ? itemBlocks : atomBlocks;
  return blocks.slice(0, 12).map((block) => ({
    title: cleanXml(readTag(block, "title")),
    url: cleanXml(readTag(block, "link")) || readAtomLink(block),
    source: sourceName,
    publishedAt: cleanXml(readTag(block, "pubDate") || readTag(block, "published") || readTag(block, "updated")),
    summary: cleanXml(readTag(block, "description") || readTag(block, "summary") || readTag(block, "content:encoded")),
    region: feed.region
  })).filter((item) => item.title);
}

function parsePageLinks(html, source) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  return links.map((match) => {
    const url = normalizeUrl(match[1], source.url);
    const title = cleanXml(match[2]);
    return {
      title,
      url,
      source: source.name,
      publishedAt: "",
      summary: `${source.name} 页面抓取到的候选资讯，建议打开原文阅读后写一条随记。`,
      categoryHint: source.category,
      region: source.region || "domestic"
    };
  }).filter((item) => {
    if (!item.title || item.title.length < 6 || item.title.length > 80) return false;
    if (!item.url || seen.has(item.url)) return false;
    if (!isBeautyLike(item.title)) return false;
    seen.add(item.url);
    return true;
  }).slice(0, 8);
}

function normalizeUrl(url, base) {
  try {
    if (/^(javascript:|mailto:|tel:|#)/i.test(url)) return "";
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

function isBeautyLike(value) {
  return /美妆|化妆品|护肤|彩妆|香水|香氛|洗护|功效|品牌|渠道|零售|门店|消费|备案|原料|成分|防晒|面膜|医美|个护|beauty|cosmetic|skincare|fragrance|retail|brand/i.test(value);
}

function readTag(block, tag) {
  const safeTag = tag.replace(":", "\\:");
  return block.match(new RegExp(`<${safeTag}[^>]*>([\\s\\S]*?)<\\/${safeTag}>`, "i"))?.[1] || "";
}

function readAtomLink(block) {
  return block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || "";
}

function cleanXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyArticle(item) {
  const value = `${item.title} ${item.summary}`.toLowerCase();
  if (/regulation|fda|nmpa|法规|监管|备案|功效/.test(value)) return "法规政策";
  if (/retail|channel|store|douyin|tmall|渠道|门店|零售|抖音|天猫/.test(value)) return "渠道动态";
  if (/brand|launch|loreal|shiseido|品牌|新品|上市/.test(value)) return "品牌案例";
  if (/consumer|gen z|消费|消费者|趋势/.test(value)) return "消费者洞察";
  return "市场趋势";
}

function stakeholderFor(item) {
  const value = `${item.title} ${item.summary}`.toLowerCase();
  if (/retail|channel|store|渠道|门店|零售/.test(value)) return "渠道商";
  if (/ingredient|supplier|packaging|原料|供应链|包材/.test(value)) return "供应链";
  if (/consumer|gen z|消费/.test(value)) return "消费者";
  return "品牌方";
}

async function syncNews({ includeGlobal = false } = {}) {
  const state = await readState();
  const pages = sourcePages.filter((source) => includeGlobal || source.region === "domestic");
  const feeds = await discoverFeeds({ includeGlobal });
  const settled = await Promise.allSettled(feeds.map(async (feed) => parseFeed(await fetchText(feed.url), feed)));
  const pageSettled = await Promise.allSettled(pages.map(async (source) => parsePageLinks(await fetchText(source.url), source)));
  const fetched = [
    ...settled.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    ...pageSettled.flatMap((result) => result.status === "fulfilled" ? result.value : [])
  ];
  const seen = new Set(state.news.map((item) => item.url || item.title));
  const uniqueFetched = fetched.filter((item) => !seen.has(item.url || item.title));
  const domesticItems = uniqueFetched.filter((item) => item.region === "domestic").slice(0, 20);
  const globalItems = includeGlobal ? uniqueFetched.filter((item) => item.region !== "domestic").slice(0, 2) : [];
  const newItems = [...domesticItems, ...globalItems].slice(0, 22).map((item) => ({
    id: createId(),
    title: item.title,
    category: item.categoryHint || classifyArticle(item),
    stakeholder: stakeholderFor(item),
    source: `${item.source}${item.url ? ` · ${item.url}` : ""}`,
    url: item.url,
    summary: item.summary || "自动抓取到的行业资讯，建议打开原文补充摘要。",
    reflection: "待读后反馈：这条资讯对 CBE、渠道商、品牌方或你的客户沟通有什么启发？",
    talkingPoint: "待整理成客户沟通话术。",
    createdAt: new Date().toISOString(),
    region: item.region || "domestic",
    autoFetched: true
  }));
  state.news = [...newItems, ...state.news];
  state.syncLog.unshift({
    id: createId(),
    createdAt: new Date().toISOString(),
    message: includeGlobal
      ? `国内和海外参考抓取 ${feeds.length} 个资讯源，新增 ${newItems.length} 条记录，其中国内 ${domesticItems.length} 条，海外参考 ${globalItems.length} 条。`
      : `大陆网络模式抓取 ${feeds.length} 个国内资讯源，新增 ${domesticItems.length} 条国内报道。`
  });
  state.syncLog = state.syncLog.slice(0, 30);
  await writeState(state);
  return { added: newItems.length, domesticAdded: domesticItems.length, globalAdded: globalItems.length, feeds: feeds.length, includeGlobal, items: newItems, state };
}

function dueClients(state) {
  const today = new Date().toISOString().slice(0, 10);
  return state.clients.filter((client) => client.nextFollow && client.nextFollow <= today);
}

async function pushCloud() {
  const state = await readState();
  if (!state.settings.cloudEndpoint) return { ok: false, message: "还没有配置云同步地址。" };
  const response = await fetchImpl(state.settings.cloudEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(state.settings.cloudToken ? { authorization: `Bearer ${state.settings.cloudToken}` } : {})
    },
    body: JSON.stringify(state)
  });
  return { ok: response.ok, status: response.status, message: response.ok ? "云同步已发送。" : "云同步地址返回异常。" };
}

async function callAiProxy(body) {
  const config = await readAiConfig();
  if (!config.aiEndpoint || !config.aiToken) {
    return { ok: false, message: "云端 AI 尚未配置。请在云函数环境变量 AI_API_KEY 中保存令牌。" };
  }
  const messages = Array.isArray(body.messages)
    ? body.messages
    : [
        { role: "system", content: "你是CBE日化销售新人助手。用中文解释日化、美妆、会展、渠道、合同续签和拓客相关问题，并给出销售可用表达。" },
        { role: "user", content: String(body.question || "") }
      ];
  const upstream = await fetchImpl(config.aiEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.aiToken}`
    },
    body: JSON.stringify({
      model: body.model || config.aiModel,
      messages,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.3
    })
  });
  const text = await upstream.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { content: text }; }
  if (!upstream.ok) return { ok: false, status: upstream.status, message: data.error?.message || data.message || "AI 服务返回异常。" };
  return { ok: true, answer: data.choices?.[0]?.message?.content || data.answer || data.content || "" };
}

exports.main = async (event = {}) => {
  const method = requestMethod(event);
  if (method === "OPTIONS") return { statusCode: 204, headers: headers(), body: "" };

  const url = requestUrl(event);
  const pathname = url.pathname;

  try {
    if (pathname === "/api/health" || pathname === "/health") {
      return json(200, { ok: true, mode: "cloudbase", loginPaused: true, requiresPassword: false });
    }

    if (pathname === "/api/auth" || pathname === "/auth") {
      return json(200, { ok: true });
    }

    if ((pathname === "/api/read" || pathname === "/read") && method === "POST") {
      return json(200, await readState());
    }

    if ((pathname === "/api/write" || pathname === "/write") && method === "POST") {
      const body = requestBody(event);
      return json(200, await writeState(body.state || body));
    }

    if ((pathname === "/api/data" || pathname === "/data") && method === "GET") {
      return json(200, await readState());
    }

    if ((pathname === "/api/data" || pathname === "/data") && method === "POST") {
      return json(200, await writeState(requestBody(event)));
    }

    if ((pathname === "/api/sync-news" || pathname === "/sync-news") && method === "POST") {
      return json(200, await syncNews({ includeGlobal: url.searchParams.get("includeGlobal") === "1" }));
    }

    if ((pathname === "/api/reminders" || pathname === "/reminders") && method === "GET") {
      const state = await readState();
      return json(200, { due: dueClients(state) });
    }

    if ((pathname === "/api/cloud-push" || pathname === "/cloud-push") && method === "POST") {
      return json(200, await pushCloud());
    }

    if ((pathname === "/api/ai-config" || pathname === "/ai-config") && method === "GET") {
      const config = await readAiConfig();
      return json(200, { aiEndpoint: config.aiEndpoint, aiModel: config.aiModel, hasToken: Boolean(config.aiToken) });
    }

    if ((pathname === "/api/ai-config" || pathname === "/ai-config") && method === "POST") {
      return json(200, await writeAiConfig(requestBody(event)));
    }

    if ((pathname === "/api/ai" || pathname === "/ai") && method === "POST") {
      return json(200, await callAiProxy(requestBody(event)));
    }

    return json(404, { ok: false, message: "Not found", path: pathname });
  } catch (error) {
    return json(500, { ok: false, message: error.message || "Server error" });
  }
};

if (require.main === module) {
  const port = Number(process.env.PORT || 9000);
  const server = http.createServer(async (request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", async () => {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      const event = {
        path: url.pathname,
        httpMethod: request.method,
        headers: request.headers,
        queryStringParameters: Object.fromEntries(url.searchParams.entries()),
        body
      };
      const result = await exports.main(event);
      response.writeHead(result.statusCode || 200, result.headers || {});
      response.end(result.body || "");
    });
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`lzddd cloud api listening on ${port}`);
  });
}
