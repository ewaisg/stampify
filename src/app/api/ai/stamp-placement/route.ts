import { NextRequest, NextResponse } from "next/server";
import type { AIProviderConfig } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

interface PlacementRequestBody {
  imageBase64: string;
  stampWidth: number;
  stampHeight: number;
  pageWidth: number;
  pageHeight: number;
  provider: AIProviderConfig;
}

interface PlacementResult {
  x: number;
  y: number;
  usedFallback?: boolean;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  "You are an expert at analyzing document page images. " +
  "Your only task is to identify the best position to place a rectangular stamp so it does not cover any existing content. " +
  "You must respond with a raw JSON object only — no markdown, no explanation, no code fences.";

function buildUserPrompt(sw: number, sh: number, pw: number, ph: number): string {
  const maxX = Math.floor(pw - sw);
  const maxY = Math.floor(ph - sh);
  return (
    `Analyze this PDF page image. Page size: ${Math.round(pw)}×${Math.round(ph)} points (top-left origin). ` +
    `I need to place a stamp of ${Math.round(sw)}×${Math.round(sh)} points. ` +
    `Find the largest empty area (blank whitespace, margin, corner) where the stamp fits without covering any text, drawings, tables, or diagrams. ` +
    `Constraints: x must be between 0 and ${maxX}, y must be between 0 and ${maxY}. ` +
    `Reply with ONLY this JSON (integers, no other text): {"x":0,"y":0}`
  );
}

// ---------------------------------------------------------------------------
// Fallback — bottom-right corner with small margin
// ---------------------------------------------------------------------------

function fallback(sw: number, sh: number, pw: number, ph: number): PlacementResult {
  const margin = Math.min(18, pw * 0.025);
  return {
    x: Math.max(0, Math.round(pw - sw - margin)),
    y: Math.max(0, Math.round(ph - sh - margin)),
    usedFallback: true,
  };
}

// ---------------------------------------------------------------------------
// Coordinate parser — tolerant of extra text around the JSON
// ---------------------------------------------------------------------------

function parseCoords(
  text: string,
  sw: number,
  sh: number,
  pw: number,
  ph: number,
): PlacementResult {
  const cleaned = text.trim();

  // Try pure JSON
  try {
    const p = JSON.parse(cleaned);
    if (typeof p.x === "number" && typeof p.y === "number") {
      return clamp(p.x, p.y, sw, sh, pw, ph);
    }
  } catch { /* fall through */ }

  // Extract first {...} block
  const match = cleaned.match(/\{[^{}]*\}/);
  if (match) {
    try {
      const p = JSON.parse(match[0]);
      if (typeof p.x === "number" && typeof p.y === "number") {
        return clamp(p.x, p.y, sw, sh, pw, ph);
      }
    } catch { /* fall through */ }
  }

  // Extract bare numbers like x=12, y=34 or "x": 12, "y": 34
  const xm = cleaned.match(/"?x"?\s*[=:]\s*(-?\d+)/i);
  const ym = cleaned.match(/"?y"?\s*[=:]\s*(-?\d+)/i);
  if (xm && ym) {
    return clamp(parseInt(xm[1], 10), parseInt(ym[1], 10), sw, sh, pw, ph);
  }

  throw new Error(`Could not parse coordinates from AI response: ${cleaned.slice(0, 120)}`);
}

function clamp(x: number, y: number, sw: number, sh: number, pw: number, ph: number): PlacementResult {
  return {
    x: Math.max(0, Math.min(Math.round(x), Math.floor(pw - sw))),
    y: Math.max(0, Math.min(Math.round(y), Math.floor(ph - sh))),
  };
}

// ---------------------------------------------------------------------------
// Anthropic vision call
// ---------------------------------------------------------------------------

async function callAnthropic(
  imageBase64: string,
  userPrompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: imageBase64 },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
}

// ---------------------------------------------------------------------------
// OpenAI-compatible vision call (OpenAI + Azure)
// ---------------------------------------------------------------------------

async function callOpenAICompat(
  imageBase64: string,
  userPrompt: string,
  apiKey: string,
  model: string,
  baseUrl: string,
): Promise<string> {
  // o-series models (o1, o3, o4-mini, etc.) don't support a system role.
  // Match both the canonical name ("o4-mini") and Azure deployment names that
  // contain it (e.g. "my-o4-mini-deployment").
  const isOModel = /(?:^|[-_])o\d/i.test(model);

  const messages = isOModel
    ? [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${imageBase64}`, detail: "low" },
            },
            { type: "text", text: SYSTEM_PROMPT + "\n\n" + userPrompt },
          ],
        },
      ]
    : [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${imageBase64}`, detail: "low" },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ];

  const body: Record<string, unknown> = {
    model,
    messages,
    // Reasoning models (o-series, gpt-5+) consume hundreds of tokens internally
    // before producing visible output. 4096 gives enough headroom for any model.
    max_completion_tokens: 4096,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const content: string | null = choice?.message?.content ?? null;

  if (!content) {
    // Log full response so we can diagnose refusals, content filters, etc.
    console.error("[stamp-placement] Empty content from API. Full response:", JSON.stringify(data));
    const finishReason = choice?.finish_reason ?? "unknown";
    const refusal = choice?.message?.refusal ?? null;
    throw new Error(
      refusal
        ? `Model refused: ${refusal}`
        : `Model returned empty content (finish_reason: ${finishReason}). The deployment may not support vision/image input.`,
    );
  }

  return content;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: PlacementRequestBody = await request.json();

    if (!body.imageBase64 || !body.provider?.apiKey) {
      return NextResponse.json(
        { error: "imageBase64 and provider configuration are required." },
        { status: 400 },
      );
    }

    const { imageBase64, stampWidth, stampHeight, pageWidth, pageHeight, provider } = body;
    const userPrompt = buildUserPrompt(stampWidth, stampHeight, pageWidth, pageHeight);

    let rawText = "";
    let aiError: string | null = null;

    try {
      if (provider.type === "anthropic") {
        rawText = await callAnthropic(imageBase64, userPrompt, provider.apiKey, provider.model);
      } else if (provider.type === "openai") {
        rawText = await callOpenAICompat(
          imageBase64, userPrompt, provider.apiKey, provider.model,
          "https://api.openai.com/v1",
        );
      } else if (provider.type === "azure" && provider.endpoint) {
        const base = provider.endpoint.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
        rawText = await callOpenAICompat(
          imageBase64, userPrompt, provider.apiKey, provider.model, base,
        );
      } else {
        throw new Error(`Unsupported provider type: ${provider.type}`);
      }
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
      console.error("[stamp-placement] AI call failed:", aiError);
    }

    if (aiError) {
      return NextResponse.json({
        ...fallback(stampWidth, stampHeight, pageWidth, pageHeight),
        aiError,
      });
    }

    try {
      const coords = parseCoords(rawText, stampWidth, stampHeight, pageWidth, pageHeight);
      return NextResponse.json(coords);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error("[stamp-placement] Parse failed, using fallback:", msg, "| raw:", rawText);
      return NextResponse.json({
        ...fallback(stampWidth, stampHeight, pageWidth, pageHeight),
        aiError: `Parse error: ${msg}`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
