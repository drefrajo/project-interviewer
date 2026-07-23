import type {
  CoverageArea,
  EvidenceReference,
  InterviewAgentDelta,
  InterviewAdapters,
  InterviewQuestionDraft,
} from "../domain/discovery-interview";
import type { Language } from "../domain/project-interviewer";
import type { ContextPackRevision } from "../domain/project-material";

const AREA_IDS = [
  "goals-users",
  "scope",
  "constraints",
  "success",
  "delivery",
] as const;

type AreaId = (typeof AREA_IDS)[number];

const copy = <T>(value: T): T => structuredClone(value);

const boundedFindingStatement = (
  prefix: string,
  detail: string,
): string => {
  const statement = `${prefix}${detail}`;
  return statement.length <= 1_000
    ? statement
    : `${statement.slice(0, 999).trimEnd()}…`;
};

const isCandidateRequirement = (statement: string): boolean => {
  const text = statement.toLocaleLowerCase();
  const quality =
    /\b(accessib|secure|security|reliab|scalab|perform|latency|response time|load within|uptime|compliant|barriere|sicher|zuverläss|skalier|leistung|ladezeit|antwortzeit|verfügbar)\w*/i.test(
      text,
    );
  const constraint =
    /\b(budget|deadline|launch date|fixed cost|must use|cannot use|legal|regulat|hosting|technology|tech stack|frist|termin|festpreis|muss .*verwenden|darf nicht|rechtlich|hosting|technologie)\w*/i.test(
      text,
    );
  const capability =
    /\b(must|should|needs?|requires?|include|support|allow|enable|provide|feature|function|belongs? in|part of|muss|soll|benötigt|erfordert|enthalten|unterstütz|ermöglich|bereitstell|funktion|gehört)\w*/i.test(
      text,
    );
  const pureTarget =
    /\b(target|goal|metric|kpi|measure|reduce|increase|improve by|percent|percentage|ziel|kennzahl|messen|reduzier|steiger|verbesser.*prozent)\w*/i.test(
      text,
    ) ||
    /(budgetziel|zielbudget|zieltermin|startziel|launchziel)/i.test(
      text,
    );
  return quality || ((constraint || capability) && !pureTarget);
};

const labels: Record<Language, Record<AreaId, string>> = {
  en: {
    "goals-users": "Goals and users",
    scope: "Scope and requirements",
    constraints: "Constraints and risks",
    success: "Success criteria",
    delivery: "Delivery and collaboration",
  },
  de: {
    "goals-users": "Ziele und Nutzer",
    scope: "Umfang und Anforderungen",
    constraints: "Rahmenbedingungen und Risiken",
    success: "Erfolgskriterien",
    delivery: "Lieferung und Zusammenarbeit",
  },
};
const rubrics: Record<Language, Record<AreaId, string>> = {
  en: {
    "goals-users": "Establish the outcome, problem, and primary users.",
    scope: "Establish the first-release scope and explicit exclusions.",
    constraints: "Establish budget, timing, technology, legal, and operational constraints.",
    success: "Establish observable acceptance and success criteria.",
    delivery: "Establish stakeholders, decisions, handoff, and delivery expectations.",
  },
  de: {
    "goals-users": "Ergebnis, Problem und primäre Nutzer klären.",
    scope: "Umfang der ersten Version und klare Ausschlüsse klären.",
    constraints: "Budget, Zeit, Technik, Recht und betriebliche Grenzen klären.",
    success: "Beobachtbare Abnahme- und Erfolgskriterien klären.",
    delivery: "Beteiligte, Entscheidungen, Übergabe und Lieferung klären.",
  },
};

const questions: Record<Language, Record<AreaId, string>> = {
  en: {
    "goals-users": "Who will use this product, and what should become better for them?",
    scope: "What must the first useful release include, and what is explicitly outside its scope?",
    constraints: "Which budget, timing, technical, legal, or operational constraints must shape the solution?",
    success: "What observable result would make you accept the first release as successful?",
    delivery: "Who decides, who provides feedback, and how should delivery and handoff work?",
  },
  de: {
    "goals-users": "Wer wird das Produkt nutzen, und was soll für diese Personen besser werden?",
    scope: "Was muss die erste nützliche Version enthalten, und was gehört ausdrücklich nicht dazu?",
    constraints: "Welche Budget-, Zeit-, technischen, rechtlichen oder betrieblichen Grenzen müssen die Lösung prägen?",
    success: "An welchem beobachtbaren Ergebnis würden Sie eine erfolgreiche erste Version erkennen?",
    delivery: "Wer entscheidet, wer gibt Feedback, und wie sollen Lieferung und Übergabe ablaufen?",
  },
};

const evidenceFromContext = (
  contextPack: ContextPackRevision | null,
): EvidenceReference[] => {
  if (!contextPack) return [];
  return contextPack.materialSummaries.flatMap((material) => {
    const locator = material.summarySources[0];
    return locator
      ? [
          {
            type: "material" as const,
            materialId: material.materialId,
            locator: copy(locator),
          },
        ]
      : [];
  });
};

const contextMentions = (
  contextPack: ContextPackRevision | null,
  terms: string[],
): boolean => {
  const text = [
    contextPack?.globalProjectSummary ?? "",
    ...(contextPack?.materialSummaries.map(({ summary }) => summary) ??
      []),
  ]
    .join(" ")
    .toLocaleLowerCase();
  return terms.some((term) => text.includes(term));
};

const contextHasContradiction = (
  contextPack: ContextPackRevision | null,
): boolean => {
  const text = (
    contextPack?.materialSummaries.map(({ summary }) => summary).join(" | ") ??
    ""
  ).toLocaleLowerCase();
  return (
    (/(no budget|kein budget)/.test(text) &&
      /(\$|€|budget (?:is|von|beträgt) \d)/.test(text)) ||
    (/(no deadline|keine frist)/.test(text) &&
      /(deadline|launch|start|frist|termin).{0,20}\d/.test(text))
  );
};

const initialArea = (
  id: AreaId,
  language: Language,
  contextPack: ContextPackRevision | null,
  projectDescription: string,
  freelancerGuidance: string,
): CoverageArea => {
  const materialEvidence = evidenceFromContext(contextPack);
  const terms: Record<AreaId, string[]> = {
    "goals-users": ["user", "customer", "nutzer", "kunde", "goal", "ziel"],
    scope: ["scope", "feature", "funktion", "umfang", "requirement", "anforder"],
    constraints: ["budget", "deadline", "constraint", "frist", "limit"],
    success: ["success", "metric", "acceptance", "erfolg", "abnahme", "kpi"],
    delivery: ["delivery", "handoff", "stakeholder", "übergabe", "liefer"],
  };
  const initialText =
    `${projectDescription} ${freelancerGuidance}`.toLocaleLowerCase();
  const supportedByMaterial =
    materialEvidence.length > 0 &&
    contextMentions(contextPack, terms[id]);
  const supportedByInitialContext = terms[id].some((term) =>
    initialText.includes(term),
  );
  const supported = supportedByMaterial || supportedByInitialContext;
  const evidence: EvidenceReference[] = supportedByMaterial
    ? materialEvidence
    : supportedByInitialContext
      ? [
          {
            type: "model_inference",
            description:
              "The initial Project Description or private Freelancer Guidance contains a relevant signal that requires Client confirmation.",
          },
        ]
      : [];
  return {
    id,
    label: labels[language][id],
    rubric: rubrics[language][id],
    status: supportedByMaterial ? "sufficient" : supported ? "partial" : "uncovered",
    evidence: supported ? copy(evidence) : [],
    rationale: supported
      ? language === "de"
        ? "Der anfängliche Projektkontext enthält Hinweise; der Client muss sie noch bestätigen oder ergänzen."
        : "Initial project context contains signals; the Client should confirm or complete them."
      : language === "de"
        ? "Noch nicht durch belastbare Evidenz geklärt."
        : "Not yet established by reliable evidence.",
    openQuestions: [questions[language][id]],
    required: true,
  };
};

const questionFor = (
  language: Language,
  areaId: AreaId,
  kind: InterviewQuestionDraft["kind"] = "primary",
): InterviewQuestionDraft => ({
  text: questions[language][areaId],
  coverageAreaId: areaId,
  kind,
  reason:
    language === "de"
      ? "Dieser erforderliche Bereich ist noch nicht ausreichend geklärt."
      : "This required coverage area is not yet sufficient.",
});

const isVague = (answer: string): boolean => {
  const normalized = answer.trim().toLocaleLowerCase();
  return (
    normalized.length < 18 ||
    [
      "i don't know",
      "dont know",
      "not sure",
      "keine ahnung",
      "weiß ich nicht",
      "weiss ich nicht",
    ].some((value) => normalized.includes(value))
  );
};

const effectiveAnswers = (
  turns: Parameters<
    NonNullable<InterviewAdapters["agent"]>["advance"]
  >[0]["turns"],
  corrections: Parameters<
    NonNullable<InterviewAdapters["agent"]>["advance"]
  >[0]["corrections"],
): string[] =>
  turns.map((turn) => {
    const correction = corrections
      .filter(({ turnId }) => turnId === turn.id)
      .at(-1);
    return correction?.correctedAnswer ?? turn.answer;
  });

const hasContradiction = (answers: string[]): boolean => {
  const text = answers.join(" | ").toLocaleLowerCase();
  return (
    (/(no budget|kein budget)/.test(text) &&
      /(\$|€|budget (?:is|von|beträgt) \d)/.test(text)) ||
    (/(no deadline|keine frist)/.test(text) &&
      /(deadline|launch|start|frist|termin).{0,20}\d/.test(text))
  );
};

export const localInterviewPlanner: NonNullable<
  InterviewAdapters["planner"]
> = {
  async plan({
    language,
    contextPack,
    projectDescription,
    freelancerGuidance,
  }) {
    const coverageAreas = AREA_IDS.map((id) =>
      initialArea(
        id,
        language,
        contextPack,
        projectDescription,
        freelancerGuidance,
      ),
    );
    const materialContradiction = contextHasContradiction(contextPack);
    if (materialContradiction) {
      const constraints = coverageAreas.find(
        ({ id }) => id === "constraints",
      );
      if (constraints) {
        constraints.status = "partial";
        constraints.rationale =
          language === "de"
            ? "Projektmaterial enthält widersprüchliche Budget- oder Zeitangaben, die der Client neutral klären muss."
            : "Project Material contains conflicting budget or timing statements that need neutral Client clarification.";
        constraints.openQuestions = [
          language === "de"
            ? "Die Projektunterlagen widersprechen sich bei Budget oder Zeit. Welche Angabe ist aktuell, oder bleibt dies offen?"
            : "Project Material conflicts on budget or timing. Which statement is current, or should this remain open?",
        ];
      }
    }
    const first =
      (materialContradiction
        ? coverageAreas.find(({ id }) => id === "constraints")
        : undefined) ??
      coverageAreas.find(({ status }) => status === "uncovered") ??
      coverageAreas[0]!;
    return {
      profileId: "software-project",
      profileVersion: "software-project-v1",
      coverageAreas,
      knownRisks: materialContradiction
        ? [
            language === "de"
              ? "Projektmaterial enthält einen ungeklärten Budget- oder Zeitwiderspruch."
              : "Project Material contains an unresolved budget or timing contradiction.",
          ]
        : /budget|deadline|frist|launch|exclude|ausschl/i.test(
        `${projectDescription} ${freelancerGuidance}`,
      )
        ? [
            language === "de"
              ? "Der anfängliche Projektkontext nennt Grenzen, die im Interview bestätigt werden müssen."
              : "Initial project context names constraints that need Client confirmation.",
          ]
          : [],
      openGoals: coverageAreas
        .filter(({ status }) => status !== "sufficient")
        .map(({ label }) => label),
      firstQuestion: {
        ...questionFor(language, first.id as AreaId),
        ...(materialContradiction && first.id === "constraints"
          ? { text: first.openQuestions[0]! }
          : {}),
      },
      openingQuestions: [
        {
          ...questionFor(language, first.id as AreaId),
          ...(materialContradiction && first.id === "constraints"
            ? { text: first.openQuestions[0]! }
            : {}),
        },
      ],
      model: "local-file-first-planner-v1",
      provider: "local",
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    };
  },
};

export const localInterviewAgent: NonNullable<
  InterviewAdapters["agent"]
> = {
  async advance({
    language,
    contextPack,
    plan,
    turns,
    corrections,
    findings: existingFindings,
    events,
    acceptedTurn,
    retrieveEvidence,
  }) {
    const hasLateMaterial = events.some(
      ({ type }) => type === "project_material_added",
    );
    const retrieved = hasLateMaterial
      ? await retrieveEvidence?.(acceptedTurn.question.text, 5)
      : undefined;
    const lateMaterialEvidence: EvidenceReference[] = (
      retrieved?.length
        ? retrieved.map(({ materialId, locator }) => ({
            type: "material" as const,
            materialId,
            locator: copy(locator),
          }))
        : []
    ).slice(0, 5);
    const area = plan.coverageAreas.find(
      ({ id }) => id === acceptedTurn.question.coverageAreaId,
    );
    const areaId = (area?.id ?? "goals-users") as AreaId;
    const vague =
      acceptedTurn.answerKind === "skip" ||
      isVague(acceptedTurn.answer);
    const alreadyFollowedUp = (area?.vagueFollowupCount ?? 0) >= 1;
    const gapAddressed =
      vague && alreadyFollowedUp;
    const status =
      acceptedTurn.answerKind === "skip"
        ? alreadyFollowedUp
          ? "sufficient"
          : "partial"
        : vague
          ? gapAddressed
            ? "sufficient"
            : area?.status ?? "uncovered"
          : "sufficient";
    const coverageUpdates: InterviewAgentDelta["coverageUpdates"] = area
      ? [
          {
            id: area.id,
            status,
            evidence: [
              ...area.evidence,
              ...lateMaterialEvidence,
              { type: "turn" as const, turnId: acceptedTurn.id },
            ],
            rationale: vague
              ? language === "de"
                ? "Die Antwort bleibt unklar; nach höchstens einer Rückfrage wird dies als Lücke festgehalten."
                : "The answer remains vague; after at most one follow-up this is recorded as a gap."
              : hasLateMaterial && lateMaterialEvidence.length
                ? language === "de"
                  ? "Die Client-Antwort und das neue Projektmaterial stützen diesen Bereich."
                  : "The Client answer and newly added Project Material support this coverage area."
              : language === "de"
                ? "Die Client-Antwort stützt diesen Bereich."
                : "The Client answer supports this coverage area.",
            openQuestions:
              vague && !alreadyFollowedUp
                ? [questions[language][areaId]]
                : [],
            ...(vague ? { vagueFollowupCount: 1 } : {}),
          },
        ]
      : [];
    const unhandledCorrections = corrections.filter(
      ({ id }) =>
        !existingFindings.some(({ sources }) =>
          sources.some(
            (source) =>
              source.type === "correction" &&
              source.correctionId === id,
          ),
        ) &&
        !plan.coverageAreas.some(({ evidence }) =>
          evidence.some(
            (source) =>
              source.type === "correction" &&
              source.correctionId === id,
          ),
        ),
    );
    for (const correction of unhandledCorrections) {
      for (const affectedArea of plan.coverageAreas.filter(
        ({ evidence }) =>
          evidence.some(
            (source) =>
              source.type === "turn" &&
              source.turnId === correction.turnId,
          ),
      )) {
        const existingUpdate = coverageUpdates.find(
          ({ id }) => id === affectedArea.id,
        );
        const correctionSource = {
          type: "correction" as const,
          correctionId: correction.id,
        };
        const correctedStatus = isVague(correction.correctedAnswer)
          ? ("partial" as const)
          : ("sufficient" as const);
        if (existingUpdate) {
          existingUpdate.evidence = [
            ...existingUpdate.evidence,
            correctionSource,
          ];
          existingUpdate.status = correctedStatus;
          existingUpdate.rationale =
            language === "de"
              ? "Eine unveränderliche Client-Korrektur wurde bei der erneuten Bewertung berücksichtigt."
              : "An immutable Client correction was considered during reassessment.";
        } else {
          coverageUpdates.push({
            id: affectedArea.id,
            status: correctedStatus,
            evidence: [
              ...affectedArea.evidence,
              correctionSource,
            ],
            rationale:
              language === "de"
                ? "Eine unveränderliche Client-Korrektur wurde bei der erneuten Bewertung berücksichtigt."
                : "An immutable Client correction was considered during reassessment.",
            openQuestions:
              correctedStatus === "partial"
                ? affectedArea.openQuestions
                : [],
          });
        }
      }
    }
    const findings: InterviewAgentDelta["findings"] = [];
    for (const correction of unhandledCorrections) {
      if (isCandidateRequirement(correction.correctedAnswer)) {
        findings.push({
          type: "candidate_requirement",
          statement: boundedFindingStatement(
            language === "de"
              ? "Client-Korrektur: "
              : "Client correction: ",
            correction.correctedAnswer,
          ),
          sources: [
            {
              type: "correction",
              correctionId: correction.id,
            },
          ],
        });
      }
    }
    if (gapAddressed) {
      findings.push({
        type: "gap" as const,
        statement:
          language === "de"
            ? `${labels.de[areaId]} bleibt nach einer Rückfrage unklar; diese Unsicherheit kann Umfang, Schätzung oder Abnahme beeinflussen.`
            : `${labels.en[areaId]} remains unclear after one follow-up; this uncertainty may affect scope, estimates, or acceptance.`,
        sources: [{ type: "turn" as const, turnId: acceptedTurn.id }],
      });
    } else if (
      !vague &&
      isCandidateRequirement(acceptedTurn.answer)
    ) {
      findings.push({
        type: "candidate_requirement" as const,
        statement: boundedFindingStatement(
          language === "de"
            ? "Client-Anforderung: "
            : "Client request: ",
          acceptedTurn.answer,
        ),
        sources: [{ type: "turn" as const, turnId: acceptedTurn.id }],
      });
    }
    if (!vague) {
      if (
        areaId === "constraints" &&
        /(?:€|\$)\s?(?:10|[1-9]\d?)\b|\b(?:two|2|zwei)\s+weeks?\b|\bzwei\s+wochen\b/i.test(
          acceptedTurn.answer,
        )
      ) {
        findings.push({
          type: "risk" as const,
          statement:
            language === "de"
              ? "Die gewünschte Budget- oder Zeitgrenze kann Spannung zwischen Umfang, Qualität, Kosten und Termin erzeugen; die Machbarkeit muss der Freelancer beurteilen."
              : "The requested budget or timing constraint may create tension among scope, quality, cost, and timing; the Freelancer must assess feasibility.",
          sources: [
            { type: "turn" as const, turnId: acceptedTurn.id },
          ],
        });
      }
    }
    const answers = effectiveAnswers(turns, corrections);
    const activeContradiction = existingFindings.find(
      ({ type, status: findingStatus }) =>
        type === "contradiction" && findingStatus === "active",
    );
    const resolvingContradiction =
      activeContradiction &&
      acceptedTurn.question.coverageAreaId === "constraints" &&
      acceptedTurn.question.kind === "follow_up";
    const explicitlyOpen =
      vague ||
      /remain(?:s)? (?:open|unresolved)|need to (?:check|confirm)|not decided|offen|ungeklärt|prüfen|intern klären/i.test(
        acceptedTurn.answer,
      );
    const correctionStatusUpdates = existingFindings
      .filter(
        ({ status: findingStatus, sources }) =>
          findingStatus === "needs_reassessment" &&
          unhandledCorrections.some((correction) =>
            sources.some(
              (source) =>
                source.type === "turn" &&
                source.turnId === correction.turnId,
            ),
          ),
      )
      .map((finding) => {
        const correction = unhandledCorrections.find((candidate) =>
          finding.sources.some(
            (source) =>
              source.type === "turn" &&
              source.turnId === candidate.turnId,
          ),
        )!;
        return {
          id: finding.id,
          status: "resolved" as const,
          sources: [
            ...finding.sources,
            {
              type: "correction" as const,
              correctionId: correction.id,
            },
          ],
        };
      });
    const findingStatusUpdates = [
      ...correctionStatusUpdates,
      ...(resolvingContradiction
        ? [
          {
            id: activeContradiction.id,
            status: explicitlyOpen
              ? ("explicitly_open" as const)
              : ("resolved" as const),
            sources: [
              ...activeContradiction.sources,
              { type: "turn" as const, turnId: acceptedTurn.id },
            ],
          },
          ]
        : []),
    ];
    const newContradiction =
      hasContradiction(answers) &&
      !existingFindings.some(({ type }) => type === "contradiction");
    const materialContradiction =
      contextHasContradiction(contextPack) &&
      areaId === "constraints" &&
      !existingFindings.some(({ type }) => type === "contradiction");
    if (materialContradiction) {
      findings.push({
        type: "contradiction",
        statement:
          language === "de"
            ? "Projektmaterial enthielt widersprüchliche Budget- oder Zeitangaben; die Client-Antwort dokumentiert die Auflösung oder bewusste Offenheit."
            : "Project Material contained conflicting budget or timing statements; the Client answer records the resolution or explicit openness.",
        sources: [
          ...area!.evidence.filter(
            (source) => source.type === "material",
          ),
          { type: "turn", turnId: acceptedTurn.id },
        ],
        status: explicitlyOpen ? "explicitly_open" : "resolved",
      });
    }
    if (newContradiction) {
      findings.push({
        type: "contradiction" as const,
        statement:
          language === "de"
            ? "Die Antworten enthalten widersprüchliche Budget- oder Zeitangaben."
            : "The answers contain conflicting budget or timing statements.",
        sources: turns.map(({ id }) => ({
          type: "turn" as const,
          turnId: id,
        })),
      });
    }

    const projected = plan.coverageAreas.map((candidate) => {
      const update = coverageUpdates.find(
        ({ id }) => id === candidate.id,
      );
      return update
        ? { ...candidate, status: update.status }
        : candidate;
    });
    let nextArea = projected.find(
      (candidate) =>
        candidate.required &&
        ["uncovered", "partial"].includes(candidate.status) &&
        candidate.id !== area?.id,
    );
    if (
      vague &&
      acceptedTurn.answerKind !== "skip" &&
      !gapAddressed &&
      area
    ) {
      nextArea = area;
    }
    const proposeCompletion = !nextArea && !newContradiction;
    const nextQuestion: InterviewQuestionDraft | undefined =
      newContradiction
        ? {
            text:
              language === "de"
                ? "Die Budget- oder Zeitangaben scheinen sich zu widersprechen. Welche Angabe soll als aktuell gelten, oder bleibt die Frage offen?"
                : "The budget or timing statements appear to conflict. Which statement should be treated as current, or should this remain open?",
            coverageAreaId: "constraints",
            kind: "follow_up" as const,
            reason:
              "Conflicting Client statements require neutral resolution.",
          }
        : nextArea
        ? {
            ...questionFor(
              language,
              nextArea.id as AreaId,
              nextArea.id === area?.id ? "follow_up" : "primary",
            ),
            text:
              nextArea.id === area?.id
                ? questions[language][nextArea.id as AreaId]
                : language === "de"
                  ? `Danke, das klärt ${labels.de[areaId]}. ${questions.de[nextArea.id as AreaId]}`
                  : `Thanks, that clarifies ${labels.en[areaId]}. ${questions.en[nextArea.id as AreaId]}`,
          }
        : undefined;
    return {
      coverageUpdates,
      findings,
      findingStatusUpdates,
      unresolvedTopics: projected
        .filter(({ required, status: candidateStatus }) =>
          required &&
          ["uncovered", "partial"].includes(candidateStatus),
        )
        .map(({ label }) => label),
      ...(nextQuestion
        ? { nextQuestion, nextQuestions: [nextQuestion] }
        : {}),
      completionAssessment: {
        proposeCompletion,
        rationale: newContradiction
          ? language === "de"
            ? "Ein Widerspruch wurde neutral zur Klärung vorgelegt."
            : "A contradiction was presented neutrally for resolution."
          : proposeCompletion
          ? language === "de"
            ? "Alle erforderlichen Bereiche sind ausreichend oder als Lücke dokumentiert."
            : "All required areas are sufficient or documented as gaps."
          : language === "de"
            ? "Mindestens ein erforderlicher Bereich bleibt offen."
            : "At least one required coverage area remains open.",
      },
      model: "local-file-first-agent-v1",
      provider: "local",
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    };
  },
};

export const localInterviewReviewer: NonNullable<
  InterviewAdapters["reviewer"]
> = {
  async review({ language, plan, findings }) {
    const weakCoverageAreaIds = plan.coverageAreas
      .filter(
        ({ required, status }) =>
          required && ["uncovered", "partial"].includes(status),
      )
      .map(({ id }) => id);
    const contradictionBlockers = findings
      .filter(
        ({ type, status }) =>
          type === "contradiction" && status === "active",
      )
      .map(({ statement }) =>
        language === "de"
          ? `Ungeklärter Widerspruch: ${statement}`
          : `Unresolved contradiction: ${statement}`,
      );
    const reassessmentBlockers = findings
      .filter(({ status }) => status === "needs_reassessment")
      .map(({ statement }) =>
        language === "de"
          ? `Korrektur muss erneut bewertet werden: ${statement}`
          : `Correction requires reassessment: ${statement}`,
      );
    return {
      blockers: [
        ...weakCoverageAreaIds.map((id) =>
          language === "de"
            ? `Erforderlicher Bereich „${labels.de[id as AreaId]}“ ist noch nicht ausreichend.`
            : `Required area “${labels.en[id as AreaId]}” is not yet sufficient.`,
        ),
        ...contradictionBlockers,
        ...reassessmentBlockers,
      ],
      weakCoverageAreaIds,
      rationale:
        weakCoverageAreaIds.length === 0
          ? language === "de"
            ? "Keine unbehandelten erforderlichen Lücken gefunden."
            : "No unaddressed required gaps were found."
          : language === "de"
            ? "Erforderliche Bereiche benötigen weitere Klärung."
            : "Required coverage areas need more clarification.",
      model: "local-file-first-reviewer-v1",
      provider: "local",
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    };
  },
};
