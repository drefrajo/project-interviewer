import {
  type BriefDraft,
  type BriefItem,
  type BriefItemKind,
  type BriefSection,
  type BriefSource,
  type RequirementState,
} from "./project-brief";
import {
  BRIEF_SECTION_IDS,
  type BriefSectionId,
} from "./project-brief-sections";

/**
 * The document seam for Project Brief editing.
 *
 * Markdown is deliberately a projection over the structured Brief. The
 * comments are invisible in a rendered document but give an editor a stable
 * identity for a section or item. Losing a comment is safe when the unchanged
 * item can be matched exactly; changing an item without its comment becomes a
 * new Freelancer-authored item rather than silently inheriting evidence.
 */
export class ProjectBriefMarkdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectBriefMarkdownError";
  }
}

type MarkdownArtifact = Pick<BriefDraft, "language" | "sections">;

const sectionComment = (sectionId: BriefSectionId) =>
  `<!-- project-brief:section id=${sectionId} -->`;

const itemComment = (itemId: string) =>
  `<!-- project-brief:item id=${itemId} -->`;

const itemCommentPattern =
  /^<!--\s*project-brief:item\s+id=([^\s>]+)\s*-->$/u;
const sectionCommentPattern =
  /^<!--\s*project-brief:section\s+id=([^\s>]+)\s*-->$/u;

const sectionId = (value: string): BriefSectionId | null =>
  (BRIEF_SECTION_IDS as readonly string[]).includes(value)
    ? (value as BriefSectionId)
    : null;

const defaultItem = (
  section: BriefSection,
): Pick<BriefItem, "kind" | "scopeStatus"> => {
  switch (section.id) {
    case "in-scope":
      return { kind: "requirement", scopeStatus: "in_scope" };
    case "out-of-scope":
      return { kind: "requirement", scopeStatus: "out_of_scope" };
    case "functional-requirements":
      return { kind: "requirement", scopeStatus: "open" };
    case "assumptions":
      return { kind: "assumption" };
    case "risks":
      return { kind: "risk" };
    case "gaps-and-contradictions":
      return { kind: "gap" };
    case "key-decisions":
      return { kind: "decision" };
    case "targets-and-external-constraints":
      return { kind: "target" };
    case "delivery-and-commercial":
      return { kind: "parameter" };
    default:
      return { kind: "requirement", scopeStatus: "open" };
  }
};

const normalized = (value: string) => value.replace(/\r\n/gu, "\n").trim();

export const serializeProjectBriefMarkdown = (
  artifact: MarkdownArtifact,
): string => {
  const title = artifact.language === "de" ? "Projektbrief" : "Project Brief";
  const lines = [`# ${title}`, ""];
  for (const section of artifact.sections) {
    lines.push(sectionComment(section.id), `## ${section.title}`, "");
    lines.push(section.content.trim(), "");
    for (const item of [...section.items].sort(
      (left, right) => left.order - right.order,
    )) {
      lines.push(itemComment(item.id), `- ${item.text.trim()}`, "");
    }
  }
  return lines.join("\n").trim();
};

type ParsedItem = {
  text: string;
  existingId?: string;
};

type ParsedSection = {
  id: BriefSectionId;
  title: string;
  content: string;
  items: ParsedItem[];
};

const parseSections = (
  markdown: string,
  current: BriefSection[],
): ParsedSection[] => {
  const lines = normalized(markdown).split("\n");
  const byId = new Map(current.map((section) => [section.id, section]));
  const byTitle = new Map<string, BriefSection>();
  for (const section of current) {
    const key = section.title.trim().toLocaleLowerCase();
    if (byTitle.has(key)) {
      throw new ProjectBriefMarkdownError(
        `The stored Project Brief has ambiguous section title “${section.title}”.`,
      );
    }
    byTitle.set(key, section);
  }

  const parsed: ParsedSection[] = [];
  let pendingSectionId: BriefSectionId | undefined;
  let pendingItemId: string | undefined;
  let active: ParsedSection | undefined;
  let contentLines: string[] = [];

  const flushContent = () => {
    if (!active) return;
    active.content = normalized(contentLines.join("\n"));
    contentLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const sectionMetadata = line.match(sectionCommentPattern);
    if (sectionMetadata) {
      const id = sectionId(sectionMetadata[1] ?? "");
      if (!id) {
        throw new ProjectBriefMarkdownError(
          "A Project Brief section marker names an unknown section.",
        );
      }
      pendingSectionId = id;
      continue;
    }
    const itemMetadata = line.match(itemCommentPattern);
    if (itemMetadata) {
      if (!active) {
        throw new ProjectBriefMarkdownError(
          "A Project Brief item marker must appear inside a section.",
        );
      }
      pendingItemId = itemMetadata[1];
      continue;
    }
    if (/^#\s+/u.test(line)) {
      if (!active && /^#\s+\S/u.test(line)) continue;
      throw new ProjectBriefMarkdownError(
        "Use only level-two headings for Project Brief sections.",
      );
    }
    const heading = line.match(/^##\s+(.+)$/u);
    if (heading) {
      if (active) flushContent();
      const title = (heading[1] ?? "").trim();
      const marked = pendingSectionId ? byId.get(pendingSectionId) : undefined;
      const matched = marked ?? byTitle.get(title.toLocaleLowerCase());
      if (!matched || matched.title.trim() !== title) {
        throw new ProjectBriefMarkdownError(
          `Unknown or renamed Project Brief heading “${title}”. Keep each existing heading exactly once.`,
        );
      }
      if (pendingSectionId && pendingSectionId !== matched.id) {
        throw new ProjectBriefMarkdownError(
          `The heading “${title}” does not match its Project Brief section marker.`,
        );
      }
      if (parsed.some((section) => section.id === matched.id)) {
        throw new ProjectBriefMarkdownError(
          `The Project Brief heading “${title}” appears more than once.`,
        );
      }
      active = { id: matched.id, title, content: "", items: [] };
      parsed.push(active);
      pendingSectionId = undefined;
      pendingItemId = undefined;
      continue;
    }
    const item = line.match(/^-\s+(.+)$/u);
    if (item) {
      if (!active) {
        throw new ProjectBriefMarkdownError(
          "A Project Brief list item must appear below a section heading.",
        );
      }
      const text = (item[1] ?? "").trim();
      if (!text) {
        throw new ProjectBriefMarkdownError("Project Brief list items cannot be empty.");
      }
      active.items.push({
        text,
        ...(pendingItemId ? { existingId: pendingItemId } : {}),
      });
      pendingItemId = undefined;
      continue;
    }
    if (pendingItemId && line.trim()) {
      throw new ProjectBriefMarkdownError(
        "A Project Brief item marker must be followed immediately by one list item.",
      );
    }
    if (active) contentLines.push(rawLine);
    else if (line.trim()) {
      throw new ProjectBriefMarkdownError(
        "Project Brief text must appear below a section heading.",
      );
    }
  }
  if (active) flushContent();
  if (pendingSectionId || pendingItemId) {
    throw new ProjectBriefMarkdownError(
      "A Project Brief marker is missing its heading or list item.",
    );
  }
  if (parsed.length !== current.length) {
    throw new ProjectBriefMarkdownError(
      "The Project Brief must contain every required section exactly once.",
    );
  }
  if (parsed.some((section, index) => section.id !== current[index]?.id)) {
    throw new ProjectBriefMarkdownError(
      "Project Brief sections must keep their existing order.",
    );
  }
  if (parsed.some((section) => !section.content.trim())) {
    throw new ProjectBriefMarkdownError(
      "Every Project Brief section needs content. Use “Not established” when appropriate.",
    );
  }
  return parsed;
};

const sameItemText = (left: BriefItem, right: ParsedItem) =>
  left.text.trim() === right.text.trim();

const addEditSource = (
  sources: BriefSource[],
  nextId: (prefix: string) => string,
  description: string,
): BriefSource[] => [
  ...sources,
  {
    type: "freelancer_edit",
    editId: nextId("brief_edit"),
    description,
  },
];

const nextRequirementState = (
  item: BriefItem | undefined,
  kind: BriefItemKind,
): RequirementState | undefined =>
  kind === "requirement"
    ? item?.requirementState ?? "candidate"
    : undefined;

export const replaceProjectBriefMarkdown = (
  draft: Pick<BriefDraft, "sections">,
  markdown: string,
  input: { nextId(prefix: string): string; now: number },
): { markdown: string; sections: BriefSection[] } => {
  const canonicalMarkdown = normalized(markdown);
  if (!canonicalMarkdown) {
    throw new ProjectBriefMarkdownError("The Project Brief Markdown document is required.");
  }
  if (canonicalMarkdown.length > 120_000) {
    throw new ProjectBriefMarkdownError("The Project Brief Markdown document is too large.");
  }
  const parsed = parseSections(canonicalMarkdown, draft.sections);
  const sections = parsed.map((nextSection) => {
    const previous = draft.sections.find(({ id }) => id === nextSection.id)!;
    const sectionChanged = previous.content.trim() !== nextSection.content;
    const unmatched = new Set(previous.items.map(({ id }) => id));
    const previousById = new Map(previous.items.map((item) => [item.id, item]));
    const items = nextSection.items.map((nextItem, order) => {
      const identified = nextItem.existingId
        ? previousById.get(nextItem.existingId)
        : undefined;
      if (nextItem.existingId && !identified) {
        throw new ProjectBriefMarkdownError(
          "A Project Brief item marker refers to an item that no longer exists.",
        );
      }
      const matched =
        identified ??
        previous.items.find(
          (item) => unmatched.has(item.id) && sameItemText(item, nextItem),
        );
      if (matched) unmatched.delete(matched.id);
      const changed = Boolean(matched && !sameItemText(matched, nextItem));
      const defaults = defaultItem(previous);
      const kind = matched?.kind ?? defaults.kind;
      const scopeStatus =
        kind === "requirement"
          ? matched?.scopeStatus ?? defaults.scopeStatus ?? "open"
          : undefined;
      return {
        id: matched?.id ?? input.nextId("brief_item"),
        sectionId: previous.id,
        kind,
        text: nextItem.text,
        ...(scopeStatus ? { scopeStatus } : {}),
        priority: matched?.priority ?? null,
        sources: matched
          ? changed
            ? addEditSource(
                matched.sources,
                input.nextId,
                `Freelancer edited ${previous.title}.`,
              )
            : structuredClone(matched.sources)
          : addEditSource([], input.nextId, "Freelancer-authored Brief item."),
        ...(matched && !changed && matched.findingId
          ? { findingId: matched.findingId }
          : {}),
        authoredBy: changed || !matched ? "freelancer" as const : matched.authoredBy,
        ...(nextRequirementState(matched, kind)
          ? { requirementState: nextRequirementState(matched, kind) }
          : {}),
        order,
        createdAt: matched?.createdAt ?? input.now,
        updatedAt: changed || !matched ? input.now : matched.updatedAt,
      } satisfies BriefItem;
    });
    return {
      ...structuredClone(previous),
      content: nextSection.content,
      sources: sectionChanged
        ? addEditSource(
            previous.sources,
            input.nextId,
            `Freelancer edited ${previous.title}.`,
          )
        : structuredClone(previous.sources),
      items,
    } satisfies BriefSection;
  });
  return { markdown: canonicalMarkdown, sections };
};
