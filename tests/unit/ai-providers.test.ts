import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAIProvider,
  AzureAIProvider,
  OpenAIProvider,
  AnthropicProvider,
} from "@/lib/ai";
import type { AIProviderConfig } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchResponse(body: unknown, status = 200): void {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

function mockFetchError(errorMessage: string, status = 500): void {
  const response = {
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(errorMessage),
    json: vi.fn().mockRejectedValue(new Error("not json")),
  } as unknown as Response;

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createAIProvider factory", () => {
  it("returns an AzureAIProvider for azure type", () => {
    const config: AIProviderConfig = {
      type: "azure",
      apiKey: "key",
      endpoint: "https://example.openai.azure.com",
      model: "gpt-4o",
      isDefault: false,
    };
    const provider = createAIProvider(config);
    expect(provider).toBeInstanceOf(AzureAIProvider);
    expect(provider.type).toBe("azure");
    expect(provider.name).toBe("Azure AI Foundry");
  });

  it("returns an OpenAIProvider for openai type", () => {
    const config: AIProviderConfig = {
      type: "openai",
      apiKey: "sk-key",
      model: "gpt-4o",
      isDefault: true,
    };
    const provider = createAIProvider(config);
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.type).toBe("openai");
    expect(provider.name).toBe("OpenAI");
  });

  it("returns an AnthropicProvider for anthropic type", () => {
    const config: AIProviderConfig = {
      type: "anthropic",
      apiKey: "sk-ant-key",
      model: "claude-sonnet-4-20250514",
      isDefault: false,
    };
    const provider = createAIProvider(config);
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.type).toBe("anthropic");
    expect(provider.name).toBe("Anthropic");
  });

  it("throws if Azure provider has no endpoint", () => {
    const config: AIProviderConfig = {
      type: "azure",
      apiKey: "key",
      model: "gpt-4o",
      isDefault: false,
    };
    expect(() => createAIProvider(config)).toThrow(
      "Azure provider requires an endpoint",
    );
  });
});

// ---------------------------------------------------------------------------
// OpenAI provider - sendCompletion
// ---------------------------------------------------------------------------

describe("OpenAIProvider.sendCompletion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends correct request and maps response", async () => {
    mockFetchResponse({
      choices: [
        {
          message: { content: "Hello world" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });

    const provider = new OpenAIProvider("sk-test", "gpt-4o");
    const result = await provider.sendCompletion({
      messages: [{ role: "user", content: "Hi" }],
      temperature: 0.7,
      maxTokens: 100,
    });

    expect(result.content).toBe("Hello world");
    expect(result.finishReason).toBe("stop");
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });

    // Verify the fetch was called with correct params
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(options?.method).toBe("POST");
    expect(options?.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer sk-test",
        "Content-Type": "application/json",
      }),
    );

    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe("gpt-4o");
    expect(body.temperature).toBe(0.7);
    expect(body.max_completion_tokens).toBe(100);
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("includes response_format when json is requested", async () => {
    mockFetchResponse({
      choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
    });

    const provider = new OpenAIProvider("sk-test", "gpt-4o");
    await provider.sendCompletion({
      messages: [{ role: "user", content: "give json" }],
      responseFormat: "json",
    });

    const fetchMock = vi.mocked(fetch);
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("throws on non-ok response", async () => {
    mockFetchError("Unauthorized", 401);

    const provider = new OpenAIProvider("bad-key", "gpt-4o");
    await expect(
      provider.sendCompletion({
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toThrow("OpenAI API error (401)");
  });

  it("maps finish_reason 'length' correctly", async () => {
    mockFetchResponse({
      choices: [
        {
          message: { content: "truncated..." },
          finish_reason: "length",
        },
      ],
    });

    const provider = new OpenAIProvider("sk-test", "gpt-4o");
    const result = await provider.sendCompletion({
      messages: [{ role: "user", content: "write a long story" }],
    });
    expect(result.finishReason).toBe("length");
  });
});

// ---------------------------------------------------------------------------
// Azure provider - sendCompletion
// ---------------------------------------------------------------------------

describe("AzureAIProvider.sendCompletion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends correct request with api-key header", async () => {
    mockFetchResponse({
      choices: [
        {
          message: { content: "Azure says hi" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 8,
        completion_tokens: 3,
        total_tokens: 11,
      },
    });

    const provider = new AzureAIProvider(
      "https://my-resource.openai.azure.com",
      "az-key",
      "gpt-4o",
    );
    const result = await provider.sendCompletion({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.content).toBe("Azure says hi");
    expect(result.finishReason).toBe("stop");

    const fetchMock = vi.mocked(fetch);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("my-resource.openai.azure.com");
    expect(url).toContain("/chat/completions");
    expect(options?.headers).toEqual(
      expect.objectContaining({
        "Authorization": "Bearer az-key",
      }),
    );
  });

  it("strips trailing slash from endpoint", async () => {
    mockFetchResponse({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
    });

    const provider = new AzureAIProvider(
      "https://my-resource.openai.azure.com///",
      "key",
      "model",
    );
    await provider.sendCompletion({
      messages: [{ role: "user", content: "test" }],
    });

    const fetchMock = vi.mocked(fetch);
    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain("///");
    expect(url).toContain("my-resource.openai.azure.com");
    expect(url).toContain("/chat/completions");
  });

  it("throws on API error", async () => {
    mockFetchError("Forbidden", 403);

    const provider = new AzureAIProvider(
      "https://endpoint.azure.com",
      "bad-key",
      "gpt-4o",
    );
    await expect(
      provider.sendCompletion({
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toThrow("Azure API error (403)");
  });
});

// ---------------------------------------------------------------------------
// Anthropic provider - sendCompletion
// ---------------------------------------------------------------------------

describe("AnthropicProvider.sendCompletion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends correct request with system message separated", async () => {
    mockFetchResponse({
      content: [{ type: "text", text: "Anthropic says hi" }],
      stop_reason: "end_turn",
      usage: {
        input_tokens: 12,
        output_tokens: 4,
      },
    });

    const provider = new AnthropicProvider("sk-ant-key", "claude-sonnet-4-20250514");
    const result = await provider.sendCompletion({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
      temperature: 0.5,
    });

    expect(result.content).toBe("Anthropic says hi");
    expect(result.finishReason).toBe("stop");
    expect(result.usage).toEqual({
      promptTokens: 12,
      completionTokens: 4,
      totalTokens: 16,
    });

    const fetchMock = vi.mocked(fetch);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(options?.headers).toEqual(
      expect.objectContaining({
        "x-api-key": "sk-ant-key",
        "anthropic-version": "2023-06-01",
      }),
    );

    const body = JSON.parse(options?.body as string);
    // System message should be in body.system, not in messages
    expect(body.system).toBe("You are helpful.");
    expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
    expect(body.temperature).toBe(0.5);
  });

  it("maps max_tokens stop reason to 'length'", async () => {
    mockFetchResponse({
      content: [{ type: "text", text: "cut off..." }],
      stop_reason: "max_tokens",
    });

    const provider = new AnthropicProvider("key", "claude-sonnet-4-20250514");
    const result = await provider.sendCompletion({
      messages: [{ role: "user", content: "write a lot" }],
    });
    expect(result.finishReason).toBe("length");
  });

  it("throws on API error", async () => {
    mockFetchError("Rate limited", 429);

    const provider = new AnthropicProvider("bad-key", "claude-sonnet-4-20250514");
    await expect(
      provider.sendCompletion({
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toThrow("Anthropic API error (429)");
  });
});
