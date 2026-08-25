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

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

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
        ? `${user}\n\nYour previous response was invalid: ${lastError}. Correct it and respond again with valid JSON matching the schema exactly.`
        : user;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const onExternalAbort = () => controller.abort();
      options?.signal?.addEventListener("abort", onExternalAbort);

      try {
        const res = await fetch(OPENAI_API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.3,
            messages: [
              { role: "system", content: system },
              { role: "user", content: userMessage },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: tool.name,
                description: tool.description,
                schema: tool.schema,
                strict: true,
              },
            },
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
            `OpenAI API error (${res.status}): ${bodyText.slice(0, 300)}`,
          );
        }

        const body = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        promptTokens = body.usage?.prompt_tokens ?? null;
        completionTokens = body.usage?.completion_tokens ?? null;

        const content = body.choices?.[0]?.message?.content;
        if (!content) {
          lastError = "Model returned an empty response.";
          continue;
        }

        let rawJson: unknown;
        try {
          rawJson = JSON.parse(content);
        } catch {
          lastError = "Model response was not valid JSON.";
          continue;
        }

        const parsed = schema.safeParse(rawJson);
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
      `OpenAI returned invalid output after ${MAX_ATTEMPTS} attempts: ${lastError ?? "unknown error"}`,
    );
  }
}
