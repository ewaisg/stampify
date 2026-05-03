import { NextRequest, NextResponse } from "next/server";
import type { AIProviderConfig } from "@/types/stampify";
import type { AIMessage } from "@/lib/ai/types";
import { createAIProvider } from "@/lib/ai";

interface ChatRequestBody {
  messages: AIMessage[];
  provider: AIProviderConfig;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();

    // ---- Input validation ----
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "messages must be a non-empty array." },
        { status: 400 }
      );
    }

    if (!body.provider || !body.provider.type || !body.provider.apiKey) {
      return NextResponse.json(
        { error: "provider configuration with type and apiKey is required." },
        { status: 400 }
      );
    }

    if (body.provider.type === "azure" && !body.provider.endpoint) {
      return NextResponse.json(
        { error: "Azure provider requires an endpoint." },
        { status: 400 }
      );
    }

    // ---- Create provider and send completion ----
    const provider = createAIProvider(body.provider);

    const response = await provider.sendCompletion({
      messages: body.messages,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      responseFormat: body.responseFormat,
    });

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";

    // Distinguish between provider API errors and unexpected failures
    const isProviderError =
      error instanceof Error &&
      (error.message.includes("API error") ||
        error.message.includes("provider request failed"));

    return NextResponse.json(
      { error: message },
      { status: isProviderError ? 502 : 500 }
    );
  }
}
