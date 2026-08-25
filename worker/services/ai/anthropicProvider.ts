import { z } from "zod";
import {
  aiExpandResultSchema,
  aiImproveSuggestionSchema,
  aiNextActionsSchema,
  aiProjectPlanSchema,
  aiReviewSchema,
  type AiExpandResult,
  type AiImproveSuggestions,
  type AiNextActions,
  type AiProjectPlan,
  type AiReview,
} from "@shared/ai-schema";
import { AppError } from "../../lib/errors";
import {
  buildExpandTaskPrompt,
  buildGenerateProjectPrompt,
  buildImproveProjectPrompt,
  buildReviewProjectPrompt,
  buildSuggestNextActionsPrompt,
} from "./prompts";
import {
  expandTaskJsonSchema,
  generateProjectJsonSchema,
  improveProjectJsonSchema,
  nextActionsJsonSchema,
  reviewProjectJsonSchema,
} from "./json-schemas";
import type {
  AICallToolSchema,
  AiCallOptions,
  AIProvider,
  AiResult,
  ExpandTaskInput,
  GenerateProjectInput,
  ImproveProjectInput,
  ReviewProjectInput,
  SuggestNextActionsInput,
} from "./provider";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateProject(
    input: GenerateProjectInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiProjectPlan>> {
    const { system, user } = buildGenerateProjectPrompt(input);
    return this.run(system, user, generateProjectJsonSchema, aiProjectPlanSchema, options);
  }

  async expandTask(
    input: ExpandTaskInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiExpandResult>> {
    const { system, user } = buildExpandTaskPrompt(input);
    return this.run(system, user, expandTaskJsonSchema, aiExpandResultSchema, options);
  }

  async reviewProject(
    input: ReviewProjectInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiReview>> {
    const { system, user } = buildReviewProjectPrompt(input);
    return this.run(system, user, reviewProjectJsonSchema, aiReviewSchema, options);
  }

  async suggestNextActions(
    input: SuggestNextActionsInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiNextActions>> {
    const { system, user } = buildSuggestNextActionsPrompt(input);
    return this.run(system, user, nextActionsJsonSchema, aiNextActionsSchema, options);
  }

  async improveProject(
    input: ImproveProjectInput,
    options?: AiCallOptions,
  ): Promise<AiResult<AiImproveSuggestions>> {
    const { system, user } = buildImproveProjectPrompt(input);
    return this.run(system, user, improveProjectJsonSchema, aiImproveSuggestionSchema, options);
  }

  private async run<T>(
    system: string,
    user: string,
    tool: AICallToolSchema,
    schema: z.ZodType<T>,
    options?: AiCallOptions,
  ): Promise<AiResult<T>> {
    const start = Date.now();
    let lastError: string | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const userMessage = lastError
        ? `${user}\n\nYour previous response was invalid: ${lastError}. Correct it and call the tool again with valid arguments matching the schema exactly.`
        : user;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const onExternalAbort = () => controller.abort();
      options?.signal?.addEventListener("abort", onExternalAbort);

      try {
        const res = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 8000,
            system,
            messages: [{ role: "user", content: userMessage }],
            tools: [
              {
                name: tool.name,
                description: tool.description,
                input_schema: tool.schema,
              },
            ],
            tool_choice: { type: "tool", name: tool.name },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 429) {
            throw new AppError(429, "rate_limited", "The AI provider rate-limited this request.");
          }
          const bodyText = await res.text().catch(() => "");
          throw new AppError(
            502,
            "upstream_error",
            `Anthropic API error (${res.status}): ${bodyText.slice(0, 300)}`,
          );
        }

        const body = (await res.json()) as {
          content?: { type: string; input?: unknown }[];
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        promptTokens = body.usage?.input_tokens ?? null;
        completionTokens = body.usage?.output_tokens ?? null;

        const toolUse = body.content?.find((c) => c.type === "tool_use");
        if (!toolUse) {
          lastError = "Model did not return a tool_use block.";
          continue;
        }

        const parsed = schema.safeParse(toolUse.input);
        if (parsed.success) {
          return {
            data: parsed.data,
            meta: {
              provider: this.name,
              model: this.model,
              promptTokens,
              completionTokens,
              durationMs: Date.now() - start,
            },
          };
        }
        lastError = parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
      } catch (err) {
        if (err instanceof AppError) throw err;
        if (controller.signal.aborted && options?.signal?.aborted) {
          throw new AppError(499, "cancelled", "The request was cancelled.");
        }
        if (controller.signal.aborted) {
          throw new AppError(504, "timeout", "The AI provider took too long to respond.");
        }
        lastError = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(timeout);
        options?.signal?.removeEventListener("abort", onExternalAbort);
      }
    }

    throw new AppError(
      502,
      "ai_invalid_output",
      `Anthropic returned invalid output after ${MAX_ATTEMPTS} attempts: ${lastError ?? "unknown error"}`,
    );
  }
}
