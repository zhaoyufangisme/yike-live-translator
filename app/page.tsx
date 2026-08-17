"use client";

import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  CornerDownLeft,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  Mail,
  Mic,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { ChangeEvent, DragEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Side = "left" | "right";
type Theme = "mint" | "ocean" | "sunset";
type TranslationMode = "instant" | "enter";
type SpeechRecognitionEventLike = { results: { [index: number]: { [index: number]: { transcript: string } } } };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const LANGUAGES = [
  { code: "en", name: "英语", native: "English", locale: "en-US", ocr: "eng" },
  { code: "ja", name: "日语", native: "日本語", locale: "ja-JP", ocr: "jpn" },
  { code: "ko", name: "韩语", native: "한국어", locale: "ko-KR", ocr: "kor" },
  { code: "fr", name: "法语", native: "Français", locale: "fr-FR", ocr: "fra" },
  { code: "de", name: "德语", native: "Deutsch", locale: "de-DE", ocr: "deu" },
  { code: "es", name: "西班牙语", native: "Español", locale: "es-ES", ocr: "spa" },
  { code: "pt", name: "葡萄牙语", native: "Português", locale: "pt-BR", ocr: "por" },
  { code: "ru", name: "俄语", native: "Русский", locale: "ru-RU", ocr: "rus" },
  { code: "it", name: "意大利语", native: "Italiano", locale: "it-IT", ocr: "ita" },
  { code: "ar", name: "阿拉伯语", native: "العربية", locale: "ar-SA", ocr: "ara" },
  { code: "th", name: "泰语", native: "ไทย", locale: "th-TH", ocr: "tha" },
  { code: "vi", name: "越南语", native: "Tiếng Việt", locale: "vi-VN", ocr: "vie" },
  { code: "id", name: "印度尼西亚语", native: "Bahasa Indonesia", locale: "id-ID", ocr: "ind" },
  { code: "ms", name: "马来语", native: "Bahasa Melayu", locale: "ms-MY", ocr: "msa" },
];

const CURRENCIES = [
  { code: "USD", country: "美国", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", country: "欧元区", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", country: "英国", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", country: "日本", symbol: "¥", flag: "🇯🇵" },
  { code: "KRW", country: "韩国", symbol: "₩", flag: "🇰🇷" },
  { code: "HKD", country: "中国香港", symbol: "HK$", flag: "🇭🇰" },
  { code: "SGD", country: "新加坡", symbol: "S$", flag: "🇸🇬" },
  { code: "MYR", country: "马来西亚", symbol: "RM", flag: "🇲🇾" },
  { code: "PHP", country: "菲律宾", symbol: "₱", flag: "🇵🇭" },
  { code: "THB", country: "泰国", symbol: "฿", flag: "🇹🇭" },
  { code: "AUD", country: "澳大利亚", symbol: "A$", flag: "🇦🇺" },
  { code: "CAD", country: "加拿大", symbol: "C$", flag: "🇨🇦" },
];

const PREFERRED_CURRENCY_KEY = "yike-preferred-currency";
const PREFERRED_LANGUAGE_KEY = "yike-preferred-language";
const MYMEMORY_EMAIL_KEY = "yike-mymemory-email";
const THEME_KEY = "yike-theme";
const MYMEMORY_USAGE_KEY = "yike-mymemory-daily-usage";
const TRANSLATION_MODE_KEY = "yike-translation-mode";
const TRANSLATION_CHUNK_BYTES = 450;

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date());
}

function decodeEntities(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function chunkTranslationText(text: string) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  const lines = text.split("\n");
  for (const [lineIndex, line] of lines.entries()) {
    let current = "";
    for (const character of line) {
      if (current && encoder.encode(current + character).length > TRANSLATION_CHUNK_BYTES) {
        chunks.push(current);
        current = character;
      } else {
        current += character;
      }
    }
    if (current) chunks.push(current);
    if (lineIndex < lines.length - 1) chunks.push("\n");
  }
  return chunks;
}

async function translateText(text: string, source: string, target: string, email: string, signal: AbortSignal, onUsage: (characters: number, quotaFinished: boolean) => void) {
  const translated: string[] = [];
  for (const chunk of chunkTranslationText(text)) {
    if (chunk === "\n") {
      translated.push(chunk);
      continue;
    }
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", chunk);
    url.searchParams.set("langpair", `${source}|${target}`);
    if (email.includes("@")) url.searchParams.set("de", email);
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
    if (!response.ok) throw new Error("翻译服务暂时不可用");
    const data = (await response.json()) as {
      quotaFinished?: boolean;
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    onUsage(Array.from(chunk).length, Boolean(data.quotaFinished));
    if (data.quotaFinished) throw new Error("今日 MyMemory 额度已用尽");
    if (data.responseStatus && data.responseStatus >= 400) throw new Error("翻译请求已被拒绝");
    translated.push(decodeEntities(data.responseData?.translatedText ?? ""));
  }
  return translated.join("");
}

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("zh-CN", { maximumFractionDigits: 4 }) : "";
}

export default function Home() {
  const [languageCode, setLanguageCode] = useState("en");
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [activeSide, setActiveSide] = useState<Side>("left");
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [copied, setCopied] = useState<Side | null>(null);
  const [listening, setListening] = useState<Side | null>(null);
  const [speechMessage, setSpeechMessage] = useState("");
  const [image, setImage] = useState<{ name: string; url: string } | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [foreignAmount, setForeignAmount] = useState("100");
  const [cnyAmount, setCnyAmount] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [rateUpdated, setRateUpdated] = useState("");
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myMemoryEmail, setMyMemoryEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [theme, setTheme] = useState<Theme>("mint");
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaFinished, setQuotaFinished] = useState(false);
  const [translationMode, setTranslationMode] = useState<TranslationMode>("instant");
  const [manualRequest, setManualRequest] = useState<{ id: number; side: Side; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const language = useMemo(() => LANGUAGES.find((item) => item.code === languageCode) ?? LANGUAGES[0], [languageCode]);
  const currency = useMemo(() => CURRENCIES.find((item) => item.code === currencyCode) ?? CURRENCIES[0], [currencyCode]);
  const sourceText = activeSide === "left" ? leftText : rightText;
  const translationText = translationMode === "instant" ? sourceText : manualRequest?.text ?? "";
  const translationSide = translationMode === "instant" ? activeSide : manualRequest?.side ?? activeSide;

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    const savedEmail = window.localStorage.getItem(MYMEMORY_EMAIL_KEY) ?? "";
    const savedTheme = (window.localStorage.getItem(THEME_KEY) as Theme | null) ?? "mint";
    const savedLanguage = window.localStorage.getItem(PREFERRED_LANGUAGE_KEY);
    const savedUsage = window.localStorage.getItem(MYMEMORY_USAGE_KEY);
    const savedTranslationMode = window.localStorage.getItem(TRANSLATION_MODE_KEY);
    setMyMemoryEmail(savedEmail);
    setEmailDraft(savedEmail);
    if (["mint", "ocean", "sunset"].includes(savedTheme)) {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    }
    if (savedLanguage && LANGUAGES.some((item) => item.code === savedLanguage)) setLanguageCode(savedLanguage);
    if (savedTranslationMode === "instant" || savedTranslationMode === "enter") setTranslationMode(savedTranslationMode);
    if (savedUsage) {
      try {
        const parsed = JSON.parse(savedUsage) as { date?: string; used?: number; finished?: boolean };
        if (parsed.date === todayKey()) {
          setQuotaUsed(typeof parsed.used === "number" ? parsed.used : 0);
          setQuotaFinished(Boolean(parsed.finished));
        } else {
          window.localStorage.removeItem(MYMEMORY_USAGE_KEY);
        }
      } catch {
        window.localStorage.removeItem(MYMEMORY_USAGE_KEY);
      }
    }
  }, []);

  const quotaLimit = myMemoryEmail ? 50000 : 5000;
  const quotaRemaining = quotaFinished ? 0 : Math.max(0, quotaLimit - quotaUsed);

  const recordQuotaUsage = useCallback((characters: number, finished: boolean) => {
    const date = todayKey();
    let previous = 0;
    try {
      const saved = JSON.parse(window.localStorage.getItem(MYMEMORY_USAGE_KEY) ?? "{}") as { date?: string; used?: number };
      if (saved.date === date && typeof saved.used === "number") previous = saved.used;
    } catch {
      previous = 0;
    }
    const used = previous + characters;
    setQuotaUsed(used);
    setQuotaFinished(finished);
    window.localStorage.setItem(MYMEMORY_USAGE_KEY, JSON.stringify({ date, used, finished }));
  }, []);

  useEffect(() => {
    const savedCurrency = window.localStorage.getItem(PREFERRED_CURRENCY_KEY);
    if (savedCurrency && CURRENCIES.some((item) => item.code === savedCurrency)) {
      setCurrencyCode(savedCurrency);
    }
  }, []);

  useEffect(() => {
    if (translationMode === "enter" && !manualRequest) return;
    if (!translationText.trim()) {
      if (translationSide === "left") setRightText("");
      else setLeftText("");
      setTranslationError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTranslating(true);
      setTranslationError("");
      try {
        const translatedText = await translateText(
          translationText,
          translationSide === "left" ? languageCode : "zh-CN",
          translationSide === "left" ? "zh-CN" : languageCode,
          myMemoryEmail,
          controller.signal,
          recordQuotaUsage,
        );
        if (translationSide === "left") setRightText(translatedText);
        else setLeftText(translatedText);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setTranslationError("暂时无法连接翻译服务，请稍后重试");
      } finally {
        if (!controller.signal.aborted) setTranslating(false);
      }
    }, translationMode === "instant" ? 550 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [languageCode, manualRequest, myMemoryEmail, recordQuotaUsage, translationMode, translationSide, translationText]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRate() {
      setRateLoading(true);
      setRateError("");
      try {
        const response = await fetch(`https://open.er-api.com/v6/latest/${currencyCode}`, { signal: controller.signal });
        if (!response.ok) throw new Error("rate unavailable");
        const data = (await response.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
        const nextRate = data.rates?.CNY;
        if (data.result !== "success" || typeof nextRate !== "number") throw new Error("invalid rate");
        setRate(nextRate);
        setRateUpdated(data.time_last_update_utc ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(data.time_last_update_utc)) : "刚刚");
        const amount = Number(foreignAmount.replace(/,/g, ""));
        if (Number.isFinite(amount)) setCnyAmount(formatMoney(amount * nextRate));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setRateError("汇率更新失败，请稍后重试");
      } finally {
        if (!controller.signal.aborted) setRateLoading(false);
      }
    }
    void loadRate();
    return () => controller.abort();
    // foreignAmount intentionally excluded: currency change refreshes using current value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyCode]);

  const handleText = (side: Side, value: string) => {
    setActiveSide(side);
    if (side === "left") setLeftText(value.slice(0, 5000));
    else setRightText(value.slice(0, 5000));
  };

  const chooseTranslationMode = (mode: TranslationMode) => {
    setTranslationMode(mode);
    setManualRequest(null);
    window.localStorage.setItem(TRANSLATION_MODE_KEY, mode);
  };

  const handleTranslationKeyDown = (side: Side, event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (translationMode !== "enter" || event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    const text = side === "left" ? leftText : rightText;
    setActiveSide(side);
    setManualRequest({ id: Date.now(), side, text });
  };

  const copyText = async (side: Side) => {
    const text = side === "left" ? leftText : rightText;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(side);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const clearAll = () => {
    setLeftText("");
    setRightText("");
    setTranslationError("");
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
  };

  const speak = (side: Side) => {
    const text = side === "left" ? leftText : rightText;
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = side === "left" ? language.locale : "zh-CN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const startListening = (side: Side) => {
    setSpeechMessage("");
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage("当前浏览器不支持语音识别，建议使用最新版 Chrome 或 Edge");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = side === "left" ? language.locale : "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => handleText(side, event.results[0][0].transcript);
    recognition.onend = () => setListening(null);
    recognition.onerror = () => {
      setListening(null);
      setSpeechMessage("没有听清，请检查麦克风权限后重试");
    };
    recognitionRef.current = recognition;
    setListening(side);
    recognition.start();
  };

  const processImage = useCallback(async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      setTranslationError("图片不能超过 10MB");
      return;
    }
    if (image) URL.revokeObjectURL(image.url);
    const imageUrl = URL.createObjectURL(file);
    setImage({ name: file.name, url: imageUrl });
    setOcrProgress(0);
    setTranslationError("");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(language.ocr, 1, {
        logger: (message) => {
          if (typeof message.progress === "number") setOcrProgress(Math.round(message.progress * 100));
        },
      });
      const result = await worker.recognize(file);
      await worker.terminate();
      handleText("left", result.data.text.trim());
      if (!result.data.text.trim()) setTranslationError("没有识别到清晰文字，请尝试更清楚的图片");
    } catch {
      setTranslationError("图片文字识别失败，请检查网络后重试");
    } finally {
      setOcrProgress(null);
    }
  }, [image, language.ocr]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void processImage(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void processImage(event.dataTransfer.files?.[0]);
  };

  const changeForeignAmount = (value: string) => {
    setForeignAmount(value);
    if (rate !== null) {
      const numeric = Number(value.replace(/,/g, ""));
      setCnyAmount(Number.isFinite(numeric) ? formatMoney(numeric * rate) : "");
    }
  };

  const changeCnyAmount = (value: string) => {
    setCnyAmount(value);
    if (rate) {
      const numeric = Number(value.replace(/,/g, ""));
      setForeignAmount(Number.isFinite(numeric) ? formatMoney(numeric / rate) : "");
    }
  };

  const chooseCurrency = (code: string) => {
    setCurrencyCode(code);
    window.localStorage.setItem(PREFERRED_CURRENCY_KEY, code);
    setCurrencyOpen(false);
  };

  const chooseLanguage = (code: string) => {
    setLanguageCode(code);
    window.localStorage.setItem(PREFERRED_LANGUAGE_KEY, code);
    setLanguageOpen(false);
  };

  const saveMyMemoryEmail = () => {
    const normalized = emailDraft.trim();
    if (normalized && !/^\S+@\S+\.\S+$/.test(normalized)) {
      setSettingsMessage("请输入有效邮箱，或留空使用匿名额度");
      return;
    }
    setMyMemoryEmail(normalized);
    if (normalized) window.localStorage.setItem(MYMEMORY_EMAIL_KEY, normalized);
    else window.localStorage.removeItem(MYMEMORY_EMAIL_KEY);
    setSettingsMessage(normalized ? "已保存在本机，当前额度约 50,000 字符/天" : "已切换为匿名额度：约 5,000 字符/天");
  };

  const chooseTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_KEY, nextTheme);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="译刻首页">
          <span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span>
          <span>译刻</span>
        </a>
        <div className="topbar-actions">
          <span className="status-pill"><i /> 实时翻译已就绪</span>
          <button className="user-avatar" onClick={() => setSettingsOpen(true)} aria-label="打开用户设置"><UserRound size={19} /></button>
          <button className="quota-pill" onClick={() => setSettingsOpen(true)} aria-label={`参考剩余额度 ${quotaRemaining.toLocaleString()} 字符`}><span>参考剩余</span><b>{quotaRemaining.toLocaleString()}</b></button>
        </div>
      </header>

      {settingsOpen && (
        <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <aside className="settings-panel" role="dialog" aria-modal="true" aria-label="用户设置">
            <div className="settings-header"><div><span className="settings-avatar"><UserRound size={22} /></span><span><b>本机访客</b><small>无需登录 · 数据保存在此设备</small></span></div><button onClick={() => setSettingsOpen(false)} aria-label="关闭用户设置"><X size={18} /></button></div>

            <section className="settings-section">
              <div className="settings-title"><UserRound size={16} /><b>账户切换</b></div>
              <button className="account-row selected"><span className="mini-avatar">访</span><span><b>本机访客</b><small>当前账户 · 无服务器账号</small></span><Check size={16} /></button>
              <button className="account-row" disabled><span className="mini-avatar muted"><KeyRound size={14} /></span><span><b>API 账户</b><small>以后可连接 DeepSeek、豆包等自有 API</small></span><em>规划中</em></button>
            </section>

            <section className="settings-section">
              <div className="settings-title"><Mail size={16} /><b>MyMemory 翻译额度</b></div>
              <div className="quota-grid"><div className={!myMemoryEmail ? "active" : ""}><b>5,000</b><span>字符/天</span><small>匿名使用，不填邮箱</small></div><div className={myMemoryEmail ? "active" : ""}><b>50,000</b><span>字符/天</span><small>填写有效邮箱后</small></div></div>
              <div className="quota-live"><span><i /> 本机今日参考剩余</span><b>{quotaRemaining.toLocaleString()} 字符</b></div>
              <label className="email-setting"><span>MyMemory 联系邮箱（可选）</span><div><input type="email" value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="your@email.com" autoComplete="email" /><button onClick={saveMyMemoryEmail}>保存</button></div></label>
              <p className="privacy-note"><ShieldCheck size={14} /> 邮箱只保存在当前设备，并由此设备直接发送给 MyMemory；译刻不接收、不上传。</p>
              <p className="quota-disclaimer">仅供参考：按本机译刻今天实际发送的字符计算。MyMemory 不提供精确余额接口；同一网络或其他软件产生的用量不会显示在这里，服务方实际剩余额度可能更少。</p>
              {settingsMessage && <p className="settings-message">{settingsMessage}</p>}
            </section>

            <section className="settings-section">
              <div className="settings-title"><Palette size={16} /><b>主题颜色</b></div>
              <div className="theme-options">{([['mint','翡翠'],['ocean','海蓝'],['sunset','暖橙']] as [Theme,string][]).map(([value,label]) => <button key={value} className={theme === value ? `theme-${value} selected` : `theme-${value}`} onClick={() => chooseTheme(value)}><i />{label}{theme === value && <Check size={14} />}</button>)}</div>
            </section>

            <div className="settings-footer"><Settings size={14} /> 当前登录方式：无需登录。本机设置不会同步到其他设备。</div>
          </aside>
        </div>
      )}

      <section className="hero-copy">
        <p className="eyebrow">TRANSLATE IN THE MOMENT</p>
        <h1>所想，即刻相通。</h1>
        <p>文字、声音或图片，让每一次表达自然抵达。</p>
      </section>

      <section className="translator-card" aria-label="实时翻译">
        <div className="language-bar">
          <div className="select-wrap">
            <button className="language-select" onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen}>
              <span>{language.name}</span><small>{language.native}</small><ChevronDown size={15} />
            </button>
            {languageOpen && (
              <div className="select-menu language-menu">
                {LANGUAGES.map((item) => (
                  <button key={item.code} onClick={() => chooseLanguage(item.code)} className={item.code === languageCode ? "selected" : ""}>
                    <span>{item.name}<small>{item.native}</small></span>{item.code === languageCode && <Check size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={`flow-icon ${translating ? "working" : ""}`}><ArrowRightLeft size={17} /></span>
          <div className="language-fixed">中文 <span>固定</span></div>
        </div>

        <div className="translation-mode-bar">
          <span>翻译方式</span>
          <div role="group" aria-label="选择翻译方式">
            <button className={translationMode === "instant" ? "selected" : ""} onClick={() => chooseTranslationMode("instant")}><Zap size={13} /> 输入后翻译</button>
            <button className={translationMode === "enter" ? "selected" : ""} onClick={() => chooseTranslationMode("enter")}><CornerDownLeft size={13} /> 回车后翻译</button>
          </div>
          <small>{translationMode === "enter" ? "Shift + Enter 可换行" : "停止输入后自动翻译"}</small>
        </div>

        <div className="translation-grid">
          <div className={`translation-pane source-pane ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <textarea value={leftText} onChange={(event) => handleText("left", event.target.value)} onKeyDown={(event) => handleTranslationKeyDown("left", event)} aria-label={`输入${language.name}`} placeholder="输入文字，或试试语音和图片…" />
            {image && (
              <div className="image-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="待识别图片预览" />
                <span>{ocrProgress === null ? image.name : `正在识别 ${ocrProgress}%`}</span>
                {ocrProgress !== null && <LoaderCircle size={14} className="spin" />}
                <button aria-label="移除图片" onClick={() => { URL.revokeObjectURL(image.url); setImage(null); }}><X size={14} /></button>
              </div>
            )}
            {dragging && <div className="drop-overlay"><Upload size={24} /><b>松开即可识别图片</b></div>}
            <div className="pane-actions">
              <button className={listening === "left" ? "active" : ""} onClick={() => startListening("left")} aria-label="外语语音输入"><Mic size={19} /></button>
              <button onClick={() => fileInputRef.current?.click()} aria-label="上传图片"><ImagePlus size={19} /></button>
              <button onClick={() => speak("left")} aria-label="朗读外语"><Volume2 size={19} /></button>
              <button onClick={() => copyText("left")} aria-label="复制外语">{copied === "left" ? <Check size={18} /> : <Copy size={18} />}</button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} hidden />
              <span>{leftText.length.toLocaleString()} / 5,000</span>
            </div>
          </div>

          <div className="translation-pane result-pane">
            <textarea value={rightText} onChange={(event) => handleText("right", event.target.value)} onKeyDown={(event) => handleTranslationKeyDown("right", event)} aria-label="输入中文" placeholder="中文翻译会实时显示在这里" />
            {translating && <span className="translating-label"><LoaderCircle size={13} className="spin" /> 翻译中</span>}
            <div className="pane-actions">
              <button className={listening === "right" ? "active" : ""} onClick={() => startListening("right")} aria-label="中文语音输入"><Mic size={19} /></button>
              <button onClick={() => speak("right")} aria-label="朗读中文"><Volume2 size={19} /></button>
              <button onClick={() => copyText("right")} aria-label="复制中文">{copied === "right" ? <Check size={18} /> : <Copy size={18} />}</button>
              <button onClick={clearAll} aria-label="清空内容"><Trash2 size={18} /></button>
              <span>{rightText.length.toLocaleString()} / 5,000</span>
            </div>
          </div>
        </div>
        {(translationError || speechMessage) && <div className="inline-message">{translationError || speechMessage}</div>}
      </section>

      <section className="rates-section" aria-label="实时汇率换算">
        <div className="section-heading">
          <div><p className="eyebrow">LIVE EXCHANGE RATE</p><h2>实时汇率</h2></div>
          <div className="rate-meta"><i /> {rateLoading ? "正在更新…" : rateUpdated ? `更新于 ${rateUpdated}` : "实时数据"}</div>
        </div>
        <div className="rates-card">
          <div className="currency-headings">
            <div className="select-wrap">
              <button className="currency-select" onClick={() => setCurrencyOpen((open) => !open)} aria-expanded={currencyOpen}>
                <span className="flag">{currency.flag}</span><span><b>{currency.country}</b><small>{currency.code}</small></span><ChevronDown size={16} />
              </button>
              {currencyOpen && (
                <div className="select-menu currency-menu">
                  {CURRENCIES.map((item) => (
                    <button key={item.code} onClick={() => chooseCurrency(item.code)} className={item.code === currencyCode ? "selected" : ""}>
                      <span className="flag">{item.flag}</span><span><b>{item.country}</b><small>{item.code}</small></span>{item.code === currencyCode && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rate-center">{rate ? `1 ${currencyCode} = ${rate.toFixed(4)} CNY` : "—"}</div>
            <div className="china-label"><span className="flag">🇨🇳</span><span><b>中国</b><small>CNY</small></span></div>
          </div>
          <div className="currency-inputs">
            <label><span>{currency.symbol}</span><input value={foreignAmount} onChange={(event) => changeForeignAmount(event.target.value)} inputMode="decimal" aria-label={`${currencyCode}金额`} /></label>
            <span className="equals">=</span>
            <label><span>¥</span><input value={cnyAmount} onChange={(event) => changeCnyAmount(event.target.value)} inputMode="decimal" aria-label="人民币金额" /></label>
          </div>
          {rateError && <div className="inline-message rate-error">{rateError}</div>}
          <a className="rate-attribution" href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a>
        </div>
      </section>

      <footer><span>译刻 · 简单而准确的沟通工具</span><span><Clipboard size={14} /> 图片仅在当前设备处理</span></footer>
    </main>
  );
}
