import { NextRequest, NextResponse } from "next/server";

const MAX_LENGTH = 5000;
const CHUNK_LENGTH = 420;

function decodeEntities(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function chunkText(text: string) {
  const chunks: string[] = [];
  for (const line of text.split("\n")) {
    if (!line) {
      chunks.push("\n");
      continue;
    }
    for (let index = 0; index < line.length; index += CHUNK_LENGTH) {
      chunks.push(line.slice(index, index + CHUNK_LENGTH));
    }
    chunks.push("\n");
  }
  if (chunks.at(-1) === "\n") chunks.pop();
  return chunks;
}

async function translateChunk(text: string, source: string, target: string) {
  if (text === "\n") return text;
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${source}|${target}`);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Translation provider unavailable");
  const data = (await response.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  };
  if (data.responseStatus && data.responseStatus >= 400) throw new Error("Translation rejected");
  return decodeEntities(data.responseData?.translatedText ?? "");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { text?: unknown; source?: unknown; target?: unknown };
    if (typeof body.text !== "string" || typeof body.source !== "string" || typeof body.target !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const text = body.text.slice(0, MAX_LENGTH);
    if (!text.trim()) return NextResponse.json({ translatedText: "" });
    const chunks = chunkText(text);
    const translated: string[] = [];
    for (const chunk of chunks) translated.push(await translateChunk(chunk, body.source, body.target));
    return NextResponse.json({ translatedText: translated.join("") });
  } catch {
    return NextResponse.json({ error: "Translation unavailable" }, { status: 502 });
  }
}
