import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Link2,
  Pencil,
  Trash2,
} from "lucide-react";
import type {
  ProjectInterviewer,
  RoomActor,
  SharedResource,
  SharedResourceInput,
} from "../domain/project-interviewer";
import { useI18n } from "./i18n";

const text = {
  en: {
    title: "Shared Resources",
    intro:
      "Links and non-secret notes shared by the Freelancer appear here immediately.",
    empty: "No Shared Resources have been added yet.",
    label: "Resource label",
    url: "Resource URL",
    note: "Non-secret note",
    account: "Account identifier (optional, never a password)",
    add: "Add Shared Resource",
    save: "Save Shared Resource",
    cancel: "Cancel edit",
    edit: "Edit",
    remove: "Remove",
    up: "Move up",
    down: "Move down",
    warning:
      "Never add passwords, API keys, tokens, or other secrets. Use a password manager.",
    archived: "This archived Project Home is read-only for the Client.",
  },
  de: {
    title: "Geteilte Ressourcen",
    intro:
      "Links und nicht geheime Notizen des Freelancers erscheinen hier sofort.",
    empty: "Noch keine geteilten Ressourcen vorhanden.",
    label: "Bezeichnung der Ressource",
    url: "URL der Ressource",
    note: "Nicht geheime Notiz",
    account: "Kontokennung (optional, niemals ein Passwort)",
    add: "Geteilte Ressource hinzufügen",
    save: "Geteilte Ressource speichern",
    cancel: "Bearbeitung abbrechen",
    edit: "Bearbeiten",
    remove: "Entfernen",
    up: "Nach oben",
    down: "Nach unten",
    warning:
      "Keine Passwörter, API-Schlüssel, Tokens oder andere Geheimnisse eintragen. Verwenden Sie einen Passwortmanager.",
    archived:
      "Diese archivierte Projektübersicht ist für den Client schreibgeschützt.",
  },
} as const;

export const SharedResourcesPanel = ({
  application,
  actor,
  roomId,
  readOnly,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  roomId: string;
  readOnly: boolean;
}) => {
  const { locale } = useI18n();
  const copy = text[locale];
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [createFormVersion, setCreateFormVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canManage = actor.kind === "freelancer";

  const reload = async () => {
    setResources(
      await application.projectHome.resources.list(actor, roomId),
    );
  };

  useEffect(() => {
    void reload().catch((cause: unknown) =>
      setError(errorMessage(cause)),
    );
    // The issued actor identity is stable for this mounted route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, application, roomId]);

  useEffect(() => {
    if (actor.kind !== "client") return;
    const timer = window.setInterval(() => {
      void reload().catch((cause: unknown) =>
        setError(errorMessage(cause)),
      );
    }, 500);
    return () => window.clearInterval(timer);
    // The issued actor identity is stable for this mounted route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, application, roomId]);

  const perform = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
      await reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = resourceInput(new FormData(event.currentTarget));
    await perform(async () => {
      await application.projectHome.resources.create(
        actor,
        roomId,
        input,
      );
      setCreateFormVersion((version) => version + 1);
    });
  };

  const update = async (
    event: FormEvent<HTMLFormElement>,
    resourceId: string,
  ) => {
    event.preventDefault();
    const input = resourceInput(new FormData(event.currentTarget));
    await perform(async () => {
      await application.projectHome.resources.update(
        actor,
        roomId,
        resourceId,
        input,
      );
      setEditingId(undefined);
    });
  };

  const move = async (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= resources.length) return;
    const ids = resources.map(({ id }) => id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await perform(() =>
      application.projectHome.resources.reorder(
        actor,
        roomId,
        ids,
      ),
    );
  };

  return (
    <section
      aria-labelledby="shared-resources-heading"
      className="border border-line bg-surface p-5 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">{copy.title}</p>
          <h2 className="mb-2 flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight text-ink" id="shared-resources-heading">
            <Link2 aria-hidden="true" size={22} /> {copy.title}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted">{copy.intro}</p>
        </div>
      </div>
      {readOnly ? (
        <p className="my-4 border-l-[3px] border-coral bg-[#fff1e7] p-3 text-sm leading-6 text-ink" role="status">
          {copy.archived}
        </p>
      ) : null}
      {error ? <p className="mt-4 font-bold text-[#852f21]" role="alert">{error}</p> : null}
      <div aria-live="polite" className="my-4 grid gap-3">
        {resources.length ? (
          resources.map((resource, index) => (
            <article className="flex flex-col items-start justify-between gap-4 border border-line bg-[#f8f8f4] p-4 sm:flex-row" key={resource.id}>
              {editingId === resource.id ? (
                <form className="w-full" onSubmit={(event) => update(event, resource.id)}>
                  <ResourceFields copy={copy} resource={resource} />
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-[#0f3d2f]"
                      disabled={busy}
                      type="submit"
                    >
                      {copy.save}
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-white"
                      onClick={() => setEditingId(undefined)}
                      type="button"
                    >
                      {copy.cancel}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    {resource.url ? (
                      <a
                        className="inline-flex items-center gap-1 font-display font-bold text-forest hover:underline"
                        href={resource.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {resource.label}
                        <ExternalLink aria-hidden="true" size={15} />
                      </a>
                    ) : (
                      <h3 className="mb-1 font-display text-lg font-bold text-ink">{resource.label}</h3>
                    )}
                    {resource.note ? <p className="mt-1 text-sm leading-6 text-muted">{resource.note}</p> : null}
                    {resource.accountIdentifier ? (
                      <code className="mt-2 inline-block rounded bg-white px-2 py-1 text-xs text-ink">{resource.accountIdentifier}</code>
                    ) : null}
                  </div>
                  {canManage ? (
                    <div
                      aria-label={`${copy.title}: ${resource.label}`}
                      className="flex shrink-0 gap-1"
                    >
                      <button
                        aria-label={`${copy.up}: ${resource.label}`}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                        type="button"
                      >
                        <ArrowUp aria-hidden="true" size={17} />
                      </button>
                      <button
                        aria-label={`${copy.down}: ${resource.label}`}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          busy || index === resources.length - 1
                        }
                        onClick={() => move(index, 1)}
                        type="button"
                      >
                        <ArrowDown aria-hidden="true" size={17} />
                      </button>
                      <button
                        aria-label={`${copy.edit}: ${resource.label}`}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busy}
                        onClick={() => setEditingId(resource.id)}
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={17} />
                      </button>
                      <button
                        aria-label={`${copy.remove}: ${resource.label}`}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-[#e9b29e] bg-surface text-[#852f21] hover:bg-[#fff1e7] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busy}
                        onClick={() =>
                          perform(() =>
                            application.projectHome.resources.remove(
                              actor,
                              roomId,
                              resource.id,
                            ),
                          )
                        }
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={17} />
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </article>
          ))
        ) : (
          <p className="border border-dashed border-[#aeb8b1] p-5 text-sm text-muted">{copy.empty}</p>
        )}
      </div>
      {canManage ? (
        <form
          className="border-t border-line pt-5"
          key={createFormVersion}
          onSubmit={create}
        >
          <ResourceFields copy={copy} />
          <p className="my-4 border-l-[3px] border-coral bg-[#fff1e7] p-3 text-sm leading-6 text-ink">{copy.warning}</p>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-[#0f3d2f] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {copy.add}
          </button>
        </form>
      ) : null}
    </section>
  );
};

const ResourceFields = ({
  copy,
  resource,
}: {
  copy: (typeof text)[keyof typeof text];
  resource?: SharedResource;
}) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
      <span>{copy.label}</span>
      <input
        className="min-h-11 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal"
        defaultValue={resource?.label}
        name="label"
        required
      />
    </label>
    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
      <span>{copy.url}</span>
      <input
        className="min-h-11 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal"
        defaultValue={resource?.url}
        name="url"
        type="url"
      />
    </label>
    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
      <span>{copy.note}</span>
      <textarea className="min-h-20 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal" defaultValue={resource?.note} name="note" rows={2} />
    </label>
    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
      <span>{copy.account}</span>
      <input
        autoComplete="off"
        className="min-h-11 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal"
        defaultValue={resource?.accountIdentifier}
        name="accountIdentifier"
      />
    </label>
  </div>
);

const resourceInput = (form: FormData): SharedResourceInput => ({
  label: String(form.get("label") ?? ""),
  url: String(form.get("url") ?? ""),
  note: String(form.get("note") ?? ""),
  accountIdentifier: String(form.get("accountIdentifier") ?? ""),
});

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "The operation failed.";
