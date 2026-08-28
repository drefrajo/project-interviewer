import { useAction, useMutation, useQuery } from "convex/react";
import { ChevronDown, Languages, Save } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  interviewApi,
  interviewIdFrom,
  type ClientLanguage,
  type InterviewKind,
} from "../../infrastructure/interview-api";
import {
  builtInInterviewTemplateForLanguage,
  interviewTemplates,
} from "../../domain/interview-templates";
import { trackEvent } from "../../infrastructure/analytics";
import {
  Field,
  primaryButton,
  secondaryButton,
  Select,
  TextArea,
  TextInput,
} from "../shared/form-controls";
import {
  InterviewTemplatePicker,
  conceptsLabel,
  resolveInterviewConfiguration,
  type TemplateCardValue,
} from "./interview-kind-picker";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";
import { hasCompletePublicCreatorIdentity } from "./creator-profile-readiness";

export const InterviewForm = () => {
  const creatorLanguage = useCreatorLanguage();
  const text = creatorCopy[creatorLanguage];
  const { interviewId } = useParams();
  const editing = Boolean(interviewId);
  const navigate = useNavigate();
  const profile = useQuery(interviewApi.creator_profiles.getCurrent, {});
  const privateTemplates = useQuery(interviewApi.templates.list, {});
  const templates = useMemo(
    () => interviewTemplates(privateTemplates),
    [privateTemplates],
  );
  const interview = useQuery(
    interviewApi.interviews.get,
    interviewId ? { interviewId } : "skip",
  );
  const createInterview = useMutation(interviewApi.interviews.create);
  const updateInterview = useMutation(
    interviewApi.interviews.updateBeforeStart,
  );
  const createTemplate = useMutation(interviewApi.templates.create);
  const translate = useAction(interviewApi.templates.translate);
  const initialized = useRef(false);
  const [projectName, setProjectName] = useState("");
  const [interviewLanguage, setInterviewLanguage] =
    useState<ClientLanguage>(creatorLanguage);
  const [instructions, setInstructions] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [interviewKind, setInterviewKind] = useState<InterviewKind>("custom");
  const [includesVisualConcepts, setIncludesVisualConcepts] = useState(false);
  const [templateBaseline, setTemplateBaseline] = useState("");
  const [translating, setTranslating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templateNotice, setTemplateNotice] = useState("");
  const instructionsRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = instructionsRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const contentHeight = Math.max(textarea.scrollHeight, textarea.offsetHeight);
    if (contentHeight > 0) textarea.style.height = `${contentHeight}px`;
  }, [instructions]);

  useEffect(() => {
    if (!editing || !interview || initialized.current) return;
    initialized.current = true;
    setProjectName(interview.projectName);
    setInterviewLanguage(interview.clientLanguage);
    setInstructions(interview.instructions);
    setTemplateBaseline(interview.instructions);
    const configuration = resolveInterviewConfiguration(interview);
    setInterviewKind(configuration.interviewKind);
    setIncludesVisualConcepts(configuration.includesVisualConcepts);
  }, [editing, interview]);

  const selectedTemplate = useMemo(
    () => templates?.find((template) => template._id === selectedTemplateId),
    [selectedTemplateId, templates],
  );
  const selectedTemplateName = selectedTemplate
    ? selectedTemplate.kind === "built_in"
      ? builtInInterviewTemplateForLanguage(selectedTemplate, creatorLanguage)
          ?.name ?? selectedTemplate.name
      : selectedTemplate.name
    : undefined;
  const availableTemplates = useMemo(
    () =>
      (templates ?? []).filter(
        (template) =>
          template.kind === "private" ||
          template.sourceLanguage === interviewLanguage,
      ),
    [interviewLanguage, templates],
  );
  const pickerTemplates = useMemo(
    () =>
      availableTemplates.map((template) => {
        if (template.kind !== "built_in") return template;
        const localized = builtInInterviewTemplateForLanguage(
          template,
          creatorLanguage,
        );
        return localized
          ? {
              ...template,
              displayName: localized.name,
              displayDescription: localized.description,
            }
          : template;
      }) as unknown as TemplateCardValue[],
    [availableTemplates, creatorLanguage],
  );
  const editedSinceTemplate =
    Boolean(selectedTemplate) && instructions !== templateBaseline;

  const selectTemplate = (templateId: string) => {
    const template = templates?.find((candidate) => candidate._id === templateId);
    if (!template) {
      setSelectedTemplateId("");
      return;
    }
    const configuration = resolveInterviewConfiguration(template);
    const next =
      builtInInterviewTemplateForLanguage(template, interviewLanguage)
        ?.instructions ?? template.instructions;
    if (
      instructions.trim() &&
      instructions !== templateBaseline &&
      !window.confirm(
        text.form.confirmReplace,
      )
    ) {
      return;
    }
    setSelectedTemplateId(templateId);
    setInstructions(next);
    setTemplateBaseline(next);
    setInterviewKind(configuration.interviewKind);
    setIncludesVisualConcepts(configuration.includesVisualConcepts);
    setTemplateNotice(
      text.form.copiedTemplate,
    );
  };

  const changeInterviewLanguage = (language: ClientLanguage) => {
    if (language === interviewLanguage) return;
    if (selectedTemplate?.kind === "built_in") {
      if (editedSinceTemplate) {
        setSelectedTemplateId("");
        setTemplateBaseline("");
        setTemplateNotice(
          text.form.languageChanged,
        );
      } else {
        const translatedTemplate = builtInInterviewTemplateForLanguage(
          selectedTemplate,
          language,
        );
        if (translatedTemplate) {
          const translatedConfiguration = resolveInterviewConfiguration(
            translatedTemplate,
          );
          setSelectedTemplateId(translatedTemplate._id);
          setInstructions(translatedTemplate.instructions);
          setTemplateBaseline(translatedTemplate.instructions);
          setInterviewKind(translatedConfiguration.interviewKind);
          setIncludesVisualConcepts(
            translatedConfiguration.interviewKind === "custom"
              ? includesVisualConcepts
              : translatedConfiguration.includesVisualConcepts,
          );
          setTemplateNotice(
            text.form.builtInSwitched,
          );
        } else {
          setSelectedTemplateId("");
          setTemplateBaseline("");
          setTemplateNotice(
            text.form.noMatchingBuiltIn,
          );
        }
      }
    }
    setInterviewLanguage(language);
  };

  const translateInstructions = async () => {
    const targetLanguage = interviewLanguage;
    if (
      editedSinceTemplate &&
      !window.confirm(
        text.form.confirmTranslate,
      )
    ) {
      return;
    }
    setTranslating(true);
    setError("");
    try {
      const result = await translate({
        instructions,
        targetLanguage,
      });
      const translated =
        typeof result === "string" ? result : result.instructions;
      setInstructions(translated);
      setSelectedTemplateId("");
      setTemplateBaseline("");
      setTemplateNotice(
        text.form.translationUpdated,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setTranslating(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const input = {
      projectName: projectName.trim(),
      clientLanguage: interviewLanguage,
      instructions: instructions.trim(),
      interviewKind,
      includesVisualConcepts,
    };
    try {
      if (interviewId) {
        await updateInterview({ interviewId, ...input });
        trackEvent("interview_updated");
        navigate(`/interviews/${interviewId}`);
      } else {
        const created = await createInterview({
          ...input,
          ...(selectedTemplate?.kind === "built_in"
            ? { builtInTemplateKey: selectedTemplate.builtInKey }
            : {}),
        });
        trackEvent("interview_created");
        navigate(`/interviews/${interviewIdFrom(created)}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if ((!editing && profile === undefined) || (editing && interview === undefined)) {
    return <FormLoading label={text.form.formLoading} />;
  }
  if (!editing && !hasCompletePublicCreatorIdentity(profile)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10" id="main-content">
        <h1 className="font-display text-3xl font-extrabold">
          {text.form.settingsRequiredTitle}
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted">
          {text.form.settingsRequiredDescription}
        </p>
        <Link className={`${primaryButton} mt-6`} to="/settings#settings-profile">
          {text.shell.completeSettings}
        </Link>
      </main>
    );
  }
  if (editing && interview === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10" id="main-content">
        <h1 className="font-display text-3xl font-extrabold">
          {text.form.unavailable}
        </h1>
      </main>
    );
  }
  if (interview?.configurationFrozen) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10" id="main-content">
        <h1 className="font-display text-3xl font-extrabold">
          {text.form.frozenTitle}
        </h1>
        <p className="mt-3 leading-7 text-muted">
          {text.form.frozenDescription}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
        {editing ? text.form.editPreparation : text.form.newInterview}
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold">
        {editing ? projectName || text.form.editInterview : text.form.prepareInterview}
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        {text.form.description}
      </p>
      <form className="mt-8 grid gap-4" onSubmit={submit}>
        <section
          aria-labelledby="interview-instructions-heading"
          className="grid gap-5 rounded-box border-2 border-primary/30 bg-panel p-5 shadow-lg sm:gap-6 sm:p-7"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
                {text.form.instructionsEyebrow}
              </p>
              <h2
                className="mt-2 font-display text-2xl font-extrabold sm:text-3xl"
                id="interview-instructions-heading"
              >
                {text.form.instructions}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                {text.form.instructionsHint}
              </p>
            </div>
            <span
              aria-live="polite"
              className="self-start rounded-full bg-soft px-3 py-1.5 text-xs font-semibold text-muted"
            >
              {text.form.characters(instructions.length)}
            </span>
          </div>

          <details className="group rounded-box border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 transition hover:bg-soft [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">
                  {text.form.templateStart}
                </span>
                <span className="mt-1 block truncate text-sm text-muted">
                  {selectedTemplateName ?? text.form.templateStartHint}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="shrink-0 text-muted transition-transform group-open:rotate-180"
                size={18}
              />
            </summary>
            <div className="border-t border-line p-4 sm:p-5">
              <InterviewTemplatePicker
                compact
                hint={text.form.templateHint}
                language={creatorLanguage}
                legend={text.form.templateLabel}
                onSelect={selectTemplate}
                disabled={translating}
                selectedTemplateId={selectedTemplateId}
                sourceLabels={{
                  builtIn: text.form.builtIn,
                  private: text.form.private,
                }}
                templates={pickerTemplates}
              />
            </div>
          </details>

          <div className="grid gap-2">
            <label className="sr-only" htmlFor="interview-instructions">
              {text.form.instructions}
            </label>
            <TextArea
              aria-describedby="interview-instructions-guidance"
              className="min-h-[24rem] resize-none overflow-hidden bg-canvas px-4 py-4 font-normal font-sans text-base leading-7 shadow-inner sm:min-h-[28rem]"
              disabled={translating}
              id="interview-instructions"
              maxLength={50_000}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder={text.form.instructionsPlaceholder}
              ref={instructionsRef}
              required
              value={instructions}
            />
            <p
              className="text-sm leading-6 text-muted"
              id="interview-instructions-guidance"
            >
              {text.form.instructionsGuidance}
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                className={`${secondaryButton} min-h-10`}
                disabled={translating || !instructions.trim()}
                onClick={() => void translateInstructions()}
                type="button"
              >
                <Languages aria-hidden="true" size={17} />
                {translating
                  ? text.form.translating
                  : text.form.translateTo(
                      text.interviews.language[interviewLanguage],
                    )}
              </button>
              <button
                className={`${secondaryButton} min-h-10`}
                disabled={!instructions.trim()}
                onClick={async () => {
                  const name = window.prompt(text.form.saveTemplatePrompt);
                  if (!name?.trim()) return;
                  await createTemplate({
                    name: name.trim(),
                    sourceLanguage: interviewLanguage,
                    instructions: instructions.trim(),
                    interviewKind,
                    includesVisualConcepts,
                  });
                  setTemplateNotice(text.form.templateSaved);
                }}
                type="button"
              >
                <Save aria-hidden="true" size={17} />
                {text.form.saveAsTemplate}
              </button>
            </div>
            <span className="hidden text-xs text-muted sm:block">
              {text.form.editorHint}
            </span>
          </div>
          {templateNotice ? (
            <p
              className="rounded-lg bg-soft p-3 text-sm font-bold text-forest"
              role="status"
            >
              {templateNotice}
            </p>
          ) : null}
        </section>

        <section
          aria-labelledby="interview-details-heading"
          className="grid gap-4 rounded-box border border-line bg-soft/45 p-4 sm:p-5"
        >
          <div>
            <h2
              className="font-display text-lg font-extrabold"
              id="interview-details-heading"
            >
              {text.form.detailsTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {text.form.detailsHint}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(12rem,0.75fr)]">
            <Field label={text.form.projectName}>
              <TextInput
                maxLength={160}
                onChange={(event) => setProjectName(event.target.value)}
                required
                value={projectName}
              />
            </Field>
            <Field label={text.form.interviewLanguage}>
              <Select
                disabled={translating}
                onChange={(event) =>
                  changeInterviewLanguage(
                    event.target.value as ClientLanguage,
                  )
                }
                value={interviewLanguage}
              >
                <option value="en">{text.interviews.language.en}</option>
                <option value="de">{text.interviews.language.de}</option>
              </Select>
            </Field>
          </div>
          {interviewKind === "custom" ? (
            <label className="flex items-start gap-3 rounded-lg border border-line bg-panel p-3 text-sm">
              <input
                checked={includesVisualConcepts}
                className="mt-1 size-4 accent-[var(--color-primary)]"
                disabled={translating}
                onChange={(event) =>
                  setIncludesVisualConcepts(event.target.checked)
                }
                type="checkbox"
              />
              <span>
                <strong className="block">
                  {text.form.includeVisualConcepts}
                </strong>
                <span className="mt-1 block leading-6 text-muted">
                  {text.form.includeVisualConceptsHint}
                </span>
              </span>
            </label>
          ) : (
            <p className="text-sm font-bold text-primary">
              {conceptsLabel(includesVisualConcepts, creatorLanguage)}
            </p>
          )}
        </section>

        {error ? (
          <p
            className="rounded-lg border border-error-border bg-error-surface p-4 font-bold text-error-text"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            className={`${primaryButton} w-full sm:w-auto`}
            disabled={
              busy ||
              translating ||
              !projectName.trim() ||
              !instructions.trim()
            }
            type="submit"
          >
            {busy
              ? text.form.saving
              : editing
                ? text.form.saveConfiguration
                : text.form.createInterview}
          </button>
        </div>
      </form>
    </main>
  );
};

const FormLoading = ({ label }: { label: string }) => (
  <main className="grid min-h-96 place-items-center" id="main-content">
    <p className="font-bold text-muted" role="status">
      {label}
    </p>
  </main>
);
