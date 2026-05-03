import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
} from "../types";

export class AzureAIProvider implements AIProvider {
  public readonly name = "Azure AI Foundry";
  public readonly type = "azure" as const;

  private endpoint: string;
  private apiKey: string;
  private model: string;

  constructor(endpoint: string, apiKey: string, model: string) {
    this.endpoint = endpoint.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.model = model;
  }

  async sendCompletion(
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    const url = `${this.endpoint}/openai/deployments/${this.model}/chat/completions?api-version=2024-08-01-preview`;

    const body: Record<string, unknown> = {
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      body.max_tokens = request.maxTokens;
    }
    if (request.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Azure API error (${response.status}): ${errorText}`
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
      if (error instanceof Error && error.message.startsWith("Azure API error")) {
        throw error;
      }
      throw new Error(
        `Azure provider request failed: ${error instanceof Error ? error.message : String(error)}`
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
