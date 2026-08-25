import type { AiProviderName } from "@shared/types";
import type { Env } from "../../types/env";
import { AppError } from "../../lib/errors";
import type { AIProvider } from "./provider";
import { MockAIProvider } from "./mockProvider";
import { AnthropicProvider } from "./anthropicProvider";
import { OpenAIProvider } from "./openaiProvider";

const mockSingleton = new MockAIProvider();

/**
 * Resolves which AIProvider implementation to use for this request.
 * `providerOverride`/`modelOverride` come from the settings table (user's
 * choice in Settings); when absent we fall back to the env-configured
 * defaults, per the product spec allowing either dynamic or env-driven
 * model configuration.
 */
export function getAiProvider(
  env: Env,
  providerOverride?: string | null,
  modelOverride?: string | null,
): AIProvider {
  const provider = (providerOverride || env.AI_PROVIDER || "mock") as AiProviderName;
  const model = modelOverride || env.AI_MODEL || "claude-sonnet-4-5";

  switch (provider) {
    case "mock":
      return mockSingleton;
    case "anthropic":
      if (!env.ANTHROPIC_API_KEY) {
        throw new AppError(
          500,
          "missing_api_key",
          "AI provider is set to Anthropic but ANTHROPIC_API_KEY is not configured on the server.",
        );
      }
      return new AnthropicProvider(env.ANTHROPIC_API_KEY, model);
    case "openai":
      if (!env.OPENAI_API_KEY) {
        throw new AppError(
          500,
          "missing_api_key",
          "AI provider is set to OpenAI but OPENAI_API_KEY is not configured on the server.",
        );
      }
      return new OpenAIProvider(env.OPENAI_API_KEY, model);
    default:
      return mockSingleton;
  }
}

export * from "./provider";
