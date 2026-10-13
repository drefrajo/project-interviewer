import { readFile, writeFile, mkdir } from "node:fs/promises";
import { buildConceptSeedMessages, buildVisualConceptImagePrompt, PROMPT_VERSION } from "../../convex/lib/interview_prompts";
import { buildOpenRouterTextRequest, buildOpenRouterImageRequest } from "../../convex/lib/provider_requests";
import { parseConceptSeeds } from "../../convex/lib/concept_seeds";

const apiKey = (await readFile("/tmp/interviewer-openrouter-key", "utf8")).trim();
const recording = JSON.parse(await readFile(".scratch/runtime/interview-evaluation/controlled/improved/photographer.json", "utf8"));
const output = `.scratch/runtime/interview-evaluation/visual-v${PROMPT_VERSION}`;
await mkdir(output, { recursive: true });
const seedRequest = buildOpenRouterTextRequest({ apiKey, model: "gpt-6.1-sol", operation: "concept_prompt", messages: buildConceptSeedMessages({ clientLanguage: "de", instructions: recording.instructions, projectDocument: recording.revision, interviewKind: "website" }) });
const response = await fetch(seedRequest.url, { ...seedRequest.init, signal: AbortSignal.timeout(300_000) });
const body = await response.json();
if (!response.ok || body.error) throw new Error(`Seeds failed: ${JSON.stringify(body.error)}`);
const concepts = parseConceptSeeds(body.choices[0].message.content);
await writeFile(`${output}/concepts.json`, JSON.stringify({ promptVersion: PROMPT_VERSION, concepts, usage: body.usage }, null, 2));
await Promise.all(concepts.map(async (concept, index) => {
  const prompt = buildVisualConceptImagePrompt({ instructions: recording.instructions, projectDocument: recording.revision, conceptPrompt: concept.prompt, conceptIndex: index + 1, interviewKind: "website", existingConcepts: concepts.filter((other) => other.id !== concept.id) });
  await writeFile(`${output}/${concept.id}-prompt.txt`, prompt);
  const request = buildOpenRouterImageRequest({ apiKey, prompt });
  const response = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(120_000) });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`Image failed: ${JSON.stringify(body.error)}`);
  if (!body.data?.[0]?.b64_json) throw new Error("Image response missing base64");
  await writeFile(`${output}/${concept.id}.png`, Buffer.from(body.data[0].b64_json, "base64"));
  console.log(`Rendered visual-v${PROMPT_VERSION}/${concept.id}`);
}));
