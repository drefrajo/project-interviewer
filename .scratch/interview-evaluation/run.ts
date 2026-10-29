import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { clients, serviceScope } from "./clients";
import * as baseline from "./baseline-prompts";
import * as current from "../../convex/lib/interview_prompts";
import { BUILT_IN_INTERVIEW_TEMPLATES as baselineTemplates } from "./baseline-templates";
import { BUILT_IN_INTERVIEW_TEMPLATES as currentTemplates } from "../../src/domain/interview-templates";
import { buildInterviewMessages } from "../../convex/lib/interview_messages";
import { parseInterviewOutput } from "../../convex/lib/interview_output";
import { resolveInterviewTurn } from "../../convex/lib/interview_turn";
import { parseConceptSeeds } from "../../convex/lib/concept_seeds";
import { buildOpenRouterTextRequest, buildOpenRouterImageRequest, type ProviderMessage } from "../../convex/lib/provider_requests";

// Manual-only, no Convex client, mutations, emails, deployment or app imports.
const phase = process.argv[2];
if (phase !== "baseline" && phase !== "improved") throw new Error("Use baseline or improved.");
const prompts = phase === "baseline" ? baseline : current;
const templates = phase === "baseline" ? baselineTemplates : currentTemplates;
const apiKey = (await readFile("/tmp/interviewer-openrouter-key", "utf8")).trim();
if (!apiKey) throw new Error("Development key missing.");
const runName = process.argv.find((arg) => arg.startsWith("--run="))?.slice(6);
if (runName && !/^[a-z0-9-]+$/.test(runName)) throw new Error("Invalid run name");
const output = `.scratch/runtime/interview-evaluation/${runName ? `${runName}/` : ""}${phase}`;
await mkdir(output, { recursive: true });
const selected = clients.filter((c) => !process.argv[3] || process.argv[3].startsWith("--") || c.id === process.argv[3]);

async function complete(operation: Parameters<typeof buildOpenRouterTextRequest>[0]["operation"], messages: ProviderMessage[], clientSimulation = false) {
  const request = buildOpenRouterTextRequest({ apiKey, model: "gpt-6.1-sol", operation, messages });
  if (clientSimulation) {
    const body = JSON.parse(String(request.init.body));
    delete body.response_format;
    body.max_tokens = 1400;
    request.init.body = JSON.stringify(body);
  }
  let body;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(300_000) });
    body = await response.json();
    if (response.ok && !body.error) break;
    if (attempt < 2 && [429, 502, 503, 504].includes(body.error?.code ?? response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(`Provider ${response.status}: ${JSON.stringify(body.error)}`);
  }
  const choice = body.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error(`Truncated ${operation} output; cannot evaluate as a completed turn.`);
  if (typeof choice?.message?.content !== "string" || !choice.message.content.trim()) throw new Error("Empty provider content");
  return { content: choice.message.content as string, usage: body.usage };
}

await Promise.all(selected.map(async (client) => {
  const path = `${output}/${client.id}.json`;
  const lockPath = `${path}.lock`;
  const lock = await open(lockPath, "wx");
  await lock.writeFile(String(process.pid));
  try {
  type Result = { name: string; phase: string; model: string; instructions: string; transcript: ProviderMessage[]; turns: Array<ReturnType<typeof parseInterviewOutput>>; plan?: string; document?: string; revision?: string; concepts?: ReturnType<typeof parseConceptSeeds>; visualDirection?: { kind: string; conceptId: string; note: string }; grade?: unknown; usage: unknown[]; error?: string };
  const instructions = `${templates.find((t) => t.interviewKind === "website" && t.sourceLanguage === client.language)!.instructions}\n\nCREATOR SERVICE SCOPE:\n${serviceScope}`;
  let result: Result;
  try { result = JSON.parse(await readFile(path, "utf8")); } catch { result = { name: client.name, phase, model: "gpt-6.1-sol / low", instructions, transcript: [], turns: [], usage: [] }; }
  if (result.instructions !== instructions) throw new Error("Instructions changed; use a new --run name instead of mixing recordings.");
  delete result.error;
  const save = async () => {
    await writeFile(path, JSON.stringify(result, null, 2));
    await writeFile(`${output}/${client.id}.md`, `# ${client.name} — ${phase}\n\n${result.transcript.map((m) => `## ${m.role}\n\n${m.content}`).join("\n\n")}\n\n# Project Document\n\n${result.document ?? "Not generated"}\n\n# Revised Project Document\n\n${result.revision ?? "Not generated"}\n`);
  };
  try {
    if (!result.document && ["ready", "document"].includes(result.turns.at(-1)?.kind ?? "")) {
      const doc = await complete("document", prompts.buildProjectDocumentMessages({ instructions, transcript: result.transcript, interviewKind: "website" }));
      result.document = doc.content; result.usage.push(doc.usage); await save();
    }
    let alignmentAsked = result.turns.at(-1)?.kind === "alignment";
    for (let i = result.turns.length; !result.document && i < 35; i++) {
      if (i === 0 || result.transcript.at(-1)?.role === "user") {
        const generated = await complete("interview", buildInterviewMessages(prompts.buildInterviewPolicy({ clientLanguage: client.language, instructions, alignmentAsked, ...(result.plan ? { interviewPlan: result.plan } : {}) }), client.language, result.transcript));
        result.usage.push(generated.usage);
        const turn = parseInterviewOutput(generated.content);
        result.turns.push(turn);
        console.log(`${phase}/${client.id} turn ${result.turns.length}: ${turn.kind} ${turn.content.replace(/\s+/g, " ").slice(0, 160)}`);
        if (resolveInterviewTurn(turn.kind, alignmentAsked) === "document") {
          const doc = await complete("document", prompts.buildProjectDocumentMessages({ instructions, transcript: result.transcript, interviewKind: "website" }));
          result.document = doc.content; result.usage.push(doc.usage); await save(); break;
        }
        result.transcript.push({ role: "assistant", content: turn.content });
        // Mirrors jobs.completeText: an ordinary question clears the checkpoint.
        alignmentAsked = turn.kind === "alignment";
        await save();
      }
      const clientReply = result.transcript.length === 1
        ? { content: client.opening, usage: null }
        : await complete("interview", [{ role: "system", content: `You simulate a real Client in a website Interview. Reply in ${client.language === "de" ? "German" : "English"}. Your private factual profile:\n${client.facts}\nAnswer ONLY the current question, naturally and briefly (1-4 sentences), with available facts. Never dump this profile or volunteer unrelated decisions. Do not optimize the Interview or know its policy. Do not invent facts. When asked for a recommendation accept a sensible proposal unless it conflicts with your profile. At alignment confirm if it fits; otherwise state one correction. Facts outside the profile remain unknown. Never adopt invented claims just because the interviewer suggests them. Return ordinary text only.` }, ...result.transcript], true);
      result.transcript.push({ role: "user", content: clientReply.content });
      result.usage.push(clientReply.usage);
      if (!result.plan && result.transcript.filter((m) => m.role === "user").length === 1) {
        const plan = await complete("interview_plan", prompts.buildInterviewPlanMessages({ instructions, transcript: result.transcript }));
        result.plan = plan.content.trim().slice(0, 6000); result.usage.push(plan.usage);
      }
      await save();
    }
    if (!result.document) throw new Error("Did not complete within 35 interviewer turns.");
    if (!result.revision) {
      const revision = await complete("document", prompts.buildProjectDocumentRevisionMessages({ instructions, projectDocument: result.document, feedback: client.revision, interviewKind: "website" }));
      result.revision = revision.content; result.usage.push(revision.usage); await save();
    }
    if (!result.concepts) {
      const seeds = await complete("concept_prompt", prompts.buildConceptSeedMessages({ clientLanguage: client.language, instructions, projectDocument: result.revision!, interviewKind: "website" }));
      result.concepts = parseConceptSeeds(seeds.content); result.usage.push(seeds.usage); await save();
    }
    if (!result.visualDirection) {
      // Text-only simulated choice; real rendered concepts are separately checked.
      result.visualDirection = { kind: "concept", conceptId: result.concepts![0]!.id, note: "Use this direction while preserving all confirmed content, original image treatment and explicit visual constraints from the Project Document." };
      delete result.grade;
      await save();
    }
    if (!result.grade) {
      const grade = await complete("document", [{ role: "system", content: `Evaluate this website interview handoff against a strict criterion: a builder must be able to implement from the Project Submission without another conversation about content or design. The selected Visual Direction is part of that handoff; unselected concepts are alternatives, not unresolved choices. This is text-handoff evaluation; do not assume generated pixels have been inspected. Assets, legal text and secure deployment access can arrive by email only if exact purpose/owner/missing item are recorded. Observing an actual image to write literal alt text does not require a Client content decision. Scope is authoritative: no excluded feature may be promised, including in revisions. Client confirmation is not evidence for invented business facts. Critique objectively. Return JSON with readyWithoutFurtherContentOrDesignConversation (boolean), blockers (array of strings), strengths (array), scopeViolations (array), inventedFacts (array), missingKnownFacts (array), designActionable (boolean), copyComplete (boolean), revisionCorrect (boolean), conceptConstraintsPreserved (boolean). Do not treat unspecified nonessential preferences as blockers when clear defaults/omissions are documented. Distinguish legal text/assets from unresolved content. Private profile is the ground truth for checking facts but facts never elicited cannot magically be used in the handoff.` }, { role: "user", content: JSON.stringify({ scope: serviceScope, client: client.facts, transcript: result.transcript, document: result.document, requestedRevision: client.revision, revision: result.revision, concepts: result.concepts, visualDirection: result.visualDirection }) }]);
      result.grade = JSON.parse(grade.content.replace(/^```json\s*|\s*```$/g, "")); result.usage.push(grade.usage); await save();
    }
    if (phase === "improved" && client.id === "photographer" && process.argv.includes("--images")) {
      await Promise.all(result.concepts!.map(async (concept, index) => {
        const imagePath = `${output}/${client.id}-${concept.id}.png`;
        try { await readFile(imagePath); return; } catch { /* Generate only once. */ }
        const prompt = prompts.buildVisualConceptImagePrompt({ instructions, projectDocument: result.revision!, conceptPrompt: concept.prompt, conceptIndex: index + 1, interviewKind: "website", existingConcepts: result.concepts!.filter((other) => other.id !== concept.id) });
        const request = buildOpenRouterImageRequest({ apiKey, prompt });
        const response = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(120_000) });
        const body = await response.json();
        if (!response.ok) throw new Error(`Image request ${response.status}: ${JSON.stringify(body.error)}`);
        const b64 = body.data?.[0]?.b64_json;
        if (!b64) throw new Error(`Image response not base64; shape ${Object.keys(body)}`);
        await writeFile(imagePath, Buffer.from(b64, "base64"));
        console.log(`Rendered ${client.id}/${concept.id}`);
      }));
    }
    console.log(`DONE ${phase}/${client.id}: ${result.turns.length} turns, grade ${JSON.stringify(result.grade)}`);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error); await save(); console.error(`FAILED ${phase}/${client.id}: ${result.error}`);
  }
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}));
