import { NextRequest, NextResponse } from "next/server";

const ALLOWED = new Set(["USD", "EUR", "GBP", "JPY", "KRW", "HKD", "SGD", "MYR", "PHP", "THB", "AUD", "CAD"]);

export async function GET(request: NextRequest) {
  const base = request.nextUrl.searchParams.get("base")?.toUpperCase() ?? "USD";
  if (!ALLOWED.has(base)) return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error("Rate provider unavailable");
    const data = (await response.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    const rate = data.rates?.CNY;
    if (data.result !== "success" || typeof rate !== "number") throw new Error("Invalid rate response");
    const updated = data.time_last_update_utc
      ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(data.time_last_update_utc))
      : "刚刚";
    return NextResponse.json({ rate, updated });
  } catch {
    return NextResponse.json({ error: "Rate unavailable" }, { status: 502 });
  }
}
