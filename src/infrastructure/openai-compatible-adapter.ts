export type AiRole =
  | "file_analyzer"
  | "interview_planner"
  | "interview_agent"
  | "interview_reviewer"
  | "brief_generator"
  | "embeddings";

type ValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; errors: readonly string[] }>;

type AdapterConfiguration = Readonly<{
  apiKey: string;
  baseUrl: string;
  models: Partial<Record<AiRole, string>>;
}>;

type ChatRequest<T> = Readonly<{
  role: Exclude<AiRole, "embeddings">;
  messages: readonly unknown[];
  tools?: readonly unknown[];
  executeTool?: (
    name: string,
    argumentsValue: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>;
  maxToolCalls?: number;
  schema: Readonly<{ name: string; jsonSchema: Readonly<Record<string, unknown>> }>;
  validate: (value: unknown) => ValidationResult<T>;
}>;

type AiMetadata = Readonly<{
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
  attemptCount: number;
  latencyMs: number;
}>;

export class AiBoundaryValidationError extends Error {
  readonly validationErrors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`AI response failed boundary validation: ${errors.join("; ")}`);
    this.name = "AiBoundaryValidationError";
    this.validationErrors = errors;
  }
}

class AiBoundaryRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiBoundaryRequestError";
  }
}

const requiredModel = (
  models: AdapterConfiguration["models"],
  role: AiRole,
): string => {
  const model = models[role];
  if (!model) {
    throw new AiBoundaryRequestError(`No model is configured for role ${role}.`);
  }
  return model;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const requestJson = async (
  fetcher: typeof globalThis.fetch,
  url: string,
  apiKey: string,
  body: Readonly<Record<string, unknown>>,
): Promise<Record<string, unknown>> => {
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new AiBoundaryRequestError(
      `AI provider request failed with HTTP ${response.status}.`,
    );
  }
  return asRecord(await response.json());
};

export const createOpenAiCompatibleAdapter = (
  configuration: AdapterConfiguration,
  dependencies: Readonly<{ fetch?: typeof globalThis.fetch }> = {},
) => {
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  const baseUrl = configuration.baseUrl.replace(/\/+$/, "");
  const provider = {
    allow_fallbacks: true,
    zdr: true,
    data_collection: "deny",
  } as const;

  return {
    async structuredChat<T>(
      request: ChatRequest<T>,
    ): Promise<Readonly<{ value: T; metadata: AiMetadata }>> {
      const startedAt = performance.now();
      const messages = [...request.messages];
      let finalErrors: readonly string[] = [];
      let validationAttempt = 1;
      let toolCallCount = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let estimatedCostUsd = 0;

      while (validationAttempt <= 2) {
        const response = await requestJson(
          fetcher,
          `${baseUrl}/chat/completions`,
          configuration.apiKey,
          {
            model: requiredModel(configuration.models, request.role),
            messages,
            ...(request.tools ? { tools: request.tools } : {}),
            response_format: {
              type: "json_schema",
              json_schema: {
                name: request.schema.name,
                strict: true,
                schema: request.schema.jsonSchema,
              },
            },
            provider,
            stream: false,
          },
        );
        const choices = Array.isArray(response.choices) ? response.choices : [];
        const firstChoice = asRecord(choices[0]);
        const message = asRecord(firstChoice.message);
        const usage = asRecord(response.usage);
        inputTokens += asNumber(usage.prompt_tokens);
        outputTokens += asNumber(usage.completion_tokens);
        estimatedCostUsd += asNumber(usage.cost);
        const toolCalls = Array.isArray(message.tool_calls)
          ? message.tool_calls
          : [];
        if (toolCalls.length > 0) {
          if (!request.executeTool) {
            throw new AiBoundaryRequestError(
              "The AI provider requested a tool, but no application tool executor is configured.",
            );
          }
          const maximum = request.maxToolCalls ?? 8;
          if (toolCallCount + toolCalls.length > maximum) {
            throw new AiBoundaryRequestError(
              `The AI provider exceeded the ${maximum}-call tool limit.`,
            );
          }
          messages.push({ ...message, role: "assistant" });
          for (const rawCall of toolCalls) {
            const call = asRecord(rawCall);
            const fn = asRecord(call.function);
            const name = typeof fn.name === "string" ? fn.name : "";
            const rawArguments =
              typeof fn.arguments === "string" ? fn.arguments : "{}";
            let argumentsValue: unknown;
            try {
              argumentsValue = JSON.parse(rawArguments);
            } catch {
              throw new AiBoundaryRequestError(
                `Tool ${name || "unknown"} supplied malformed arguments.`,
              );
            }
            if (
              !name ||
              typeof argumentsValue !== "object" ||
              argumentsValue === null ||
              Array.isArray(argumentsValue)
            ) {
              throw new AiBoundaryRequestError(
                `Tool ${name || "unknown"} supplied malformed arguments.`,
              );
            }
            const toolResult = await request.executeTool(
              name,
              argumentsValue as Record<string, unknown>,
            );
            messages.push({
              role: "tool",
              tool_call_id:
                typeof call.id === "string" ? call.id : `tool-${toolCallCount}`,
              content: JSON.stringify(toolResult),
            });
            toolCallCount += 1;
          }
          continue;
        }
        const content = message.content;
        let parsed: unknown;
        try {
          parsed =
            typeof content === "string" ? JSON.parse(content) : undefined;
        } catch {
          parsed = undefined;
        }
        const validation = request.validate(parsed);
        if (validation.ok) {
          return {
            value: validation.value,
            metadata: {
              model:
                typeof response.model === "string" ? response.model : "unknown",
              provider:
                typeof response.provider === "string"
                  ? response.provider
                  : "unknown",
              inputTokens,
              outputTokens,
              ...(estimatedCostUsd > 0
                ? { estimatedCostUsd }
                : {}),
              attemptCount: validationAttempt,
              latencyMs: Math.max(0, performance.now() - startedAt),
            },
          };
        }

        finalErrors = validation.errors;
        messages.push({
          role: "system",
          content:
            "Repair the previous response so it satisfies the required JSON schema. " +
            `Validation errors: ${validation.errors.join("; ")}`,
        });
        validationAttempt += 1;
      }

      throw new AiBoundaryValidationError(finalErrors);
    },

    async embed(
      inputs: readonly string[],
    ): Promise<
      Readonly<{
        vectors: readonly (readonly number[])[];
        metadata: Omit<AiMetadata, "outputTokens" | "attemptCount">;
      }>
    > {
      const startedAt = performance.now();
      const response = await requestJson(
        fetcher,
        `${baseUrl}/embeddings`,
        configuration.apiKey,
        {
          model: requiredModel(configuration.models, "embeddings"),
          input: inputs,
          encoding_format: "float",
          provider,
        },
      );
      const data = Array.isArray(response.data)
        ? response.data.map(asRecord).sort((left, right) => {
            return asNumber(left.index) - asNumber(right.index);
          })
        : [];
      const usage = asRecord(response.usage);
      return {
        vectors: data.map((item) =>
          Array.isArray(item.embedding)
            ? item.embedding.filter(
                (value): value is number => typeof value === "number",
              )
            : [],
        ),
        metadata: {
          model:
            typeof response.model === "string" ? response.model : "unknown",
          provider:
            typeof response.provider === "string"
              ? response.provider
              : "unknown",
          inputTokens: asNumber(usage.prompt_tokens),
          ...(typeof usage.cost === "number"
            ? { estimatedCostUsd: usage.cost }
            : {}),
          latencyMs: Math.max(0, performance.now() - startedAt),
        },
      };
    },
  } as const;
};
