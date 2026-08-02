import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  interviewApi,
  type ClientLanguage,
  type PrivateInterviewTemplate,
} from "../../infrastructure/interview-api";
import {
  BUILT_IN_INTERVIEW_TEMPLATES,
  privateInterviewTemplates,
  type InterviewTemplate,
} from "../../domain/interview-templates";
import { ConfirmDialog } from "../shared/confirm-dialog";
import {
  Field,
  primaryButton,
  secondaryButton,
  Select,
  TextArea,
  TextInput,
} from "../shared/form-controls";
import { creatorCopy } from "./creator-copy";
import {
  type CreatorLanguage,
  useCreatorLanguage,
} from "./creator-language";

export const TemplatesPage = () => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
  const persistedTemplates = useQuery(interviewApi.templates.list, {});
  const privateTemplates = privateInterviewTemplates(persistedTemplates);
  const create = useMutation(interviewApi.templates.create);
  const update = useMutation(interviewApi.templates.update);
  const remove = useMutation(interviewApi.templates.remove);
  const [editing, setEditing] = useState<
    PrivateInterviewTemplate | "new" | null
  >(null);
  const [deleting, setDeleting] =
    useState<PrivateInterviewTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const deleteTemplate = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await remove({ templateId: deleting._id });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <header className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-4xl font-extrabold">
            {text.templates.title}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            {text.templates.intro}
          </p>
        </div>
        <button className={primaryButton} onClick={() => setEditing("new")} type="button">
          <Plus aria-hidden="true" size={18} />
          {text.templates.newPrivate}
        </button>
      </header>
      {editing ? (
        <TemplateForm
          busy={busy}
          creatorLanguage={language}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            setBusy(true);
            try {
              if (editing === "new") {
                await create(input);
              } else {
                await update({ templateId: editing._id, ...input });
              }
              setEditing(null);
            } finally {
              setBusy(false);
            }
          }}
          {...(editing === "new" ? {} : { template: editing })}
        />
      ) : null}
      <TemplateGroup
        empty={text.templates.builtInUnavailable}
        language={language}
        templates={[...BUILT_IN_INTERVIEW_TEMPLATES]}
        title={text.templates.builtInTitle}
      />
      <TemplateGroup<PrivateInterviewTemplate>
        empty={text.templates.noPrivate}
        language={language}
        onDelete={setDeleting}
        onEdit={setEditing}
        templates={privateTemplates}
        title={text.templates.privateTitle}
      />
      <ConfirmDialog
        cancelLabel={text.common.cancel}
        confirmLabel={text.templates.deleteLabel}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => void deleteTemplate()}
        open={Boolean(deleting)}
        title={text.templates.deleteTitle}
      >
        <p>
          {text.templates.deleteDescription(deleting?.name ?? "")}
        </p>
      </ConfirmDialog>
    </main>
  );
};

const TemplateGroup = <Template extends InterviewTemplate>({
  title,
  empty,
  language,
  templates,
  onEdit,
  onDelete,
}: {
  title: string;
  empty: string;
  language: CreatorLanguage;
  templates: Template[];
  onEdit?(template: Template): void;
  onDelete?(template: Template): void;
}) => (
  <section className="mt-10">
    <h2 className="font-display text-2xl font-extrabold">{title}</h2>
    {templates.length ? (
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <article className="rounded-box border border-line bg-panel p-5" key={template._id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-extrabold">{template.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {creatorCopy[language].templates.sourceLanguage}:{" "}
                  {creatorCopy[language].templates.language[template.sourceLanguage]}
                </p>
              </div>
              {onEdit && onDelete ? (
                <div className="flex gap-1">
                  <button
                    aria-label={creatorCopy[language].templates.edit(template.name)}
                    className="inline-grid size-12 place-items-center rounded-field transition hover:bg-soft"
                    onClick={() => onEdit(template)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={17} />
                  </button>
                  <button
                    aria-label={creatorCopy[language].templates.delete(template.name)}
                    className="inline-grid size-12 place-items-center rounded-field text-error-text transition hover:bg-error-surface"
                    onClick={() => onDelete(template)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </div>
              ) : null}
            </div>
            <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted">
              {template.instructions}
            </p>
          </article>
        ))}
      </div>
    ) : (
      <p className="mt-4 rounded-box border border-dashed border-line p-5 text-muted">
        {empty}
      </p>
    )}
  </section>
);

const TemplateForm = ({
  template,
  busy,
  creatorLanguage,
  onCancel,
  onSave,
}: {
  template?: PrivateInterviewTemplate;
  busy: boolean;
  creatorLanguage: CreatorLanguage;
  onCancel(): void;
  onSave(input: {
    name: string;
    sourceLanguage: ClientLanguage;
    instructions: string;
  }): Promise<void>;
}) => {
  const text = creatorCopy[creatorLanguage];
  const [name, setName] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<ClientLanguage>("en");
  const [instructions, setInstructions] = useState("");
  useEffect(() => {
    setName(template?.name ?? "");
    setSourceLanguage(template?.sourceLanguage ?? "en");
    setInstructions(template?.instructions ?? "");
  }, [template]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSave({
      name: name.trim(),
      sourceLanguage,
      instructions: instructions.trim(),
    });
  };
  return (
      <form className="mt-8 grid gap-5 rounded-box border border-line bg-panel p-6" onSubmit={submit}>
      <h2 className="font-display text-2xl font-extrabold">
        {template ? text.templates.editPrivate : text.templates.newPrivateForm}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={text.templates.templateName}>
          <TextInput
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <Field label={text.templates.sourceLanguage}>
          <Select
            onChange={(event) =>
              setSourceLanguage(event.target.value as ClientLanguage)
            }
            value={sourceLanguage}
          >
            <option value="en">{text.templates.language.en}</option>
            <option value="de">{text.templates.language.de}</option>
          </Select>
        </Field>
      </div>
      <Field label={text.templates.instructions}>
        <TextArea
          className="min-h-64"
          maxLength={50_000}
          onChange={(event) => setInstructions(event.target.value)}
          required
          value={instructions}
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-3">
        <button className={secondaryButton} onClick={onCancel} type="button">
          {text.templates.cancel}
        </button>
        <button
          className={primaryButton}
          disabled={busy || !name.trim() || !instructions.trim()}
          type="submit"
        >
          {text.templates.save}
        </button>
      </div>
    </form>
  );
};
