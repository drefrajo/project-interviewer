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

export class AiBoundaryRequestError extends Error {
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

const asSchemaRecord = (
  value: unknown,
): Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};

const nullableSchema = (
  schema: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf : [];
  if (
    schema.type === "null" ||
    variants.some((variant) => asSchemaRecord(variant).type === "null")
  ) {
    return schema;
  }
  return { anyOf: [schema, { type: "null" }] };
};

const schemaAllowsNull = (
  schema: Readonly<Record<string, unknown>>,
): boolean => {
  if (
    schema.type === "null" ||
    (Array.isArray(schema.type) && schema.type.includes("null")) ||
    (Array.isArray(schema.enum) && schema.enum.includes(null))
  ) {
    return true;
  }
  return ["anyOf", "oneOf"].some((keyword) => {
    const variants = schema[keyword];
    return (
      Array.isArray(variants) &&
      variants.some((variant) => schemaAllowsNull(asSchemaRecord(variant)))
    );
  });
};

export const toProviderStrictSchema = (
  schema: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "$schema" || key === "default") continue;
    if (key === "properties") {
      const properties = asSchemaRecord(value);
      const previouslyRequired = new Set(
        Array.isArray(schema.required)
          ? schema.required.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      );
      converted.properties = Object.fromEntries(
        Object.entries(properties).map(([name, property]) => {
          const strictProperty = toProviderStrictSchema(
            asSchemaRecord(property),
          );
          return [
            name,
            previouslyRequired.has(name)
              ? strictProperty
              : nullableSchema(strictProperty),
          ];
        }),
      );
      converted.required = Object.keys(properties);
      converted.additionalProperties = false;
      continue;
    }
    if (key === "required" || key === "additionalProperties") continue;
    if (key === "allOf") {
      throw new AiBoundaryRequestError(
        "AI output schema uses unsupported allOf composition.",
      );
    }
    if ((key === "anyOf" || key === "oneOf") && Array.isArray(value)) {
      const previous = Array.isArray(converted.anyOf)
        ? converted.anyOf
        : [];
      converted.anyOf = [
        ...previous,
        ...value.map((variant) =>
          toProviderStrictSchema(asSchemaRecord(variant)),
        ),
      ];
      continue;
    }
    if (key === "items") {
      converted.items = toProviderStrictSchema(asSchemaRecord(value));
      continue;
    }
    if (
      (key === "$defs" || key === "definitions") &&
      typeof value === "object" &&
      value !== null
    ) {
      converted[key] = Object.fromEntries(
        Object.entries(asSchemaRecord(value)).map(([name, definition]) => [
          name,
          toProviderStrictSchema(asSchemaRecord(definition)),
        ]),
      );
      continue;
    }
    converted[key] = value;
  }
  if (schema.type === "object" && !("properties" in schema)) {
    converted.properties = {};
    converted.required = [];
    converted.additionalProperties = false;
  }
  return converted;
};

const valueMatchesSchemaShape = (
  value: unknown,
  schema: Readonly<Record<string, unknown>>,
): boolean => {
  if ("const" in schema && schema.const !== value) return false;
  if (schema.type === "null") return value === null;
  if (schema.type === "array") return Array.isArray(value);
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const record = asRecord(value);
    const required = Array.isArray(schema.required)
      ? schema.required.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
    return required.every((key) => key in record);
  }
  if (schema.type === "string") return typeof value === "string";
  if (schema.type === "number" || schema.type === "integer") {
    return typeof value === "number";
  }
  if (schema.type === "boolean") return typeof value === "boolean";
  return true;
};

const schemaVariantFor = (
  value: unknown,
  schema: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const variants = [
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
  ].map(asSchemaRecord);
  if (!variants.length) return schema;
  const record = asRecord(value);
  const matches = variants
    .filter((variant) => valueMatchesSchemaShape(value, variant))
    .map((variant) => {
      const properties = asSchemaRecord(variant.properties);
      const constraints = Object.entries(properties).filter(
        ([, property]) => "const" in asSchemaRecord(property),
      );
      const constantsMatch = constraints.every(([key, property]) => {
        const constraint = asSchemaRecord(property);
        return constraint.const === record[key];
      });
      if (!constantsMatch) return null;
      const propertyMatches = Object.keys(properties).filter(
        (key) => key in record,
      ).length;
      return {
        variant,
        score: constraints.length * 100 + propertyMatches,
      };
    })
    .filter(
      (
        match,
      ): match is {
        variant: Readonly<Record<string, unknown>>;
        score: number;
      } => match !== null,
    )
    .sort((left, right) => right.score - left.score);
  if (matches.length === 1 || matches[0]?.score !== matches[1]?.score) {
    return matches[0]?.variant ?? schema;
  }
  return schema;
};

export const normalizeProviderOptionalNulls = (
  value: unknown,
  sourceSchema: Readonly<Record<string, unknown>>,
): unknown => {
  const schema = schemaVariantFor(value, sourceSchema);
  if (Array.isArray(value)) {
    const itemSchema = asSchemaRecord(schema.items);
    return value.map((item) =>
      normalizeProviderOptionalNulls(item, itemSchema),
    );
  }
  if (typeof value !== "object" || value === null) return value;
  const properties = asSchemaRecord(schema.properties);
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  );
  return Object.fromEntries(
    Object.entries(asRecord(value)).flatMap(([key, item]) => {
      const propertySchema = asSchemaRecord(properties[key]);
      if (
        item === null &&
        key in properties &&
        !required.has(key) &&
        !schemaAllowsNull(propertySchema)
      ) {
        return [];
      }
      return [
        [
          key,
          normalizeProviderOptionalNulls(item, propertySchema),
        ],
      ];
    }),
  );
};

const providerErrorCategories = new Set([
  "authentication_error",
  "context_length_exceeded",
  "invalid_json_schema",
  "invalid_request",
  "invalid_request_error",
  "model_not_found",
  "moderation_error",
  "permission_error",
  "provider_error",
  "rate_limit_exceeded",
  "server_error",
]);

const providerErrorDetail = async (response: Response): Promise<string> => {
  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    return "";
  }
  const root = asRecord(payload);
  const error = asRecord(root.error);
  const metadata = asRecord(error.metadata);
  const candidates = [
    error.code,
    error.type,
    metadata.error_type,
    metadata.type,
  ];
  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" &&
        providerErrorCategories.has(candidate.toLowerCase()),
    ) ?? ""
  ).toLowerCase();
};

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
    const detail = await providerErrorDetail(response);
    throw new AiBoundaryRequestError(
      `AI provider request failed with HTTP ${response.status}${
        detail ? ` (${detail})` : ""
      }.`,
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
      const strictSchema = toProviderStrictSchema(
        request.schema.jsonSchema,
      );

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
                schema: strictSchema,
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
        const validation = request.validate(
          normalizeProviderOptionalNulls(
            parsed,
            request.schema.jsonSchema,
          ),
        );
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
