import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
} from "../types";

const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicProvider implements AIProvider {
  public readonly name = "Anthropic";
  public readonly type = "anthropic" as const;

  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "claude-sonnet-4-20250514") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async sendCompletion(
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    const url = `${ANTHROPIC_API_BASE}/messages`;

    // Anthropic requires system messages to be separated from the messages array
    const systemMessages = request.messages.filter((m) => m.role === "system");
    const nonSystemMessages = request.messages.filter(
      (m) => m.role !== "system"
    );

    const systemText = systemMessages.map((m) => m.content).join("\n\n");

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemText) {
      body.system = systemText;
    }
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Anthropic API error (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();

      // Anthropic returns content as an array of content blocks
      const textContent = (data.content ?? [])
        .filter((block: { type: string }) => block.type === "text")
        .map((block: { text: string }) => block.text)
        .join("");

      return {
        content: textContent,
        finishReason: mapStopReason(data.stop_reason),
        usage: data.usage
          ? {
              promptTokens: data.usage.input_tokens,
              completionTokens: data.usage.output_tokens,
              totalTokens:
                (data.usage.input_tokens ?? 0) +
                (data.usage.output_tokens ?? 0),
            }
          : undefined,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Anthropic API error")
      ) {
        throw error;
      }
      throw new Error(
        `Anthropic provider request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.sendCompletion({
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 5,
      });
      return true;
    } catch {
      return false;
    }
  }
}

function mapStopReason(
  reason: string | undefined
): AICompletionResponse["finishReason"] {
  switch (reason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    default:
      return "error";
  }
}
