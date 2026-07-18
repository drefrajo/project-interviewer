import { describe, expect, it, vi } from "vitest";
import {
  AiBoundaryValidationError,
  createOpenAiCompatibleAdapter,
} from "./openai-compatible-adapter";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("OpenAI-compatible AI boundary", () => {
  it("enforces private developer routing and captures actual model/provider usage", async () => {
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
        allowedProviders: ["openai", "anthropic"],
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
        only: ["openai", "anthropic"],
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
        allowedProviders: ["openai"],
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
        allowedProviders: ["openai"],
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
        allowedProviders: ["openai"],
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
        allowedProviders: ["openai"],
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

  it("applies the same private provider routing to embeddings", async () => {
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
        allowedProviders: ["openai"],
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
        only: ["openai"],
        allow_fallbacks: true,
        zdr: true,
        data_collection: "deny",
      },
    });
  });
});
