import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowRight,
  FolderOpen,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type {
  Language,
  ProjectNextAction,
  ProjectPhase,
  ProjectRoom,
  ProjectRoomView,
} from "../domain/project-interviewer";
import type { RouteContext } from "./routes";
import { useI18n } from "./i18n";
import { projectNextActionLabel } from "./project-next-action";
import { projectPhaseLabel } from "./project-phase-copy";

export const Workspace = ({ application, freelancer }: RouteContext) => {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<
    Array<ProjectRoom & { nextAction: ProjectNextAction }>
  >([]);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<ProjectPhase | "all">("all");
  const [deletedRooms, setDeletedRooms] = useState<
    Array<
      ProjectRoomView & {
        deletedAt: number;
        purgeAfter: number;
      }
    >
  >([]);
  const [confirmingDelete, setConfirmingDelete] = useState("");
  const lifecycleText =
    locale === "de"
      ? {
          open: "Öffnen",
          archive: "Archivieren",
          restore: "Wiederherstellen",
          remove: "Löschen",
          confirmRemove: "Löschen und Zugriff widerrufen",
          cancel: "Abbrechen",
          deleted: "Kürzlich gelöscht",
          deletedHint:
            "Nur für Freelancer sichtbar. Räume können sieben Tage lang wiederhergestellt werden.",
          recover: "Wiederherstellen",
          purge: "Endgültige Löschung",
        }
      : {
          open: "Open",
          archive: "Archive",
          restore: "Restore",
          remove: "Delete",
          confirmRemove: "Delete and revoke access",
          cancel: "Cancel",
          deleted: "Recently Deleted",
          deletedHint:
            "Freelancer-only. Rooms can be recovered for seven days.",
          recover: "Recover",
          purge: "Permanent deletion",
        };

  const reload = async () => {
    const [active, deleted] = await Promise.all([
      application.rooms.list(freelancer, {
        search,
        ...(phase === "all" ? {} : { phase }),
      }),
      application.projectHome.lifecycle.listRecentlyDeleted(
        freelancer,
      ),
    ]);
    setRooms(active);
    setDeletedRooms(deleted);
  };

  useEffect(() => {
    void reload();
    // The issued Freelancer identity is stable for this mounted route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application, freelancer, phase, search]);

  const performLifecycle = async (
    action: () => Promise<unknown>,
  ) => {
    await action();
    setConfirmingDelete("");
    await reload();
  };

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await application.rooms.create(freelancer, {
      title: String(form.get("title")),
      clientLabel: String(form.get("clientLabel")),
      projectDescription: String(form.get("projectDescription")),
      briefLanguage: String(form.get("briefLanguage")) as Language,
      freelancerGuidance: String(form.get("freelancerGuidance")),
    });
    navigate(`/rooms/${result.room.id}`, {
      state: { inviteToken: result.inviteToken },
    });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-12 lg:py-16" id="main-content">
      <section className="mb-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">{t("workspace")}</p>
          <h1 className="mb-3 font-display text-4xl leading-none font-extrabold tracking-tight text-ink sm:text-5xl">{t("rooms")}</h1>
          <p className="max-w-2xl leading-7 text-muted">{t("tagline")}</p>
        </div>
        <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-[#0f3d2f] sm:w-auto" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" size={18} />
          {t("createProjectRoom")}
        </button>
      </section>

      {creating ? (
        <section aria-labelledby="create-room-heading" className="mb-8 border border-line bg-surface p-5 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">{t("newProjectRoom")}</p>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink" id="create-room-heading">{t("startingPoint")}</h2>
            </div>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-[#f5f6f0]"
              onClick={() => setCreating(false)}
              type="button"
            >
              {t("cancel")}
            </button>
          </div>
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={createRoom}>
            <TextField label={t("projectTitle")} name="title" required />
            <TextField
              label={t("clientLabel")}
              name="clientLabel"
              required
            />
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink md:col-span-2">
              <span>{t("projectDescription")}</span>
              <textarea
                className="min-h-28 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal"
                name="projectDescription"
                required
                rows={4}
                placeholder={t("descriptionPlaceholder")}
              />
              <small className="font-normal text-muted">{t("descriptionHint")}</small>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
              <span>{t("briefLanguage")}</span>
              <select className="min-h-11 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal" defaultValue="en" name="briefLanguage">
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
              <span>{t("discoveryProfile")}</span>
              <select className="min-h-11 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal" disabled value="software-project">
                <option value="software-project">{t("softwareProject")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink md:col-span-2">
              <span>
                {t("guidance")} <em className="ml-1 text-xs font-normal not-italic text-muted">{t("privateOptional")}</em>
              </span>
              <textarea
                className="min-h-24 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal"
                name="freelancerGuidance"
                rows={3}
                placeholder={t("guidancePlaceholder")}
              />
            </label>
            <div className="flex justify-end md:col-span-2">
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-[#0f3d2f]" type="submit">
                {t("createRoom")} <ArrowRight aria-hidden="true" size={17} />
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section aria-label={t("roomFilters")} className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-[#bec7c0] bg-white px-3">
          <Search aria-hidden="true" size={18} />
          <span className="sr-only">{t("searchRooms")}</span>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent py-2 outline-none"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
        </label>
        <label>
          <span className="sr-only">{t("filterPhase")}</span>
          <select
            className="min-h-11 w-full rounded-md border border-[#bec7c0] bg-white px-3 py-2 sm:w-auto"
            onChange={(event) =>
              setPhase(event.target.value as ProjectPhase | "all")
            }
            value={phase}
          >
            <option value="all">{t("allPhases")}</option>
            {(
              [
                "setup",
                "discovery",
                "freelancer_review",
                "client_review",
                "approved",
                "archived",
              ] as ProjectPhase[]
            ).map((value) => (
              <option key={value} value={value}>
                {projectPhaseLabel(value, locale)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section aria-live="polite" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17.5rem),1fr))] gap-4">
        {rooms.length ? (
          rooms.map((room) => (
            <article className="flex flex-col border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-[0_1rem_2rem_rgb(19_34_29_/_8%)]" key={room.id}>
              <button
                aria-label={`${lifecycleText.open} ${room.title}`}
                className="flex flex-1 cursor-pointer flex-col p-5 text-left"
                onClick={() => navigate(`/rooms/${room.id}`)}
                type="button"
              >
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className={`inline-flex bg-[#e3ede8] px-2 py-1 text-[0.7rem] font-extrabold tracking-wide text-forest uppercase ${room.phase === "approved" ? "bg-lime" : room.phase === "archived" ? "bg-[#e9e7e0] text-muted" : ""}`}>
                    {projectPhaseLabel(room.phase, locale)}
                  </span>
                  <span>{formatDate(room.lastActivityAt, locale)}</span>
                </div>
                <h2 className="mt-10 mb-1 font-display text-2xl font-extrabold tracking-tight text-ink">{room.title}</h2>
                <p className="text-muted">{room.clientLabel}</p>
                <span className="mt-7 inline-flex items-center gap-1 font-bold text-forest">
                  {projectNextActionLabel(room.nextAction, locale)}{" "}
                  <ArrowRight aria-hidden="true" size={15} />
                </span>
              </button>
              <div className="flex flex-wrap gap-2 border-t border-line p-3">
                {room.phase === "archived" ? (
                  <button
                    aria-label={`${lifecycleText.restore} ${room.title}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-transparent px-3 py-2 text-sm font-bold text-ink hover:bg-[#f5f6f0]"
                    onClick={() =>
                      void performLifecycle(() =>
                        application.projectHome.lifecycle.restoreArchived(
                          freelancer,
                          room.id,
                        ),
                      )
                    }
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" size={15} />
                    {lifecycleText.restore}
                  </button>
                ) : (
                  <button
                    aria-label={`${lifecycleText.archive} ${room.title}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-transparent px-3 py-2 text-sm font-bold text-ink hover:bg-[#f5f6f0]"
                    onClick={() =>
                      void performLifecycle(() =>
                        application.projectHome.lifecycle.archive(
                          freelancer,
                          room.id,
                        ),
                      )
                    }
                    type="button"
                  >
                    <Archive aria-hidden="true" size={15} />
                    {lifecycleText.archive}
                  </button>
                )}
                <button
                  aria-label={`${lifecycleText.remove} ${room.title}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#e9b29e] bg-transparent px-3 py-2 text-sm font-bold text-[#852f21] hover:bg-[#fff1e7]"
                  onClick={() => setConfirmingDelete(room.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                  {lifecycleText.remove}
                </button>
              </div>
              {confirmingDelete === room.id ? (
                <div className="border-t border-[#f0c6b3] bg-[#fff1e7] p-3" role="alert">
                  <button
                    className="mr-2 inline-flex min-h-11 items-center justify-center rounded-md border border-[#e9b29e] bg-white px-3 py-2 text-sm font-bold text-[#852f21]"
                    onClick={() =>
                      void performLifecycle(() =>
                        application.projectHome.lifecycle.delete(
                          freelancer,
                          room.id,
                        ),
                      )
                    }
                    type="button"
                  >
                    {lifecycleText.confirmRemove}
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-3 py-2 text-sm font-bold text-ink hover:bg-white"
                    onClick={() => setConfirmingDelete("")}
                    type="button"
                  >
                    {lifecycleText.cancel}
                  </button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="col-span-full border border-dashed border-[#aeb8b1] p-12 text-center text-muted">
            <FolderOpen aria-hidden="true" size={28} />
            <h2>{t("noRooms")}</h2>
            <p>{t("noRoomsHint")}</p>
          </div>
        )}
      </section>

      {deletedRooms.length ? (
        <section
          aria-labelledby="recently-deleted-heading"
          className="mt-12 border-t border-line pt-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">{lifecycleText.deleted}</p>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink" id="recently-deleted-heading">
                {lifecycleText.deleted}
              </h2>
              <p>{lifecycleText.deletedHint}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {deletedRooms.map((room) => (
              <article className="flex flex-col gap-3 border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" key={room.id}>
                <div>
                  <h3 className="font-display font-bold text-ink">{room.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {lifecycleText.purge}:{" "}
                    {formatDate(room.purgeAfter, locale)}
                  </p>
                </div>
                <button
                  aria-label={`${lifecycleText.recover} ${room.title}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-[#f5f6f0]"
                  onClick={() =>
                    void performLifecycle(() =>
                      application.projectHome.lifecycle.recover(
                        freelancer,
                        room.id,
                      ),
                    )
                  }
                  type="button"
                >
                  <RotateCcw aria-hidden="true" size={15} />
                  {lifecycleText.recover}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
};

export const TextField = ({
  label,
  name,
  required,
}: {
  label: string;
  name: string;
  required?: boolean;
}) => (
  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
    <span>{label}</span>
    <input className="min-h-11 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal" name={name} required={required} />
  </label>
);

const formatDate = (timestamp: number, locale: Language) =>
  new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en", {
    day: "numeric",
    month: "short",
  }).format(timestamp);
