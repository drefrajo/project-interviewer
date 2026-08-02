import { describe, expect, it } from "vitest";
import {
  buildCloudflareEmailRequest,
  buildOpenRouterImageRequest,
  buildOpenRouterTextRequest,
} from "./provider_requests";

describe("provider request privacy contract", () => {
  it("pins text and image models and refuses retention or fallback", () => {
    const text = buildOpenRouterTextRequest({
      apiKey: "secret",
      model: "gpt-5.6-terra",
      operation: "interview",
      messages: [{ role: "user", content: "private" }],
    });
    const translation = buildOpenRouterTextRequest({
      apiKey: "secret",
      model: "gpt-5.6-terra",
      operation: "translation",
      messages: [{ role: "user", content: "private" }],
    });
    const gptImage = buildOpenRouterImageRequest({
      apiKey: "secret",
      prompt: "rough visual direction",
    });
    expect(JSON.parse(String(text.init.body))).toMatchObject({
      model: "openai/gpt-5.6-terra",
      reasoning: { effort: "low" },
      provider: {
        data_collection: "deny",
        zdr: false,
        allow_fallbacks: false,
        require_parameters: true,
      },
    });
    expect(JSON.parse(String(translation.init.body))).toMatchObject({
      model: "openai/gpt-5.6-terra",
      reasoning: { effort: "medium" },
      provider: {
        data_collection: "deny",
        zdr: false,
        allow_fallbacks: false,
        require_parameters: true,
      },
    });
    expect(JSON.parse(String(gptImage.init.body))).toMatchObject({
      model: "openai/gpt-image-2",
      quality: "medium",
      aspect_ratio: "3:2",
      provider: {
        data_collection: "deny",
        zdr: false,
        allow_fallbacks: false,
        require_parameters: true,
      },
    });
    expect(gptImage.url).toBe("https://openrouter.ai/api/v1/images");
    expect(JSON.parse(String(gptImage.init.body))).not.toHaveProperty("size");
  });

  it("leaves reasoning and JSON output headroom for concept seeds", () => {
    const request = buildOpenRouterTextRequest({
      apiKey: "secret",
      model: "gpt-5.6-terra",
      operation: "concept_prompt",
      messages: [{ role: "user", content: "private" }],
    });

    expect(JSON.parse(String(request.init.body))).toMatchObject({
      max_tokens: 8192,
      response_format: { type: "json_object" },
      reasoning: { effort: "medium" },
    });
  });

  it("enables provider-compatible JSON mode for Interview answers", () => {
    const request = buildOpenRouterTextRequest({
      apiKey: "secret",
      model: "gpt-5.6-terra",
      operation: "interview",
      messages: [{ role: "user", content: "unexpected input" }],
    });

    expect(JSON.parse(String(request.init.body))).toMatchObject({
      max_tokens: 1200,
      response_format: { type: "json_object" },
      reasoning: { effort: "low" },
    });
  });

  it("uses medium reasoning for document generation", () => {
    const request = buildOpenRouterTextRequest({
      apiKey: "secret",
      model: "gpt-5.6-terra",
      operation: "document",
      messages: [{ role: "user", content: "project context" }],
    });
    const body = JSON.parse(String(request.init.body));

    expect(body).toMatchObject({
      reasoning: { effort: "medium" },
    });
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("response_format");
  });

  it("uses one bounded medium-effort request for initial Interview planning", () => {
    const request = buildOpenRouterTextRequest({
      apiKey: "secret",
      model: "gpt-5.6-terra",
      operation: "interview_plan",
      messages: [{ role: "user", content: "first Client reply" }],
    });

    const body = JSON.parse(String(request.init.body));
    expect(body).toMatchObject({
      max_tokens: 1200,
      reasoning: { effort: "medium" },
    });
    expect(body).not.toHaveProperty("response_format");
  });

  it("builds a minimal idempotent submission email", () => {
    const request = buildCloudflareEmailRequest({
      apiUrl: "https://api.example.test/send",
      apiToken: "secret",
      from: "product@example.test",
      to: "creator@example.test",
      projectName: "Website",
      dashboardUrl: "https://app.example.test/interviews/123",
      submissionId: "submission_123",
    });
    const body = JSON.parse(String(request.init.body));
    expect(body).toEqual({
      from: "product@example.test",
      to: ["creator@example.test"],
      subject: "Project submitted: Website",
      text: "Website was submitted.\n\nOpen the authenticated dashboard: https://app.example.test/interviews/123",
      headers: { "X-Project-Submission-ID": "submission_123" },
    });
    expect(request.init.headers).toMatchObject({
      "idempotency-key": "submission_123",
    });
  });

  it("names missing email configuration without exposing a generic error", () => {
    expect(() =>
      buildCloudflareEmailRequest({
        apiUrl: undefined,
        apiToken: undefined,
        from: undefined,
        to: "creator@example.test",
        projectName: "Website",
        dashboardUrl: "https://app.example.test/interviews/123",
        submissionId: "submission_123",
      }),
    ).toThrow(
      expect.objectContaining({ name: "EMAIL_CONFIGURATION_MISSING" }),
    );
  });
});
