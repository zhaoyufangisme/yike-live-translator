"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, jsx-a11y/no-static-element-interactions */

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
  Mic,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  Wifi,
  HardDrive,
  RefreshCw,
  History,
  Download,
  ExternalLink,
  X,
  Zap,
} from "lucide-react";
import { ChangeEvent, DragEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getProviderQuota,
  installArgosPackage,
  listArgosPackages,
  loadProviderConfig,
  PROVIDERS,
  ProviderConfig,
  ProviderId,
  ProviderResult,
  QuotaResult,
  saveProviderConfig,
  testProvider,
  translateWithProvider,
  type ArgosPackage,
} from "./providers";

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
const TRANSLATION_MODE_KEY = "yike-translation-mode";
const PROVIDER_KEY = "yike-provider-v2";
const HISTORY_KEY = "yike-translation-history-v2";
const HISTORY_ENABLED_KEY = "yike-history-enabled-v2";
const UPDATE_CHECK_KEY = "yike-update-check-v2";
const APP_VERSION = "0.2.0";
const RELEASE_API = "https://api.github.com/repos/zhaoyufangisme/yike-live-translator/releases/latest";
function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("zh-CN", { maximumFractionDigits: 4 }) : "";
}

function isNewerVersion(remote: string, current: string) {
  const parse = (value: string) => value.replace(/^v/, "").split("-")[0].split(".").map((part) => Number(part) || 0);
  const a = parse(remote); const b = parse(current);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) > (b[index] ?? 0);
  }
  return false;
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
  const [image, setImage] = useState<{ name: string; url: string; side: Side } | null>(null);
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
  const [emailDraft, setEmailDraft] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [theme, setTheme] = useState<Theme>("mint");
  const [provider, setProvider] = useState<ProviderId>("argos");
  const [providerOpen, setProviderOpen] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({ deepseekModel: "deepseek-v4-flash", doubaoModel: "doubao-seed-2-0-lite-260215", doubaoEndpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions" });
  const [executedProvider, setExecutedProvider] = useState<ProviderResult | null>(null);
  const [quota, setQuota] = useState<QuotaResult | null>(null);
  const [providerTesting, setProviderTesting] = useState<ProviderId | null>(null);
  const [history, setHistory] = useState<{ id: string; source: string; target: string; provider: ProviderId; createdAt: string }[]>([]);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [argosPackages, setArgosPackages] = useState<ArgosPackage[]>([]);
  const [latestRelease, setLatestRelease] = useState<{ tag: string; url: string; body: string; publishedAt: string } | null>(null);
  const [updateCheckEnabled, setUpdateCheckEnabled] = useState(true);
  const [runtime, setRuntime] = useState<"web" | "windows" | "android">("web");
  const [translationMode, setTranslationMode] = useState<TranslationMode>("instant");
  const [manualRequest, setManualRequest] = useState<{ id: number; side: Side; text: string } | null>(null);
  const leftFileInputRef = useRef<HTMLInputElement>(null);
  const rightFileInputRef = useRef<HTMLInputElement>(null);
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
    const savedTranslationMode = window.localStorage.getItem(TRANSLATION_MODE_KEY);
    const savedProvider = window.localStorage.getItem(PROVIDER_KEY) as ProviderId | null;
    const savedHistory = window.localStorage.getItem(HISTORY_KEY);
    const savedHistoryEnabled = window.localStorage.getItem(HISTORY_ENABLED_KEY);
    const savedUpdateCheck = window.localStorage.getItem(UPDATE_CHECK_KEY);
    setEmailDraft(savedEmail);
    if (["mint", "ocean", "sunset"].includes(savedTheme)) {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    }
    if (savedLanguage && LANGUAGES.some((item) => item.code === savedLanguage)) setLanguageCode(savedLanguage);
    if (savedTranslationMode === "instant" || savedTranslationMode === "enter") setTranslationMode(savedTranslationMode);
    if (savedProvider && Object.hasOwn(PROVIDERS, savedProvider)) setProvider(savedProvider);
    if (savedHistoryEnabled === "false") setHistoryEnabled(false);
    if (savedUpdateCheck === "false") setUpdateCheckEnabled(false);
    if (savedHistory) try { setHistory(JSON.parse(savedHistory)); } catch { window.localStorage.removeItem(HISTORY_KEY); }
    void loadProviderConfig().then((config) => {
      setProviderConfig((current) => ({ ...current, ...config }));
      setEmailDraft(config.mymemoryEmail ?? "");
    });
    void listArgosPackages().then(setArgosPackages).catch(() => undefined);
    if (window.yikeNative) setRuntime("windows");
    else void import("@capacitor/core").then(({ Capacitor }) => { if (Capacitor.isNativePlatform()) setRuntime("android"); });
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
        const result = await translateWithProvider(
          provider,
          translationText,
          translationSide === "left" ? languageCode : "zh-CN",
          translationSide === "left" ? "zh-CN" : languageCode,
          providerConfig,
          controller.signal,
        );
        if (translationSide === "left") setRightText(result.text);
        else setLeftText(result.text);
        setExecutedProvider(result);
        if (historyEnabled) {
          setHistory((current) => {
            const next = [{ id: crypto.randomUUID(), source: translationText, target: result.text, provider: result.provider, createdAt: result.checkedAt }, ...current].slice(0, 100);
            window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
            return next;
          });
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") setTranslationError((error as Error).message || `${PROVIDERS[provider].name} 翻译失败`);
      } finally {
        if (!controller.signal.aborted) setTranslating(false);
      }
    }, translationMode === "instant" ? 550 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [historyEnabled, languageCode, manualRequest, provider, providerConfig, translationMode, translationSide, translationText]);

  const refreshQuota = useCallback(async (selected: ProviderId = provider) => {
    try { setQuota(await getProviderQuota(selected, providerConfig)); }
    catch (error) { setQuota({ kind: "unavailable", title: "查询失败", detail: (error as Error).message, source: `${PROVIDERS[selected].name} 官方服务` }); }
  }, [provider, providerConfig]);

  useEffect(() => { void refreshQuota(provider); }, [provider, refreshQuota]);

  useEffect(() => {
    if (!updateCheckEnabled) return;
    const controller = new AbortController();
    void fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" }, signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data: { tag_name?: string; html_url?: string; body?: string; published_at?: string }) => {
        if (data.tag_name && data.html_url) setLatestRelease({ tag: data.tag_name, url: data.html_url, body: data.body ?? "", publishedAt: data.published_at ?? "" });
      }).catch(() => undefined);
    return () => controller.abort();
  }, [updateCheckEnabled]);

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

  const processImage = useCallback(async (side: Side, file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      setTranslationError("图片不能超过 10MB");
      return;
    }
    if (image) URL.revokeObjectURL(image.url);
    const imageUrl = URL.createObjectURL(file);
    setImage({ name: file.name, url: imageUrl, side });
    setOcrProgress(0);
    setTranslationError("");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(side === "left" ? language.ocr : "chi_sim", 1, {
        logger: (message) => {
          if (typeof message.progress === "number") setOcrProgress(Math.round(message.progress * 100));
        },
      });
      const result = await worker.recognize(file);
      await worker.terminate();
      const recognizedText = result.data.text.trim();
      handleText(side, recognizedText);
      if (translationMode === "enter" && recognizedText) setManualRequest({ id: Date.now(), side, text: recognizedText });
      if (!recognizedText) setTranslationError("没有识别到清晰文字，请尝试更清楚的图片");
    } catch {
      setTranslationError("图片文字识别失败，请检查网络后重试");
    } finally {
      setOcrProgress(null);
    }
  }, [image, language.ocr, translationMode]);

  const onFileChange = (side: Side, event: ChangeEvent<HTMLInputElement>) => {
    void processImage(side, event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void processImage("left", event.dataTransfer.files?.[0]);
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
    const next = { ...providerConfig, mymemoryEmail: normalized };
    setProviderConfig(next);
    void saveProviderConfig(next);
    if (normalized) window.localStorage.setItem(MYMEMORY_EMAIL_KEY, normalized); else window.localStorage.removeItem(MYMEMORY_EMAIL_KEY);
    setSettingsMessage(normalized ? "邮箱已保存在本机。实际剩余额度无法由官方接口实时查询。" : "已切换为匿名方式。实际剩余额度无法由官方接口实时查询。");
  };

  const chooseProvider = (nextProvider: ProviderId) => {
    setProvider(nextProvider);
    setProviderOpen(false);
    setExecutedProvider(null);
    setTranslationError("");
    window.localStorage.setItem(PROVIDER_KEY, nextProvider);
  };

  const updateProviderConfig = (key: keyof ProviderConfig, value: string) => setProviderConfig((current) => ({ ...current, [key]: value }));

  const persistProviderConfig = async () => {
    await saveProviderConfig(providerConfig);
    const { Capacitor } = await import("@capacitor/core");
    setSettingsMessage(window.yikeNative || Capacitor.isNativePlatform() ? "配置已使用系统安全存储保存在本机" : "网页端普通配置保存在本机；密钥仅保留到本次浏览器会话结束");
  };

  const runProviderTest = async (selected: ProviderId) => {
    setProviderTesting(selected);
    setSettingsMessage("");
    try {
      await saveProviderConfig(providerConfig);
      const result = await testProvider(selected, providerConfig);
      setSettingsMessage(`${PROVIDERS[selected].name} 可用 · 实际返回模型/服务：${result.model || PROVIDERS[selected].name}`);
      await refreshQuota(selected);
    } catch (error) {
      setSettingsMessage((error as Error).message || `${PROVIDERS[selected].name} 连接失败`);
    } finally { setProviderTesting(null); }
  };

  const downloadArgos = async () => {
    setSettingsMessage(`正在下载并安装 ${languageCode} ↔ zh 离线语言包，请勿关闭软件…`);
    try {
      let packages = await installArgosPackage(languageCode, "zh");
      packages = await installArgosPackage("zh", languageCode);
      setArgosPackages(packages);
      setSettingsMessage("Argos 离线语言包安装完成，可断网翻译");
    } catch (error) { setSettingsMessage((error as Error).message); }
  };

  const clearHistory = () => { setHistory([]); window.localStorage.removeItem(HISTORY_KEY); };

  const chooseTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_KEY, nextTheme);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="译刻首页">
          <span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span>
          <span>译刻</span>
        </div>
        <div className="topbar-actions">
          <span className="status-pill"><i /> {PROVIDERS[provider].name}</span>
          <button className="user-avatar" onClick={() => setSettingsOpen(true)} aria-label="打开用户设置"><UserRound size={19} /></button>
          <button className="quota-pill" onClick={() => setSettingsOpen(true)} aria-label="查看真实额度状态"><span>额度</span><b>{quota?.kind === "balance" ? quota.title.replace("账户余额：", "") : "查看说明"}</b></button>
        </div>
      </header>

      {settingsOpen && (
        <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <aside className="settings-panel" role="dialog" aria-modal="true" aria-label="用户设置">
            <div className="settings-header"><div><span className="settings-avatar"><UserRound size={22} /></span><span><b>本机访客</b><small>无需登录 · 数据保存在此设备</small></span></div><button onClick={() => setSettingsOpen(false)} aria-label="关闭用户设置"><X size={18} /></button></div>

            <section className="settings-section">
              <div className="settings-title"><KeyRound size={16} /><b>翻译引擎与用户 API</b></div>
              <p className="privacy-note"><ShieldCheck size={14} /> 无需译刻账号。安装版密钥使用系统安全存储，API 请求由用户设备直连官方服务，不经过开发者服务器。</p>
              <div className="provider-settings-list">
                {(Object.keys(PROVIDERS) as ProviderId[]).map((item) => (
                  <button key={item} className={`account-row ${provider === item ? "selected" : ""}`} onClick={() => chooseProvider(item)}>
                    <span className="mini-avatar">{item === "argos" ? <HardDrive size={14} /> : <Wifi size={14} />}</span>
                    <span><b>{PROVIDERS[item].name}</b><small>{PROVIDERS[item].description}</small></span>
                    {provider === item && <Check size={16} />}
                  </button>
                ))}
              </div>

              {provider === "argos" && <div className="provider-config-box">
                <b>离线语言包：{language.name} ↔ 中文</b>
                <p>{argosPackages.some((item) => item.installed && ((item.fromCode === languageCode && item.toCode === "zh") || (item.fromCode === "zh" && item.toCode === languageCode))) ? "已检测到部分或完整语言包" : "缺少离线语言包"}</p>
                <button className="settings-action" onClick={downloadArgos}><Download size={14} /> 下载并安装双向语言包</button>
                <small>真实 .argosmodel 语言包仅在 Windows 安装版内管理；网页端不会模拟离线翻译。</small>
              </div>}

              {provider === "mymemory" && <div className="provider-config-box">
                <label className="email-setting"><span>联系邮箱（可选）</span><div><input type="email" value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="your@email.com" autoComplete="email" /><button onClick={saveMyMemoryEmail}>保存</button></div></label>
                <small>仅按 MyMemory 官方 `de` 参数从本机发送。实际剩余额度：官方接口暂不支持实时查询。</small>
              </div>}

              {provider === "baidu" && <div className="provider-config-box api-fields">
                <label>APP ID<input value={providerConfig.baiduAppId ?? ""} onChange={(event) => updateProviderConfig("baiduAppId", event.target.value)} /></label>
                <label>密钥<input type="password" value={providerConfig.baiduSecret ?? ""} onChange={(event) => updateProviderConfig("baiduSecret", event.target.value)} /></label>
              </div>}

              {provider === "deepseek" && <div className="provider-config-box api-fields">
                <label>API Key<input type="password" value={providerConfig.deepseekApiKey ?? ""} onChange={(event) => updateProviderConfig("deepseekApiKey", event.target.value)} /></label>
                <label>当前模型<input value={providerConfig.deepseekModel ?? "deepseek-v4-flash"} onChange={(event) => updateProviderConfig("deepseekModel", event.target.value)} /></label>
              </div>}

              {provider === "doubao" && <div className="provider-config-box api-fields">
                <label>火山方舟 API Key<input type="password" value={providerConfig.doubaoApiKey ?? ""} onChange={(event) => updateProviderConfig("doubaoApiKey", event.target.value)} /></label>
                <label>Model ID<input value={providerConfig.doubaoModel ?? "doubao-seed-2-0-lite-260215"} onChange={(event) => updateProviderConfig("doubaoModel", event.target.value)} /></label>
                <label>Endpoint<input value={providerConfig.doubaoEndpoint ?? "https://ark.cn-beijing.volces.com/api/v3/chat/completions"} onChange={(event) => updateProviderConfig("doubaoEndpoint", event.target.value)} /></label>
              </div>}

              {provider !== "argos" && <div className="settings-button-row"><button className="settings-action" onClick={persistProviderConfig}>保存配置</button><button className="settings-action secondary" disabled={providerTesting === provider} onClick={() => runProviderTest(provider)}>{providerTesting === provider ? <LoaderCircle className="spin" size={14} /> : <Wifi size={14} />} 测试真实连接</button></div>}
            </section>

            <section className="settings-section">
              <div className="settings-title"><RefreshCw size={16} /><b>额度与用量</b><button className="inline-refresh" onClick={() => refreshQuota()}><RefreshCw size={13} /> 刷新</button></div>
              <div className="quota-truth"><b>{quota?.title ?? "正在查询…"}</b><span>{quota?.detail}</span><small>数据来源：{quota?.source ?? PROVIDERS[provider].name}{quota?.checkedAt ? ` · 上次查询 ${new Date(quota.checkedAt).toLocaleString("zh-CN")}` : ""}</small></div>
              <p className="quota-disclaimer">只把官方接口返回的数据标为真实余额。无法查询时会明确说明，不再用本地计数冒充剩余额度。</p>
            </section>

            <section className="settings-section">
              <div className="settings-title"><History size={16} /><b>翻译历史</b></div>
              <label className="toggle-row"><span>在本机保存历史<small>关闭后不再保存新的翻译内容</small></span><input type="checkbox" checked={historyEnabled} onChange={(event) => { setHistoryEnabled(event.target.checked); localStorage.setItem(HISTORY_ENABLED_KEY, String(event.target.checked)); }} /></label>
              <div className="history-actions"><span>本机已有 {history.length} 条</span><button onClick={clearHistory}><Trash2 size={13} /> 清空历史</button></div>
              <div className="history-list">{history.slice(0, 5).map((item) => <div key={item.id}><b>{PROVIDERS[item.provider].name}</b><span>{item.source}</span><small>{item.target}</small><button onClick={() => { const next = history.filter((entry) => entry.id !== item.id); setHistory(next); localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); }} aria-label="删除这条历史"><X size={12} /></button></div>)}</div>
            </section>

            <section className="settings-section">
              <div className="settings-title"><Download size={16} /><b>版本与更新</b>{latestRelease && isNewerVersion(latestRelease.tag, APP_VERSION) && <em className="new-badge">NEW</em>}</div>
              <div className="version-row"><span>当前版本：v{APP_VERSION}</span><span>最新版本：{latestRelease?.tag ?? "暂未查询到"}</span></div>
              <label className="toggle-row"><span>启动时检查新版本<small>仅访问公开 GitHub Release，不会强制更新</small></span><input type="checkbox" checked={updateCheckEnabled} onChange={(event) => { setUpdateCheckEnabled(event.target.checked); localStorage.setItem(UPDATE_CHECK_KEY, String(event.target.checked)); }} /></label>
              {latestRelease && <a className="settings-action update-link" href={latestRelease.url} target="_blank" rel="noreferrer">查看 Release Notes 与下载 <ExternalLink size={14} /></a>}
            </section>

            <section className="settings-section">
              <div className="settings-title"><ShieldCheck size={16} /><b>隐私与数据</b></div>
              <p className="privacy-copy"><b>Argos：</b>文本仅在本机处理。<br/><b>MyMemory：</b>文本及可选邮箱发送给 MyMemory。<br/><b>百度：</b>文本发送给百度翻译官方 API。<br/><b>DeepSeek：</b>文本发送给 DeepSeek 官方 API。<br/><b>豆包：</b>文本发送给火山方舟官方 API。<br/>译刻开发者默认不接收翻译文本、密钥或历史。</p>
            </section>

            {settingsMessage && <p className="settings-message settings-global-message">{settingsMessage}</p>}

            <section className="settings-section">
              <div className="settings-title"><Palette size={16} /><b>主题颜色</b></div>
              <div className="theme-options">{([['mint','翡翠'],['ocean','海蓝'],['sunset','暖橙']] as [Theme,string][]).map(([value,label]) => <button key={value} className={theme === value ? `theme-${value} selected` : `theme-${value}`} onClick={() => chooseTheme(value)}><i />{label}{theme === value && <Check size={14} />}</button>)}</div>
            </section>

            <div className="settings-footer"><Settings size={14} /> 无需登录 · 无会员或支付 · 数据默认仅保存在本机。</div>
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

        <div className="provider-bar">
          <span>翻译引擎</span>
          <div className="select-wrap provider-select-wrap">
            <button className="provider-select" onClick={() => setProviderOpen((open) => !open)} aria-expanded={providerOpen}>
              {provider === "argos" ? <HardDrive size={15} /> : <Wifi size={15} />}
              <b>{PROVIDERS[provider].name}</b>
              {PROVIDERS[provider].model && <small>{provider === "deepseek" ? providerConfig.deepseekModel : provider === "doubao" ? providerConfig.doubaoModel : PROVIDERS[provider].model}</small>}
              <ChevronDown size={14} />
            </button>
            {providerOpen && <div className="select-menu provider-menu">{(Object.keys(PROVIDERS) as ProviderId[]).map((item) => <button key={item} onClick={() => chooseProvider(item)} className={provider === item ? "selected" : ""}><span><b>{PROVIDERS[item].name}</b><small>{item === "argos" ? "本地离线" : item === "mymemory" ? "免费在线备用" : item === "baidu" ? (providerConfig.baiduAppId ? "已配置" : "未配置") : item === "deepseek" ? (providerConfig.deepseekApiKey ? "已配置" : "未配置") : (providerConfig.doubaoApiKey ? "已配置" : "未配置")}</small></span>{provider === item && <Check size={14} />}</button>)}</div>}
          </div>
          <small className="executed-provider">{executedProvider ? `本次实际执行：${PROVIDERS[executedProvider.provider].name}${executedProvider.model ? ` · ${executedProvider.model}` : ""}` : provider === "argos" && runtime === "web" ? "网页端不模拟离线引擎，请下载客户端" : provider === "argos" && runtime === "android" ? "Android v0.2.0 暂不提供 Argos 运行时" : "等待翻译"}</small>
          <button className="provider-settings-button" onClick={() => setSettingsOpen(true)}><Settings size={14} /> 配置</button>
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
            {image?.side === "left" && (
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
              <button onClick={() => leftFileInputRef.current?.click()} aria-label="上传外语图片"><ImagePlus size={19} /></button>
              <button onClick={() => speak("left")} aria-label="朗读外语"><Volume2 size={19} /></button>
              <button onClick={() => copyText("left")} aria-label="复制外语">{copied === "left" ? <Check size={18} /> : <Copy size={18} />}</button>
              <input ref={leftFileInputRef} type="file" accept="image/*" onChange={(event) => onFileChange("left", event)} hidden />
              <span>{leftText.length.toLocaleString()} / 5,000</span>
            </div>
          </div>

          <div className="translation-pane result-pane">
            <textarea value={rightText} onChange={(event) => handleText("right", event.target.value)} onKeyDown={(event) => handleTranslationKeyDown("right", event)} aria-label="输入中文" placeholder="中文翻译会实时显示在这里" />
            {image?.side === "right" && (
              <div className="image-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="待识别中文图片预览" />
                <span>{ocrProgress === null ? image.name : `正在识别中文 ${ocrProgress}%`}</span>
                {ocrProgress !== null && <LoaderCircle size={14} className="spin" />}
                <button aria-label="移除中文图片" onClick={() => { URL.revokeObjectURL(image.url); setImage(null); }}><X size={14} /></button>
              </div>
            )}
            {translating && <span className="translating-label"><LoaderCircle size={13} className="spin" /> 翻译中</span>}
            <div className="pane-actions">
              <button className={listening === "right" ? "active" : ""} onClick={() => startListening("right")} aria-label="中文语音输入"><Mic size={19} /></button>
              <button onClick={() => rightFileInputRef.current?.click()} aria-label="上传中文图片"><ImagePlus size={19} /></button>
              <button onClick={() => speak("right")} aria-label="朗读中文"><Volume2 size={19} /></button>
              <button onClick={() => copyText("right")} aria-label="复制中文">{copied === "right" ? <Check size={18} /> : <Copy size={18} />}</button>
              <button onClick={clearAll} aria-label="清空内容"><Trash2 size={18} /></button>
              <input ref={rightFileInputRef} type="file" accept="image/*" onChange={(event) => onFileChange("right", event)} hidden />
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
