import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
} from "../types";

const OPENAI_API_BASE = "https://api.openai.com/v1";

export class OpenAIProvider implements AIProvider {
  public readonly name = "OpenAI";
  public readonly type = "openai" as const;

  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gpt-4o") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async sendCompletion(
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    const url = `${OPENAI_API_BASE}/chat/completions`;

    const body: Record<string, unknown> = {
      model: this.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      body.max_completion_tokens = request.maxTokens;
    }
    if (request.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAI API error (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content ?? "",
        finishReason: mapFinishReason(choice?.finish_reason),
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("OpenAI API error")) {
        throw error;
      }
      throw new Error(
        `OpenAI provider request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${OPENAI_API_BASE}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

function mapFinishReason(
  reason: string | undefined
): AICompletionResponse["finishReason"] {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    default:
      return "error";
  }
}
