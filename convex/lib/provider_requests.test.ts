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
      model: "deepseek-v4-flash",
      operation: "translation",
      messages: [{ role: "user", content: "private" }],
    });
    const image = buildOpenRouterImageRequest({
      apiKey: "secret",
      prompt: "rough visual direction",
    });

    expect(JSON.parse(String(text.init.body))).toMatchObject({
      model: "openai/gpt-5.6-terra",
      reasoning: { effort: "medium" },
      provider: {
        data_collection: "deny",
        zdr: true,
        allow_fallbacks: false,
        require_parameters: true,
      },
    });
    expect(JSON.parse(String(translation.init.body))).toMatchObject({
      model: "deepseek/deepseek-v4-flash",
      reasoning: { enabled: false },
    });
    expect(JSON.parse(String(image.init.body))).toMatchObject({
      model: "openai/gpt-image-2",
      quality: "medium",
      size: "1536x1024",
    });
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
});
