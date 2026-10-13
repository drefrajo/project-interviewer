import { mkdir, readFile, writeFile, open, unlink } from "node:fs/promises";
import { clients } from "./clients";
import { BUILT_IN_INTERVIEW_TEMPLATES } from "../../src/domain/interview-templates";
import { visualDirectionConfirmationSummary, type VisualDirection } from "../../src/domain/visual-direction";
import { buildInterviewPolicy, buildInterviewPlanMessages, buildProjectDocumentMessages, buildConceptSeedMessages, buildVisualConceptImagePrompt, PROMPT_VERSION } from "../../convex/lib/interview_prompts";
import { buildInterviewMessages } from "../../convex/lib/interview_messages";
import { parseInterviewOutput } from "../../convex/lib/interview_output";
import { resolveInterviewTurn } from "../../convex/lib/interview_turn";
import { parseConceptSeeds } from "../../convex/lib/concept_seeds";
import { buildOpenRouterTextRequest, buildOpenRouterImageRequest, type ProviderMessage } from "../../convex/lib/provider_requests";

// Manual-only evaluation. No hosted app client or deployment commands.
const apiKey = (await readFile("/tmp/interviewer-openrouter-key", "utf8")).trim();
const output = ".scratch/runtime/concept-selection";
await mkdir(output, { recursive: true });
type Operation = Parameters<typeof buildOpenRouterTextRequest>[0]["operation"];
type Seed = ReturnType<typeof parseConceptSeeds>[number];
type Record = { name: string; language: "en" | "de"; promptVersion: number; instructions: string; transcript: ProviderMessage[]; turns: Array<ReturnType<typeof parseInterviewOutput>>; plan?: string; document?: string; concepts?: Seed[]; choices: unknown[]; direction?: VisualDirection; reviewedSummary?: string; clientConfirmed?: boolean; usage: unknown[]; error?: string };
async function execute(request: { url: string; init: RequestInit }, timeout = 300_000) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(timeout) });
      const body = await response.json();
      if (response.ok && !body.error) return body;
      if (attempt === 2 || ![408, 429, 502, 503, 504].includes(body.error?.code ?? response.status)) throw new Error(`Provider ${response.status}: ${JSON.stringify(body.error)}`);
    } catch (error) {
      if (attempt === 2 || !(error instanceof Error && /timed out|timeout/i.test(error.message))) throw error;
    }
  }
  throw new Error("Provider retries exhausted");
}
async function complete(operation: Operation, messages: ProviderMessage[], json = false, imageMessages?: unknown[]) {
  const request = buildOpenRouterTextRequest({ apiKey, model: "gpt-6.1-sol", operation, messages });
  if (json || imageMessages) {
    const body = JSON.parse(String(request.init.body));
    body.response_format = { type: "json_object" }; body.max_tokens = 2200;
    if (imageMessages) body.messages = imageMessages;
    request.init.body = JSON.stringify(body);
  }
  const body = await execute(request);
  if (body.choices?.[0]?.finish_reason === "length") throw new Error("Truncated output");
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("No text output");
  return { content, usage: body.usage };
}

await Promise.all(clients.filter((client) => !process.argv[2] || client.id === process.argv[2]).map(async (client) => {
  const file = `${output}/${client.id}.json`;
  const lock = await open(`${file}.lock`, "wx");
  await lock.writeFile(String(process.pid));
  try {
    const instructions = `${BUILT_IN_INTERVIEW_TEMPLATES.find((template) => template._id === `built-in:website:${client.language}`)!.instructions}\n\nCREATOR SERVICE SCOPE\n${client.scope}`;
    let result: Record;
    try { result = JSON.parse(await readFile(file, "utf8")); } catch { result = { name: client.name, language: client.language, promptVersion: PROMPT_VERSION, instructions, transcript: [], turns: [], choices: [], usage: [] }; }
    if (result.instructions !== instructions) throw new Error("Instructions changed; archive this recording before a fresh run.");
    if (result.promptVersion !== PROMPT_VERSION) throw new Error("Prompt version changed; archive this recording before a fresh run.");
    delete result.error;
    const save = async () => {
      await writeFile(file, JSON.stringify(result, null, 2));
      await writeFile(`${output}/${client.id}.md`, `# ${client.name}\n\n${result.transcript.map((message) => `## ${message.role}\n\n${message.content}`).join("\n\n")}\n\n# Project Document\n\n${result.document ?? "Not generated"}\n\n# Reviewed Visual Direction\n\n${result.reviewedSummary ?? "No style agreed yet"}\n`);
    };
    await save();
    const document = async () => {
      const generated = await complete("document", buildProjectDocumentMessages({ instructions, transcript: result.transcript, interviewKind: "website" }));
      result.document = generated.content; result.usage.push(generated.usage); await save();
    };
    try {
      if (!result.document && result.turns.at(-1)?.kind === "ready") await document();
      while (!result.document && result.turns.length < 35) {
        if (!result.transcript.length || result.transcript.at(-1)?.role === "user") {
          if (!result.plan && result.transcript.filter((message) => message.role === "user").length === 1) {
            const plan = await complete("interview_plan", buildInterviewPlanMessages({ instructions, transcript: result.transcript, includesVisualConcepts: true }));
            result.plan = plan.content.trim().slice(0, 6000); result.usage.push(plan.usage); await save();
          }
          const alignmentAsked = result.turns.at(-1)?.kind === "alignment";
          const generated = await complete("interview", buildInterviewMessages(buildInterviewPolicy({ clientLanguage: client.language, instructions, alignmentAsked, includesVisualConcepts: true, ...(result.plan ? { interviewPlan: result.plan } : {}) }), client.language, result.transcript));
          const turn = parseInterviewOutput(generated.content);
          result.turns.push(turn); result.usage.push(generated.usage);
          console.log(`${client.id}: ${result.turns.length} ${turn.kind} ${turn.content.replace(/\s+/g, " ").slice(0, 130)}`);
          await save();
          if (resolveInterviewTurn(turn.kind, alignmentAsked) === "document") { await document(); break; }
          result.transcript.push({ role: "assistant", content: turn.content }); await save();
        }
        const reply = result.transcript.length === 1 ? { content: client.opening, usage: null } : await complete("document", [{ role: "system", content: `Simulate a real Client answering a website Interview in ${client.language === "de" ? "German" : "English"}. Private profile:\n${client.facts}\nAnswer only the latest question naturally, in 1-4 sentences. Do not dump the profile. Do not invent facts or optimize the interview. You do not know what visual style you want until seeing images. If asked to decide unseen colours/fonts/layout, say you need examples first. You may accept structure, content, scope and allowed behavior recommendations. At alignment correct errors or confirm content/scope while preserving visual exploration. Return ordinary text only.` }, ...result.transcript]);
        result.transcript.push({ role: "user", content: reply.content }); result.usage.push(reply.usage); await save();
      }
      if (!result.document) throw new Error("No document after 35 turns");
      if (!result.concepts) {
        const generated = await complete("concept_prompt", buildConceptSeedMessages({ clientLanguage: client.language, instructions, projectDocument: result.document }));
        result.concepts = parseConceptSeeds(generated.content); result.usage.push(generated.usage); await save();
      }
      const render = async (concepts: Seed[]) => {
        await Promise.all(concepts.map(async (concept) => {
          const imageFile = `${output}/${client.id}-${concept.id}.png`;
          try { await readFile(imageFile); return; } catch { /* Generate each missing image only once. */ }
          const prompt = buildVisualConceptImagePrompt({ instructions, projectDocument: result.document!, conceptPrompt: concept.prompt, conceptIndex: Number(concept.id.replace("concept_", "")), existingConcepts: result.concepts!.filter((other) => other.id !== concept.id) });
          await writeFile(`${output}/${client.id}-${concept.id}-prompt.txt`, prompt);
          const body = await execute(buildOpenRouterImageRequest({ apiKey, prompt }), 120_000);
          if (!body.data?.[0]?.b64_json) throw new Error("Image response has no base64");
          await writeFile(imageFile, Buffer.from(body.data[0].b64_json, "base64"));
          console.log(`${client.id}: rendered ${concept.id}`);
        }));
      };
      await render(result.concepts);
      if (!result.direction) {
        for (let round = 0; round < 2; round++) {
          const content: unknown[] = [{ type: "text", text: "Compare these actual rough concepts. Choose one you genuinely like; do not default to the first or choose a least-bad option. Photos/wording are illustrative. Return JSON: {kind:'concept'|'none', conceptId:string, keep:string, avoid:string, reason:string}. If none feels right, choose none. In keep/avoid, use ordinary words to describe actual visual preferences; explicitly say if nothing specific needs changing. Do not add features or pretend assets are real." }];
          for (const concept of result.concepts!) {
            const bytes = await readFile(`${output}/${client.id}-${concept.id}.png`);
            content.push({ type: "text", text: `${concept.id}: ${concept.name}\n${concept.rationale}` }, { type: "image_url", image_url: { url: `data:image/png;base64,${bytes.toString("base64")}` } });
          }
          const choice = await complete("interview", [], true, [{ role: "system", content: `You are ${client.name}, an actual-seeming Client with no preset visual style. Speak ${client.language === "de" ? "German" : "English"}. Your factual profile:\n${client.facts}\nYou are choosing from rendered images, not a prompt description. Be honest about appeal and concerns. Do not help the evaluator pass. These are rough visual directions within the Creator's service, not final designs. Return JSON only.` }, { role: "user", content }]);
          const parsed = JSON.parse(choice.content) as { kind: "concept" | "none"; conceptId: string; keep: string; avoid: string; reason: string };
          result.choices.push(parsed); result.usage.push(choice.usage); await save();
          console.log(`${client.id}: image-based choice ${JSON.stringify(parsed)}`);
          if (parsed.kind === "concept") {
            if (!result.concepts!.some((concept) => concept.id === parsed.conceptId) || !parsed.keep?.trim() || !parsed.avoid?.trim()) throw new Error("Invalid Client choice");
            result.direction = { kind: "concept", conceptId: parsed.conceptId, preferences: { keep: parsed.keep, avoid: parsed.avoid } }; await save(); break;
          }
          if (result.concepts!.length === 6) break;
          const extra = await complete("concept_prompt", buildConceptSeedMessages({ clientLanguage: client.language, instructions, projectDocument: result.document, existingConcepts: result.concepts }));
          const more = parseConceptSeeds(extra.content, 3); result.concepts!.push(...more); result.usage.push(extra.usage); await save(); await render(more);
        }
      }
      if (!result.direction) throw new Error("No fitting concept: no style agreement, no submission");
      if (!result.clientConfirmed) {
        result.reviewedSummary = visualDirectionConfirmationSummary(result.direction, result.concepts!.map((concept) => ({ id: concept.id, name: concept.name, description: concept.rationale })), client.language);
        await save();
        const review = await complete("interview", [{ role: "system", content: `You are ${client.name}. Profile:\n${client.facts}\nYou selected this direction after viewing actual images: ${JSON.stringify(result.direction)}. Review the exact style confirmation summary below. Confirm only if it reflects your choice and preferences, without promising features or implying final photos/copy are chosen. Return JSON {confirmed:boolean, reason:string}. Be honest, not helpful to the evaluator.` }, { role: "user", content: result.reviewedSummary }], true);
        const parsed = JSON.parse(review.content) as { confirmed: boolean; reason: string };
        result.clientConfirmed = parsed.confirmed; result.choices.push({ review: parsed }); result.usage.push(review.usage); await save();
        if (!parsed.confirmed) throw new Error(`Client did not confirm: ${parsed.reason}`);
      }
      console.log(`DONE ${client.id}: ${result.turns.length} turns, ${result.concepts!.length} rendered concepts, confirmed ${result.direction.kind === "concept" ? result.direction.conceptId : "references"}`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error); await save(); console.error(`FAILED ${client.id}: ${result.error}`);
    }
  } finally { await lock.close(); await unlink(`${file}.lock`); }
}));
