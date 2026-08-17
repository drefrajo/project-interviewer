import { describe, expect, it } from "vitest";
import {
  buildConceptSeedMessages,
  buildInterviewPlanMessages,
  buildInterviewPolicy,
  buildProjectDocumentMessages,
  buildProjectDocumentRevisionMessages,
  buildVisualConceptImagePrompt,
} from "./interview_prompts";

const instagramLikeInstructions = `
Use an Instagram-like interface for a photographer's portfolio.
Client galleries are presented as stories and the photographer's works as posts.
`;

describe("Interview prompt contracts", () => {
  it("tells the Interview Model to preserve a defining interaction model and avoid unsolicited technical prescriptions", () => {
    const policy = buildInterviewPolicy({
      clientLanguage: "en",
      instructions: instagramLikeInstructions,
      alignmentAsked: false,
    });
    const normalized = policy.replace(/\s+/g, " ");

    expect(normalized).toContain("organizing principle");
    expect(normalized).toContain("Do not replace it with a conventional website");
    expect(normalized).toContain("Do not add low-level technical specifications");
    expect(normalized).toContain("numerical asset budgets");
  });

  it("makes the Interview consultative and requires alignment before completion", () => {
    const discoveryPolicy = buildInterviewPolicy({
      clientLanguage: "en",
      instructions: instagramLikeInstructions,
      alignmentAsked: false,
    }).replace(/\s+/g, " ");
    const confirmationPolicy = buildInterviewPolicy({
      clientLanguage: "en",
      instructions: instagramLikeInstructions,
      alignmentAsked: true,
    }).replace(/\s+/g, " ");

    expect(discoveryPolicy).toContain("one primary decision at a time");
    expect(discoveryPolicy).toContain("recommend a sensible default");
    expect(discoveryPolicy).toContain(
      "Never treat uncertainty or a request for your recommendation as permission to finish",
    );
    expect(discoveryPolicy).toContain(
      "include two to four concise Suggested Replies",
    );
    expect(discoveryPolicy).toContain('"kind":"alignment"');
    expect(discoveryPolicy).not.toContain('"kind":"ready"');
    expect(confirmationPolicy).toContain('"kind":"ready"');
    expect(confirmationPolicy).toContain(
      "only after the Client explicitly confirms",
    );
  });

  it("creates one tentative private plan after the first Client reply", () => {
    const planningMessages = buildInterviewPlanMessages({
      instructions: instagramLikeInstructions,
      transcript: [
        { role: "assistant", content: "What should the site achieve?" },
        { role: "user", content: "Present my photography." },
      ],
    });
    const plannedPolicy = buildInterviewPolicy({
      clientLanguage: "en",
      instructions: instagramLikeInstructions,
      alignmentAsked: false,
      interviewPlan:
        "Known: photographer portfolio. Next: decide how contact should work.",
    }).replace(/\s+/g, " ");
    const planningPrompt = JSON.stringify(planningMessages);

    expect(planningPrompt).toContain("private adaptive Interview Plan");
    expect(planningPrompt).toContain("Return only the plan");
    expect(planningPrompt).toContain("Present my photography");
    expect(planningPrompt).not.toContain("suggestedReplies");
    expect(plannedPolicy).toContain("Known: photographer portfolio");
    expect(plannedPolicy).toContain("tentative navigation aid");
    expect(plannedPolicy).toContain("latest Client statements always override it");
  });

  it("carries Creator Interview Instructions into Visual Concept prompt generation", () => {
    const context = {
      clientLanguage: "en" as const,
      instructions: instagramLikeInstructions,
      projectDocument:
        "# Photographer portfolio\n\nShow still life and portrait work.",
    };
    const messages = buildConceptSeedMessages(context);
    const serialized = JSON.stringify(messages).replace(/\\n/g, " ");

    expect(serialized).toContain("Instagram-like interface");
    expect(serialized).toContain(
      "Client galleries are presented as stories",
    );
    expect(serialized).toContain("non-negotiable");
    expect(serialized).toContain("generic marketing homepage");
    expect(serialized).toContain("under 800 characters");
    expect(serialized).toContain("pairwise contrast");
    expect(serialized).toContain("at least three");
    expect(serialized).toContain("faithful baseline");
    expect(serialized).toContain("spatial counterpoint");
    expect(serialized).toContain("navigational counterpoint");
    expect(serialized).toContain("not automatically binding");
    expect(serialized).toContain("decision-relevant");
    expect(serialized).toContain("content fidelity");
    expect(serialized).toContain("Do not invent brand or content traits");
  });

  it("requires three different page skeletons rather than styled versions of one layout", () => {
    const messages = buildConceptSeedMessages({
      clientLanguage: "en",
      instructions: instagramLikeInstructions,
      projectDocument: "# Photographer portfolio",
    });
    const serialized = JSON.stringify(messages).replace(/\\n/g, " ");

    expect(serialized).toContain("different page skeleton");
    expect(serialized).toContain("above-the-fold information flow");
    expect(serialized).toContain("client-gallery entry placement");
    expect(serialized).toContain("contact or conversion integration");
    expect(serialized).toContain(
      "Palette, typography, spacing, and decoration do not count as macro-layout differences",
    );
  });

  it("separates fixed experience grammar from variable concept layout", () => {
    const messages = buildConceptSeedMessages({
      clientLanguage: "en",
      instructions: instagramLikeInstructions,
      projectDocument: "# Photographer portfolio",
    });
    const systemPrompt = messages[0]?.content ?? "";

    expect(systemPrompt).toContain("SHARED EXPERIENCE GRAMMAR");
    expect(systemPrompt).toContain("VARIABLE DESIGN TERRITORY");
    expect(systemPrompt).toContain("identity and hierarchy");
    expect(systemPrompt).toContain("application navigation");
    expect(systemPrompt).toContain("content-unit structure");
    expect(systemPrompt).toContain("visible state or progress");
    expect(systemPrompt).toContain('"Shared experience grammar:"');
    expect(systemPrompt).toContain('"Concept-specific layout:"');
    expect(systemPrompt).toContain(
      "It must not reinterpret the project as a magazine, archive",
    );
    expect(systemPrompt).toContain(
      "presentation deck, or conventional portfolio website",
    );
  });

  it("plans an additional batch outside the territory occupied by prior concepts", () => {
    const messages = buildConceptSeedMessages({
      clientLanguage: "en",
      instructions: instagramLikeInstructions,
      projectDocument: "# Photographer portfolio",
      existingConcepts: [
        {
          name: "Faithful Refinement",
          rationale: "Quiet white three-column feed with sans-serif type.",
          prompt: "A bright, evenly spaced feed.",
        },
        {
          name: "Atmospheric Counterpoint",
          rationale: "Warm cream editorial feed with serif typography.",
          prompt: "A warm, tactile editorial feed.",
        },
        {
          name: "Structural Counterpoint",
          rationale: "Dark dense masonry feed with graphic typography.",
          prompt: "A dark asymmetric masonry feed.",
        },
      ],
    });
    const serialized = JSON.stringify(messages).replace(/\\n/g, " ");

    expect(serialized).toContain("exactly three additional");
    expect(serialized).toContain("EXISTING VISUAL CONCEPTS");
    expect(serialized).toContain("Quiet white three-column feed");
    expect(serialized).toContain("unoccupied");
    expect(serialized).toContain("coverage expansion after the Client rejected");
    expect(serialized).toContain("different shared visual assumption");
    expect(serialized).toContain("different dominant design bet");
    expect(serialized).toContain("art direction and typography");
    expect(serialized).toContain("spatial composition and media scale");
    expect(serialized).toContain("navigation and interaction rhythm");
    expect(serialized).toContain("same palette family and composition family");
    expect(serialized).toContain(
      "Each new page skeleton must also differ from every existing page skeleton on at least two macro-layout dimensions",
    );
    expect(serialized).not.toContain("Assign these roles in order");
  });

  it("separates localized card copy from the English image prompt", () => {
    const messages = buildConceptSeedMessages({
      clientLanguage: "de",
      instructions: instagramLikeInstructions,
      projectDocument: "# Fotografenportfolio",
    });
    const serialized = JSON.stringify(messages);

    expect(serialized).toContain("name and rationale are shown directly to the Client");
    expect(serialized).toContain("German");
    expect(serialized).toContain("image-generation prompt and must always be written in English");
  });

  it("repeats the defining interaction model at the image-rendering boundary", () => {
    const prompt = buildVisualConceptImagePrompt({
      instructions: instagramLikeInstructions,
      projectDocument:
        "# Experience\n\nThe work is browsed as a continuously scrolling feed.",
      conceptPrompt: "A high-contrast editorial direction.",
      conceptIndex: 2,
    });
    const normalized = prompt.replace(/\s+/g, " ");

    expect(normalized).toContain("Instagram-like interface");
    expect(normalized).toContain("Client galleries are presented as stories");
    expect(normalized).toContain("full interface grammar");
    expect(normalized).toContain(
      "do not substitute a generic hero-led marketing page",
    );
    expect(normalized).toContain("DIVERSITY ROLE 2");
    expect(normalized).toContain("spatial counterpoint");
    expect(normalized).toContain(
      "overrides visual-style recommendations in the Project Document",
    );
    expect(normalized).toContain("CONTENT FIDELITY");
    expect(normalized).toContain(
      "Apply visual variation to the interface around the content",
    );
    expect(normalized).toContain(
      "Do not alter the depicted media's color, tone, texture, subject matter, or style",
    );
    expect(normalized).toContain(
      "A recognizable interaction model is not a fixed page skeleton",
    );
    expect(normalized).toContain(
      "Do not default to the same header, horizontal item strip, feed grid, and lower contact block",
    );
    expect(normalized).toContain("SHARED EXPERIENCE GRAMMAR IS IMMUTABLE");
    expect(normalized).toContain("CONCEPT-SPECIFIC LAYOUT IS VARIABLE");
    expect(normalized).toContain(
      "Render one believable application viewport and interaction state",
    );
    expect(normalized).toContain(
      "Do not compress the entire website, contact form, footer, and every content section into one screenshot",
    );
    expect(normalized).toContain(
      "Would the named interface influence still be recognizable",
    );
  });

  it("does not cycle concept four back to concept one's rendering role", () => {
    const prompt = buildVisualConceptImagePrompt({
      instructions: instagramLikeInstructions,
      projectDocument: "# Photographer portfolio",
      conceptPrompt: "An immersive edge-to-edge sequence with compact controls.",
      conceptIndex: 4,
      existingConcepts: [
        {
          name: "Faithful Refinement",
          rationale: "Quiet white three-column feed.",
          prompt:
            "Bright white surfaces, circular stories, an even three-column grid, and restrained sans-serif typography.",
        },
      ],
    });

    expect(prompt).toContain("OTHER CONCEPT DIRECTIONS — DO NOT REPEAT");
    expect(prompt).toContain("Quiet white three-column feed");
    expect(prompt).toContain("circular stories");
    expect(prompt).toContain("three-column grid");
    expect(prompt).toContain("unexplored direction");
    expect(prompt).not.toContain("faithful refinement: stay nearest");
  });

  it("keeps the prompt contract when revising a Project Document", () => {
    const messages = buildProjectDocumentRevisionMessages({
      instructions: instagramLikeInstructions,
      projectDocument: "# Existing document",
      feedback: "Use a darker visual direction.",
    });
    const normalized = messages
      .map(({ content }) => content)
      .join(" ")
      .replace(/\s+/g, " ");

    expect(normalized).toContain("Instagram-like interface");
    expect(normalized).toContain("remain authoritative");
    expect(normalized).toContain("defining interaction model");
    expect(normalized).toContain("unsolicited low-level technical specifications");
  });

  it("generates the initial Project Document separately from the fast Interview turn", () => {
    const messages = buildProjectDocumentMessages({
      instructions: instagramLikeInstructions,
      transcript: [
        { role: "user", content: "I want a portfolio that feels like a feed." },
        {
          role: "assistant",
          content: "I recommend client projects as stories. Does that feel right?",
        },
        { role: "user", content: "Yes, that feels right." },
      ],
    });
    const normalized = messages
      .map(({ content }) => content)
      .join(" ")
      .replace(/\s+/g, " ");

    expect(normalized).toContain("Instagram-like interface");
    expect(normalized).toContain("complete first-draft copy");
    expect(normalized).toContain("UNKNOWN");
    expect(normalized).toContain("I want a portfolio that feels like a feed.");
    expect(normalized).toContain("Return only the complete Markdown");
  });

  it("gives Privacy document prompts a data-map contract without Website assumptions", () => {
    const messages = buildProjectDocumentMessages({
      instructions: "Map the company's customer data flows.",
      transcript: [],
      interviewKind: "privacy",
    });
    const normalized = messages
      .map(({ content }) => content)
      .join(" ")
      .replace(/\s+/g, " ");

    expect(normalized).toContain("factual privacy data map");
    expect(normalized).toContain("privacy-policy preparation document");
    expect(normalized).toContain("qualified legal or privacy review");
    expect(normalized).toContain("evidence gap");
    expect(normalized).toContain("actual personal data");
    for (const websiteOnlyTerm of [
      "complete first-draft copy",
      "requested experience",
      "content hierarchy",
      "visual-direction level",
      "pixel dimensions",
      "framework choices",
      "hosting details",
      "defining interaction model",
      "website",
    ]) {
      expect(normalized).not.toContain(websiteOnlyTerm);
    }
  });

  it("gives Custom document prompts control over the document shape and domain", () => {
    const messages = buildProjectDocumentMessages({
      instructions: "Interview a team about its internal operating model.",
      transcript: [],
      interviewKind: "custom",
    });
    const normalized = messages
      .map(({ content }) => content)
      .join(" ")
      .replace(/\s+/g, " ");

    expect(normalized).toContain("choose the document shape");
    expect(normalized).toContain("Creator-defined outcome");
    expect(normalized).toContain("Do not impose a conventional domain");
    for (const websiteOnlyTerm of [
      "complete first-draft copy",
      "content hierarchy",
      "visual-direction level",
      "pixel dimensions",
      "framework choices",
      "hosting details",
      "defining interaction model",
      "website",
    ]) {
      expect(normalized).not.toContain(websiteOnlyTerm);
    }
  });

  it("keeps Privacy and Custom revision prompts out of the Website document contract", () => {
    const websiteOnlyTerms = [
      "complete first-draft copy",
      "content hierarchy",
      "visual-direction level",
      "pixel dimensions",
      "framework choices",
      "hosting details",
      "defining interaction model",
    ];
    const privacy = buildProjectDocumentRevisionMessages({
      instructions: "Map data flows.",
      projectDocument: "# Data map",
      feedback: "Add the retention evidence gap.",
      interviewKind: "privacy",
    })
      .map(({ content }) => content)
      .join(" ")
      .replace(/\s+/g, " ");
    const custom = buildProjectDocumentRevisionMessages({
      instructions: "Define an internal operating model interview.",
      projectDocument: "# Operating model",
      feedback: "Change the output structure.",
      interviewKind: "custom",
    })
      .map(({ content }) => content)
      .join(" ")
      .replace(/\s+/g, " ");

    expect(privacy).toContain("privacy data map");
    expect(privacy).toContain("qualified legal or privacy review");
    expect(privacy).toContain("evidence gaps");
    expect(custom).toContain("Creator-defined subject");
    expect(custom).toContain("document purpose, shape");
    for (const websiteOnlyTerm of websiteOnlyTerms) {
      expect(privacy).not.toContain(websiteOnlyTerm);
      expect(custom).not.toContain(websiteOnlyTerm);
    }
    expect(privacy).not.toContain("website");
    expect(custom).not.toContain("website");
  });

  it("branches the Interview Policy for privacy data mapping without legal claims", () => {
    const policy = buildInterviewPolicy({
      clientLanguage: "en",
      instructions: "Map the company's customer data flows.",
      alignmentAsked: false,
      interviewKind: "privacy",
    }).replace(/\s+/g, " ");

    expect(policy).toContain("privacy data-mapping Interview");
    expect(policy).toContain("not legal advice");
    expect(policy).toContain("actual personal data");
    expect(policy).toContain("credentials");
    expect(policy).toContain("evidence gaps");
    expect(policy).toContain("data is collected");
    expect(policy).not.toContain("conventional website");
  });

  it("keeps custom Interview prompts generic and permits generic concepts", () => {
    const policy = buildInterviewPolicy({
      clientLanguage: "en",
      instructions: "Interview a team about its internal operating model.",
      alignmentAsked: false,
      interviewKind: "custom",
    }).replace(/\s+/g, " ");
    expect(policy).toContain("Creator-defined Interview");
    expect(policy).toContain("Do not assume a conventional domain");
    expect(policy).not.toContain("website project Interview");

    const concepts = buildConceptSeedMessages({
      clientLanguage: "en",
      instructions: "Interview a team about its internal operating model.",
      projectDocument: "# Operating model",
      interviewKind: "custom",
    });
    expect(JSON.stringify(concepts)).toContain("do not assume a conventional medium");
    expect(JSON.stringify(concepts)).toContain("Creator-defined outcome");

    const imagePrompt = buildVisualConceptImagePrompt({
      instructions: "Interview a team about its internal operating model.",
      projectDocument: "# Operating model",
      conceptPrompt: "A visual map of the operating model.",
      conceptIndex: 1,
      interviewKind: "custom",
    }).replace(/\s+/g, " ");
    expect(imagePrompt).toContain("Render an appropriate visual representation");
    expect(imagePrompt).toContain("For a nonvisual subject, visualize");
    expect(imagePrompt).not.toContain("describe the relevant representation instead");
  });

  it("does not create concept prompts for Privacy Interviews", () => {
    expect(() =>
      buildConceptSeedMessages({
        clientLanguage: "en",
        instructions: "Map data flows.",
        projectDocument: "# Data map",
        interviewKind: "privacy",
      }),
    ).toThrow("Privacy Interviews cannot generate Visual Concepts.");
    expect(() =>
      buildVisualConceptImagePrompt({
        instructions: "Map data flows.",
        projectDocument: "# Data map",
        conceptPrompt: "A visual direction",
        conceptIndex: 1,
        interviewKind: "privacy",
      }),
    ).toThrow("Privacy Interviews cannot generate Visual Concepts.");
  });
});
