import { AIProviderType } from "@/types/stampify";

// ---------------------------------------------------------------------------
// AI Message & Completion Types
// ---------------------------------------------------------------------------

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface AICompletionResponse {
  content: string;
  finishReason: "stop" | "length" | "error";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ---------------------------------------------------------------------------
// AI Provider Interface
// ---------------------------------------------------------------------------

export interface AIProvider {
  name: string;
  type: AIProviderType;
  sendCompletion(request: AICompletionRequest): Promise<AICompletionResponse>;
  validateConfig(): Promise<boolean>;
}
