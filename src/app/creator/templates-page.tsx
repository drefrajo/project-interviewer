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

export const TemplatesPage = () => {
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
          <h1 className="font-display text-4xl font-extrabold">Templates</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Templates prefill Interview Instructions. Editing one never changes
            an existing Interview.
          </p>
        </div>
        <button className={primaryButton} onClick={() => setEditing("new")} type="button">
          <Plus aria-hidden="true" size={18} />
          New Private Template
        </button>
      </header>
      {editing ? (
        <TemplateForm
          busy={busy}
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
        empty="Built-in templates are not available."
        templates={[...BUILT_IN_INTERVIEW_TEMPLATES]}
        title="Built-in Interview Templates"
      />
      <TemplateGroup<PrivateInterviewTemplate>
        empty="No Private Interview Templates yet."
        onDelete={setDeleting}
        onEdit={setEditing}
        templates={privateTemplates}
        title="Private Interview Templates"
      />
      <ConfirmDialog
        confirmLabel="Delete template"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => void deleteTemplate()}
        open={Boolean(deleting)}
        title="Delete Private Interview Template?"
      >
        <p>
          <strong>{deleting?.name}</strong> will be deleted immediately. Existing
          Interviews keep their instruction snapshot.
        </p>
      </ConfirmDialog>
    </main>
  );
};

const TemplateGroup = <Template extends InterviewTemplate>({
  title,
  empty,
  templates,
  onEdit,
  onDelete,
}: {
  title: string;
  empty: string;
  templates: Template[];
  onEdit?(template: Template): void;
  onDelete?(template: Template): void;
}) => (
  <section className="mt-10">
    <h2 className="font-display text-2xl font-extrabold">{title}</h2>
    {templates.length ? (
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <article className="rounded-xl border border-line bg-surface p-5" key={template._id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-extrabold">{template.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  Source language:{" "}
                  {template.sourceLanguage === "de" ? "German" : "English"}
                </p>
              </div>
              {onEdit && onDelete ? (
                <div className="flex gap-1">
                  <button
                    aria-label={`Edit ${template.name}`}
                    className="inline-grid size-11 place-items-center rounded-lg transition hover:bg-soft"
                    onClick={() => onEdit(template)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={17} />
                  </button>
                  <button
                    aria-label={`Delete ${template.name}`}
                    className="inline-grid size-11 place-items-center rounded-lg text-error-text transition hover:bg-error-surface"
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
      <p className="mt-4 rounded-xl border border-dashed border-line p-5 text-muted">
        {empty}
      </p>
    )}
  </section>
);

const TemplateForm = ({
  template,
  busy,
  onCancel,
  onSave,
}: {
  template?: PrivateInterviewTemplate;
  busy: boolean;
  onCancel(): void;
  onSave(input: {
    name: string;
    sourceLanguage: ClientLanguage;
    instructions: string;
  }): Promise<void>;
}) => {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<ClientLanguage>("en");
  const [instructions, setInstructions] = useState("");
  useEffect(() => {
    setName(template?.name ?? "");
    setLanguage(template?.sourceLanguage ?? "en");
    setInstructions(template?.instructions ?? "");
  }, [template]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSave({
      name: name.trim(),
      sourceLanguage: language,
      instructions: instructions.trim(),
    });
  };
  return (
    <form className="mt-8 grid gap-5 rounded-xl border border-line bg-surface p-6" onSubmit={submit}>
      <h2 className="font-display text-2xl font-extrabold">
        {template ? "Edit Private Interview Template" : "New Private Interview Template"}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Template name">
          <TextInput
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <Field label="Source language">
          <Select
            onChange={(event) => setLanguage(event.target.value as ClientLanguage)}
            value={language}
          >
            <option value="en">English</option>
            <option value="de">German</option>
          </Select>
        </Field>
      </div>
      <Field label="Interview Instructions">
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
          Cancel
        </button>
        <button
          className={primaryButton}
          disabled={busy || !name.trim() || !instructions.trim()}
          type="submit"
        >
          Save template
        </button>
      </div>
    </form>
  );
};
