import { useAction, useMutation, useQuery } from "convex/react";
import { Languages, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  interviewApi,
  interviewIdFrom,
  type ClientLanguage,
  type InterviewModel,
  type InterviewTemplate,
} from "../../infrastructure/interview-api";
import {
  Field,
  primaryButton,
  secondaryButton,
  Select,
  TextArea,
  TextInput,
} from "../shared/form-controls";

const builtInForLanguage = (
  template: InterviewTemplate,
  language: ClientLanguage,
  templates: readonly InterviewTemplate[] = [],
) =>
  template.kind === "built_in"
    ? templates.find(
        (candidate) =>
          candidate.kind === "built_in" &&
          candidate.sourceLanguage === language &&
          (template.builtInKey && candidate.builtInKey
            ? candidate.builtInKey === template.builtInKey
            : candidate.name === template.name),
      )
    : undefined;

const instructionsFor = (
  template: InterviewTemplate,
  language: ClientLanguage,
  templates: readonly InterviewTemplate[] = [],
) =>
  builtInForLanguage(template, language, templates)?.instructions ??
  template.instructions;

export const InterviewForm = () => {
  const { interviewId } = useParams();
  const editing = Boolean(interviewId);
  const navigate = useNavigate();
  const templates = useQuery(interviewApi.templates.list, {});
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
  const [interviewModel, setInterviewModel] =
    useState<InterviewModel>("deepseek-v4-flash");
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
    setInterviewModel(interview.interviewModel);
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
    const next = instructionsFor(template, clientLanguage, templates);
    if (
      instructions.trim() &&
      instructions !== templateBaseline &&
      !window.confirm(
        "Selecting this template replaces the Interview Instructions you edited. Continue?",
      )
    ) {
      return;
    }
    setSelectedTemplateId(templateId);
    setInstructions(next);
    setTemplateBaseline(next);
    setTemplateNotice(
      "Template copied. You can freely customize these Interview Instructions.",
    );
  };

  const changeClientLanguage = (language: ClientLanguage) => {
    if (language === clientLanguage) return;
    if (selectedTemplate?.kind === "built_in") {
      if (editedSinceTemplate) {
        setSelectedTemplateId("");
        setTemplateBaseline("");
        setTemplateNotice(
          "Client Language changed. Your edited Interview Instructions were kept.",
        );
      } else {
        const translatedTemplate = builtInForLanguage(
          selectedTemplate,
          language,
          templates ?? [],
        );
        if (translatedTemplate) {
          setSelectedTemplateId(translatedTemplate._id);
          setInstructions(translatedTemplate.instructions);
          setTemplateBaseline(translatedTemplate.instructions);
          setTemplateNotice(
            "Built-in template switched to match the Client Language.",
          );
        } else {
          setSelectedTemplateId("");
          setTemplateBaseline("");
          setTemplateNotice(
            "No matching built-in template is available. Existing Interview Instructions were kept.",
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
        "The current edited Interview Instructions—not the original template—will be translated. Continue?",
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
        "Translation updated this Interview only. Save it separately if you want a new Private Interview Template.",
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
      interviewModel,
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
    return <FormLoading />;
  }
  if (editing && interview === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10" id="main-content">
        <h1 className="font-display text-3xl font-extrabold">Interview unavailable</h1>
      </main>
    );
  }
  if (interview?.configurationFrozen) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10" id="main-content">
        <h1 className="font-display text-3xl font-extrabold">
          Interview configuration is frozen
        </h1>
        <p className="mt-3 leading-7 text-muted">
          The first Client message fixed the project name, Client Language,
          Interview Model, and Interview Instructions.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
        {editing ? "Edit preparation" : "New Interview"}
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold">
        {editing ? projectName || "Edit Interview" : "Prepare an Interview"}
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        The Interview Link works as soon as you create it. Configuration remains
        editable until the Client sends their first message.
      </p>
      <form className="mt-8 grid gap-6 rounded-xl border border-line bg-surface p-6 sm:p-8" onSubmit={submit}>
        <Field label="Project name">
          <TextInput
            maxLength={160}
            onChange={(event) => setProjectName(event.target.value)}
            required
            value={projectName}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Client Language">
            <Select
              disabled={translating}
              onChange={(event) =>
                changeClientLanguage(
                  event.target.value as ClientLanguage,
                )
              }
              value={clientLanguage}
            >
              <option value="en">English</option>
              <option value="de">German</option>
            </Select>
          </Field>
          <Field label="Interview Model">
            <Select
              disabled={translating}
              onChange={(event) =>
                setInterviewModel(event.target.value as InterviewModel)
              }
              value={interviewModel}
            >
              <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
              <option value="gpt-5.6-terra">GPT-5.6 Terra</option>
            </Select>
          </Field>
        </div>
        <Field
          hint="A template prefills this field; it never governs the Interview after copying."
          label="Optional Interview Template"
        >
          <Select
            disabled={translating}
            onChange={(event) => selectTemplate(event.target.value)}
            value={selectedTemplateId}
          >
            <option value="">No template</option>
            {availableTemplates.map((template) => (
              <option key={template._id} value={template._id}>
                {template.kind === "built_in" ? "Built-in" : "Private"} ·{" "}
                {template.name} · {template.sourceLanguage.toUpperCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          hint={`${instructions.length.toLocaleString()} / 50,000 characters`}
          label="Interview Instructions"
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
                ? "Translating with DeepSeek V4 Flash…"
                : `Translate to ${clientLanguage === "en" ? "English" : "German"}`}
            </button>
            <button
              className={secondaryButton}
              disabled={!instructions.trim()}
              onClick={async () => {
                const name = window.prompt("Name this Private Interview Template");
                if (!name?.trim()) return;
                await createTemplate({
                  name: name.trim(),
                  sourceLanguage: clientLanguage,
                  instructions: instructions.trim(),
                });
                setTemplateNotice("Private Interview Template saved.");
              }}
              type="button"
            >
              <Save aria-hidden="true" size={17} />
              Save as template
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
            {busy ? "Saving…" : editing ? "Save configuration" : "Create Interview"}
          </button>
        </div>
      </form>
    </main>
  );
};

const FormLoading = () => (
  <main className="grid min-h-96 place-items-center" id="main-content">
    <p className="font-bold text-muted" role="status">
      Opening Interview…
    </p>
  </main>
);
