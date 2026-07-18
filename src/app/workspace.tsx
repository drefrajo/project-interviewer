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
    <main className="page" id="main-content">
      <section className="hero compact">
        <div>
          <p className="eyebrow">{t("workspace")}</p>
          <h1>{t("rooms")}</h1>
          <p>{t("tagline")}</p>
        </div>
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" size={18} />
          {t("createProjectRoom")}
        </button>
      </section>

      {creating ? (
        <section aria-labelledby="create-room-heading" className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("newProjectRoom")}</p>
              <h2 id="create-room-heading">{t("startingPoint")}</h2>
            </div>
            <button
              className="button ghost"
              onClick={() => setCreating(false)}
              type="button"
            >
              {t("cancel")}
            </button>
          </div>
          <form className="form-grid" onSubmit={createRoom}>
            <TextField label={t("projectTitle")} name="title" required />
            <TextField
              label={t("clientLabel")}
              name="clientLabel"
              required
            />
            <label className="field span-two">
              <span>{t("projectDescription")}</span>
              <textarea
                name="projectDescription"
                required
                rows={4}
                placeholder={t("descriptionPlaceholder")}
              />
              <small>{t("descriptionHint")}</small>
            </label>
            <label className="field">
              <span>{t("briefLanguage")}</span>
              <select defaultValue="en" name="briefLanguage">
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </label>
            <label className="field">
              <span>{t("discoveryProfile")}</span>
              <select disabled value="software-project">
                <option value="software-project">{t("softwareProject")}</option>
              </select>
            </label>
            <label className="field span-two">
              <span>
                {t("guidance")} <em>{t("privateOptional")}</em>
              </span>
              <textarea
                name="freelancerGuidance"
                rows={3}
                placeholder={t("guidancePlaceholder")}
              />
            </label>
            <div className="form-actions span-two">
              <button className="button primary" type="submit">
                {t("createRoom")} <ArrowRight aria-hidden="true" size={17} />
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section aria-label={t("roomFilters")} className="filter-bar">
        <label className="search-field">
          <Search aria-hidden="true" size={18} />
          <span className="sr-only">{t("searchRooms")}</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
        </label>
        <label className="select-field">
          <span className="sr-only">{t("filterPhase")}</span>
          <select
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

      <section aria-live="polite" className="room-grid">
        {rooms.length ? (
          rooms.map((room) => (
            <article className="room-card" key={room.id}>
              <button
                aria-label={`${lifecycleText.open} ${room.title}`}
                className="room-card-open"
                onClick={() => navigate(`/rooms/${room.id}`)}
                type="button"
              >
                <div className="room-card-top">
                  <span className={`phase phase-${room.phase}`}>
                    {projectPhaseLabel(room.phase, locale)}
                  </span>
                  <span>{formatDate(room.lastActivityAt, locale)}</span>
                </div>
                <h2>{room.title}</h2>
                <p>{room.clientLabel}</p>
                <span className="next-action">
                  {projectNextActionLabel(room.nextAction, locale)}{" "}
                  <ArrowRight aria-hidden="true" size={15} />
                </span>
              </button>
              <div className="room-card-actions">
                {room.phase === "archived" ? (
                  <button
                    aria-label={`${lifecycleText.restore} ${room.title}`}
                    className="button ghost"
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
                    className="button ghost"
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
                  className="button ghost danger"
                  onClick={() => setConfirmingDelete(room.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                  {lifecycleText.remove}
                </button>
              </div>
              {confirmingDelete === room.id ? (
                <div className="room-delete-confirmation" role="alert">
                  <button
                    className="button danger"
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
                    className="button ghost"
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
          <div className="empty-state">
            <FolderOpen aria-hidden="true" size={28} />
            <h2>{t("noRooms")}</h2>
            <p>{t("noRoomsHint")}</p>
          </div>
        )}
      </section>

      {deletedRooms.length ? (
        <section
          aria-labelledby="recently-deleted-heading"
          className="recently-deleted"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">{lifecycleText.deleted}</p>
              <h2 id="recently-deleted-heading">
                {lifecycleText.deleted}
              </h2>
              <p>{lifecycleText.deletedHint}</p>
            </div>
          </div>
          <div className="recently-deleted-list">
            {deletedRooms.map((room) => (
              <article key={room.id}>
                <div>
                  <h3>{room.title}</h3>
                  <p>
                    {lifecycleText.purge}:{" "}
                    {formatDate(room.purgeAfter, locale)}
                  </p>
                </div>
                <button
                  aria-label={`${lifecycleText.recover} ${room.title}`}
                  className="button ghost"
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
  <label className="field">
    <span>{label}</span>
    <input name={name} required={required} />
  </label>
);

const formatDate = (timestamp: number, locale: Language) =>
  new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en", {
    day: "numeric",
    month: "short",
  }).format(timestamp);
