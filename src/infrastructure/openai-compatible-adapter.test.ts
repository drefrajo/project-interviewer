import { describe, expect, it, vi } from "vitest";
import {
  AiBoundaryRequestError,
  AiBoundaryValidationError,
  createOpenAiCompatibleAdapter,
  normalizeProviderOptionalNulls,
  toProviderStrictSchema,
} from "./openai-compatible-adapter";
import {
  aiOutputSchemas,
  validateDomainOutput,
} from "../../convex/ai";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("OpenAI-compatible AI boundary", () => {
  it("converts optional output fields into provider-compatible strict schema", async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const fetcher = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        requestBodies.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return jsonResponse({
          model: "model",
          provider: "provider",
          choices: [
            {
              message: {
                content:
                  '{"label":"ready","optionalNote":null,"count":1}',
              },
            },
          ],
          usage: {},
        });
      },
    );
    const adapter = createOpenAiCompatibleAdapter(
      {
        apiKey: "secret",
        baseUrl: "https://openrouter.ai/api/v1",
        models: { interview_planner: "model" },
      },
      { fetch: fetcher },
    );

    await expect(
      adapter.structuredChat({
        role: "interview_planner",
        messages: [{ role: "user", content: "Plan." }],
        schema: {
          name: "plan",
          jsonSchema: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              label: { type: "string" },
              optionalNote: { type: "string" },
              count: { type: "number", default: 0 },
            },
            required: ["label", "count"],
            additionalProperties: false,
          },
        },
        validate: (value) =>
          typeof value === "object" &&
          value !== null &&
          !("optionalNote" in value)
            ? {
                ok: true as const,
                value: value as { label: string; count: number },
              }
            : {
                ok: false as const,
                errors: ["optionalNote must be omitted when absent"],
              },
      }),
    ).resolves.toMatchObject({
      value: { label: "ready", count: 1 },
    });

    const responseFormat = requestBodies[0]?.response_format as {
      json_schema?: {
        schema?: Record<string, unknown>;
      };
    };
    const strictSchema = responseFormat.json_schema?.schema;
    expect(strictSchema).not.toHaveProperty("$schema");
    expect(strictSchema).toMatchObject({
      required: ["label", "optionalNote", "count"],
      properties: {
        optionalNote: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        count: { type: "number" },
      },
    });
    expect(
      (
        strictSchema?.properties as Record<
          string,
          Record<string, unknown>
        >
      ).count,
    ).not.toHaveProperty("default");
  });

  it("surfaces only allow-listed provider error categories", async () => {
    const adapter = createOpenAiCompatibleAdapter(
      {
        apiKey: "secret-api-key",
        baseUrl: "https://openrouter.ai/api/v1",
        models: { interview_planner: "model" },
      },
      {
        fetch: vi.fn(async () =>
          new Response(
            JSON.stringify({
              error: {
                code: 400,
                message:
                  "Invalid schema for private-client@example.com using sk-private-token-value.",
                metadata: { error_type: "invalid_json_schema" },
              },
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          ),
        ),
      },
    );

    const operation = adapter.structuredChat({
      role: "interview_planner",
      messages: [{ role: "user", content: "Plan." }],
      schema: { name: "plan", jsonSchema: { type: "object" } },
      validate: () => ({ ok: false as const, errors: ["invalid"] }),
    });

    await expect(operation).rejects.toThrow(
      /HTTP 400 \(invalid_json_schema\)/i,
    );
    await expect(operation).rejects.toThrow(
      /invalid schema for \[redacted\] using \[redacted\]/i,
    );
    await expect(operation).rejects.not.toThrow(
      /private-client|sk-private|secret-api-key/i,
    );
  });

  it("converts the real domain schemas to OpenAI strict JSON Schema", () => {
    for (const { jsonSchema } of Object.values(aiOutputSchemas)) {
      const strictSchema = toProviderStrictSchema(jsonSchema);
      const serialized = JSON.stringify(strictSchema);
      expect(serialized).not.toContain('"$schema"');
      expect(serialized).not.toContain('"default"');
      expect(serialized).not.toContain('"oneOf"');
      expect(serialized).not.toContain('"allOf"');
    }
    expect(
      JSON.stringify(
        toProviderStrictSchema(
          aiOutputSchemas.interview_turn.jsonSchema,
        ),
      ),
    ).toContain('"anyOf"');
  });

  it("preserves explicit nulls while removing provider-only optional nulls", async () => {
    const responseValue = {
      status: "active",
      nextQuestion: null,
      unresolvedTopics: [],
      coverageUpdates: [],
      findings: [
        {
          type: "risk",
          statement: "A grounded risk.",
          sources: [{ type: "turn", turnId: "turn-1" }],
          status: null,
        },
      ],
      findingStatusUpdates: [],
    };
    const adapter = createOpenAiCompatibleAdapter(
      {
        apiKey: "secret",
        baseUrl: "https://openrouter.ai/api/v1",
        models: { interview_agent: "model" },
      },
      {
        fetch: vi.fn(async () =>
          jsonResponse({
            model: "model",
            provider: "provider",
            choices: [
              { message: { content: JSON.stringify(responseValue) } },
            ],
            usage: {},
          }),
        ),
      },
    );

    await expect(
      adapter.structuredChat({
        role: "interview_agent",
        messages: [{ role: "user", content: "Continue." }],
        schema: aiOutputSchemas.interview_turn,
        validate: (value) =>
          validateDomainOutput("interview_turn", value),
      }),
    ).resolves.toMatchObject({
      value: {
        nextQuestion: null,
        findings: [
          {
            sources: [{ type: "turn", turnId: "turn-1" }],
          },
        ],
      },
    });
  });

  it("does not guess between ambiguous non-discriminated union branches", () => {
    expect(
      normalizeProviderOptionalNulls(
        { shared: null },
        {
          anyOf: [
            {
              type: "object",
              properties: { shared: { type: "string" } },
            },
            {
              type: "object",
              properties: { shared: { type: "number" } },
            },
          ],
        },
      ),
    ).toEqual({ shared: null });
  });

  it("rejects unsupported allOf output schemas before making a request", () => {
    expect(() =>
      toProviderStrictSchema({
        allOf: [{ type: "object", properties: {} }],
      }),
    ).toThrow(AiBoundaryRequestError);
  });

  it("enforces private routing and captures actual model/provider usage", async () => {
    const requestBodies: unknown[] = [];
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)));
      return jsonResponse({
        model: "openai/gpt-5.2",
        provider: "OpenAI",
        choices: [
          { message: { content: '{"summary":"Valid"}', tool_calls: [] } },
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 4,
          total_tokens: 16,
          cost: 0.002,
        },
      });
    });
    const adapter = createOpenAiCompatibleAdapter(
      {
        apiKey: "secret",
        baseUrl: "https://openrouter.ai/api/v1",
        models: { file_analyzer: "openai/gpt-5-mini" },
      },
      { fetch: fetcher },
    );

    const result = await adapter.structuredChat({
      role: "file_analyzer",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Inspect this image." },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,AAAA" },
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "find_evidence",
            description: "Find authorized evidence.",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
      schema: {
        name: "file_analysis",
        jsonSchema: {
          type: "object",
          required: ["summary"],
          properties: { summary: { type: "string" } },
        },
      },
      validate: (value) =>
        typeof value === "object" &&
        value !== null &&
        "summary" in value
          ? { ok: true as const, value: value as { summary: string } }
          : { ok: false as const, errors: ["summary is required"] },
    });

    expect(requestBodies[0]).toMatchObject({
      model: "openai/gpt-5-mini",
      stream: false,
      provider: {
        allow_fallbacks: true,
        zdr: true,
        data_collection: "deny",
      },
      response_format: {
        type: "json_schema",
        json_schema: { name: "file_analysis", strict: true },
      },
    });
    expect(result).toMatchObject({
      value: { summary: "Valid" },
      metadata: {
        model: "openai/gpt-5.2",
        provider: "OpenAI",
        inputTokens: 12,
        outputTokens: 4,
        estimatedCostUsd: 0.002,
        attemptCount: 1,
        latencyMs: expect.any(Number),
      },
    });
  });

  it("sends validation errors through one repair attempt and commits no invalid partial value", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          model: "model",
          provider: "provider",
          choices: [{ message: { content: '{"wrong":true}' } }],
          usage: {},
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          model: "model",
          provider: "provider",
          choices: [{ message: { content: '{"answer":"repaired"}' } }],
          usage: {},
        }),
      );
    const adapter = createOpenAiCompatibleAdapter(
      {
        apiKey: "secret",
        baseUrl: "https://openrouter.ai/api/v1",
        models: { interview_agent: "model" },
      },
      { fetch: fetcher },
    );
    const validate = (value: unknown) =>
      typeof value === "object" &&
      value !== null &&
      "answer" in value
        ? { ok: true as const, value: value as { answer: string } }
        : { ok: false as const, errors: ["answer is required"] };

    expect(
      await adapter.structuredChat({
        role: "interview_agent",
        messages: [{ role: "user", content: "Continue." }],
        schema: {
          name: "answer",
          jsonSchema: { type: "object" },
        },
        validate,
      }),
    ).toMatchObject({
      value: { answer: "repaired" },
      metadata: { attemptCount: 2 },
    });
    expect(
      JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)).messages.at(-1),
    ).toMatchObject({
      role: "system",
      content: expect.stringContaining("answer is required"),
    });

    const alwaysInvalid = createOpenAiCompatibleAdapter(
      {
        apiKey: "secret",
        baseUrl: "https://openrouter.ai/api/v1",
        models: { brief_generator: "model" },
      },
      {
        fetch: vi.fn(async () =>
          jsonResponse({
            model: "model",
            provider: "provider",
            choices: [{ message: { content: "{}" } }],
            usage: {},
          }),
        ),
      },
    );
    await expect(
      alwaysInvalid.structuredChat({
        role: "brief_generator",
        messages: [{ role: "user", content: "Generate." }],
        schema: { name: "brief", jsonSchema: { type: "object" } },
        validate,
      }),
    ).rejects.toBeInstanceOf(AiBoundaryValidationError);
  });

  it("executes bounded application-owned tools before validating the final response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          model: "model",
          provider: "provider",
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call-1",
                    type: "function",
                    function: {
                      name: "list_project_material",
                      arguments: "{}",
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 4, completion_tokens: 2 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          model: "model",
          provider: "provider",
          choices: [{ message: { content: '{"answer":"grounded"}' } }],
          usage: { prompt_tokens: 6, completion_tokens: 3 },
        }),
      );
    const executeTool = vi.fn(async () => ({
      untrustedEvidence: true,
      materials: [{ materialId: "material-1", name: "brief.pdf" }],
    }));
    const adapter = createOpenAiCompatibleAdapter(
      {
        apiKey: "secret",
        baseUrl: "https://openrouter.ai/api/v1",
        models: { interview_agent: "model" },
      },
      { fetch: fetcher },
    );

    const result = await adapter.structuredChat({
      role: "interview_agent",
      messages: [{ role: "user", content: "Continue." }],
      tools: [
        {
          type: "function",
          function: {
            name: "list_project_material",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
      executeTool,
      schema: { name: "answer", jsonSchema: { type: "object" } },
      validate: (value) =>
        typeof value === "object" && value !== null && "answer" in value
          ? { ok: true as const, value: value as { answer: string } }
          : { ok: false as const, errors: ["answer is required"] },
    });

    expect(executeTool).toHaveBeenCalledWith("list_project_material", {});
    const secondRequest = JSON.parse(
      String(fetcher.mock.calls[1]?.[1]?.body),
    );
    expect(secondRequest.messages.slice(-2)).toEqual([
      expect.objectContaining({
        role: "assistant",
        tool_calls: expect.any(Array),
      }),
      {
        role: "tool",
        tool_call_id: "call-1",
        content: expect.stringContaining('"untrustedEvidence":true'),
      },
    ]);
    expect(result).toMatchObject({
      value: { answer: "grounded" },
      metadata: {
        inputTokens: 10,
        outputTokens: 5,
        attemptCount: 1,
      },
    });
  });

  it("rejects malformed or excessive tool calls at the AI boundary", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call",
                  function: {
                    name: "inspect_bounded_content",
                    arguments: "{bad json",
                  },
                },
              ],
            },
          },
        ],
        usage: {},
      }),
    );
    const adapter = createOpenAiCompatibleAdapter(
      {
        apiKey: "secret",
        baseUrl: "https://openrouter.ai/api/v1",
        models: { interview_agent: "model" },
      },
      { fetch: fetcher },
    );

    await expect(
      adapter.structuredChat({
        role: "interview_agent",
        messages: [],
        tools: [],
        executeTool: async () => ({}),
        schema: { name: "answer", jsonSchema: { type: "object" } },
        validate: () => ({ ok: false as const, errors: ["invalid"] }),
      }),
    ).rejects.toThrow("malformed arguments");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("applies the same private routing to embeddings", async () => {
    const fetcher = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        void url;
        void init;
        return jsonResponse({
          model: "openai/text-embedding-3-small",
          provider: "OpenAI",
          data: [{ embedding: [0.1, 0.2], index: 0 }],
          usage: { prompt_tokens: 3, total_tokens: 3 },
        });
      },
    );
    const adapter = createOpenAiCompatibleAdapter(
      {
        apiKey: "secret",
        baseUrl: "https://openrouter.ai/api/v1",
        models: { embeddings: "openai/text-embedding-3-small" },
      },
      { fetch: fetcher },
    );

    expect(await adapter.embed(["hello"])).toMatchObject({
      vectors: [[0.1, 0.2]],
      metadata: {
        model: "openai/text-embedding-3-small",
        provider: "OpenAI",
        inputTokens: 3,
        latencyMs: expect.any(Number),
      },
    });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      provider: {
        allow_fallbacks: true,
        zdr: true,
        data_collection: "deny",
      },
    });
  });
});
