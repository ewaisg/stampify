import type { AIProviderConfig } from "@/types/stampify";
import type { AIProvider } from "./types";
import { AzureAIProvider } from "./providers/azure";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";

// Re-export all types
export type {
  AIMessage,
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
} from "./types";

// Re-export provider classes
export { AzureAIProvider } from "./providers/azure";
export { OpenAIProvider } from "./providers/openai";
export { AnthropicProvider } from "./providers/anthropic";

/**
 * Factory function that creates the appropriate AI provider based on config.
 */
export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.type) {
    case "azure": {
      if (!config.endpoint) {
        throw new Error(
          "Azure provider requires an endpoint in the configuration."
        );
      }
      return new AzureAIProvider(config.endpoint, config.apiKey, config.model);
    }

    case "openai": {
      return new OpenAIProvider(config.apiKey, config.model);
    }

    case "anthropic": {
      return new AnthropicProvider(config.apiKey, config.model);
    }

    default: {
      const exhaustive: never = config.type;
      throw new Error(`Unsupported AI provider type: ${exhaustive}`);
    }
  }
}
