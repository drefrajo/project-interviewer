import { useAction, useMutation, useQuery } from "convex/react";
import { Languages, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  interviewApi,
  interviewIdFrom,
  type ClientLanguage,
} from "../../infrastructure/interview-api";
import {
  builtInInterviewTemplateForLanguage,
  interviewTemplates,
} from "../../domain/interview-templates";
import {
  Field,
  primaryButton,
  secondaryButton,
  Select,
  TextArea,
  TextInput,
} from "../shared/form-controls";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";

export const InterviewForm = () => {
  const creatorLanguage = useCreatorLanguage();
  const text = creatorCopy[creatorLanguage];
  const { interviewId } = useParams();
  const editing = Boolean(interviewId);
  const navigate = useNavigate();
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
  const [clientLanguage, setClientLanguage] =
    useState<ClientLanguage>("en");
  const [instructions, setInstructions] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateBaseline, setTemplateBaseline] = useState("");
  const [translating, setTranslating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templateNotice, setTemplateNotice] = useState("");

  useEffect(() => {
    if (!editing || !interview || initialized.current) return;
    initialized.current = true;
    setProjectName(interview.projectName);
    setClientLanguage(interview.clientLanguage);
    setInstructions(interview.instructions);
    setTemplateBaseline(interview.instructions);
  }, [editing, interview]);

  const selectedTemplate = useMemo(
    () => templates?.find((template) => template._id === selectedTemplateId),
    [selectedTemplateId, templates],
  );
  const availableTemplates = useMemo(
    () =>
      (templates ?? []).filter(
        (template) =>
          template.kind === "private" ||
          template.sourceLanguage === clientLanguage,
      ),
    [clientLanguage, templates],
  );
  const editedSinceTemplate =
    Boolean(selectedTemplate) && instructions !== templateBaseline;

  const selectTemplate = (templateId: string) => {
    const template = templates?.find((candidate) => candidate._id === templateId);
    if (!template) {
      setSelectedTemplateId("");
      return;
    }
    const next =
      builtInInterviewTemplateForLanguage(template, clientLanguage)
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
    setTemplateNotice(
      text.form.copiedTemplate,
    );
  };

  const changeClientLanguage = (language: ClientLanguage) => {
    if (language === clientLanguage) return;
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
          setSelectedTemplateId(translatedTemplate._id);
          setInstructions(translatedTemplate.instructions);
          setTemplateBaseline(translatedTemplate.instructions);
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
    setClientLanguage(language);
  };

  const translateInstructions = async () => {
    const targetLanguage = clientLanguage;
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
      clientLanguage,
      instructions: instructions.trim(),
    };
    try {
      if (interviewId) {
        await updateInterview({ interviewId, ...input });
        navigate(`/interviews/${interviewId}`);
      } else {
        const created = await createInterview(input);
        navigate(`/interviews/${interviewIdFrom(created)}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (editing && interview === undefined) {
    return <FormLoading label={text.form.formLoading} />;
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
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
        {editing ? text.form.editPreparation : text.form.newInterview}
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold">
        {editing ? projectName || text.form.editInterview : text.form.prepareInterview}
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        {text.form.description}
      </p>
      <form className="mt-8 grid gap-6 rounded-xl border border-line bg-surface p-6 sm:p-8" onSubmit={submit}>
        <Field label={text.form.projectName}>
          <TextInput
            maxLength={160}
            onChange={(event) => setProjectName(event.target.value)}
            required
            value={projectName}
          />
        </Field>
        <div className="max-w-md">
          <Field label={text.form.clientLanguage}>
            <Select
              disabled={translating}
              onChange={(event) =>
                changeClientLanguage(
                  event.target.value as ClientLanguage,
                )
              }
              value={clientLanguage}
            >
              <option value="en">{text.interviews.language.en}</option>
              <option value="de">{text.interviews.language.de}</option>
            </Select>
          </Field>
        </div>
          <Field
          hint={text.form.templateHint}
          label={text.form.templateLabel}
        >
          <Select
            disabled={translating}
            onChange={(event) => selectTemplate(event.target.value)}
            value={selectedTemplateId}
          >
            <option value="">{text.form.noTemplate}</option>
            {availableTemplates.map((template) => (
              <option key={template._id} value={template._id}>
                {template.kind === "built_in" ? text.form.builtIn : text.form.private} ·{" "}
                {template.name} · {template.sourceLanguage.toUpperCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          hint={text.form.characters(instructions.length)}
          label={text.form.instructions}
        >
          <TextArea
            className="min-h-80 font-sans text-base leading-7"
            disabled={translating}
            maxLength={50_000}
            onChange={(event) => setInstructions(event.target.value)}
            required
            value={instructions}
          />
        </Field>
        {templateNotice ? (
          <p className="rounded-lg bg-soft p-3 text-sm font-bold text-forest" role="status">
            {templateNotice}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-error-border bg-error-surface p-4 font-bold text-error-text" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className={secondaryButton}
              disabled={translating || !instructions.trim()}
              onClick={() => void translateInstructions()}
              type="button"
            >
              <Languages aria-hidden="true" size={17} />
              {translating
                ? text.form.translating
                : text.form.translateTo(
                    text.interviews.language[clientLanguage],
                  )}
            </button>
            <button
              className={secondaryButton}
              disabled={!instructions.trim()}
              onClick={async () => {
                const name = window.prompt(text.form.saveTemplatePrompt);
                if (!name?.trim()) return;
                await createTemplate({
                  name: name.trim(),
                  sourceLanguage: clientLanguage,
                  instructions: instructions.trim(),
                });
                setTemplateNotice(text.form.templateSaved);
              }}
              type="button"
            >
              <Save aria-hidden="true" size={17} />
              {text.form.saveAsTemplate}
            </button>
          </div>
          <button
            className={primaryButton}
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
