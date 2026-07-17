import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type {
  Language,
  ProjectPhase,
  ProjectRoom,
} from "../domain/project-interviewer";
import type { RouteContext } from "./routes";
import { useI18n } from "./i18n";
import { projectPhaseLabel } from "./project-phase-copy";

export const Workspace = ({ application, freelancer }: RouteContext) => {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<
    Array<ProjectRoom & { nextAction: string }>
  >([]);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<ProjectPhase | "all">("all");

  useEffect(() => {
    void application.rooms
      .list(freelancer, {
        search,
        ...(phase === "all" ? {} : { phase }),
      })
      .then(setRooms);
  }, [application, freelancer, phase, search]);

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
            <button
              className="room-card"
              key={room.id}
              onClick={() => navigate(`/rooms/${room.id}`)}
            >
              <div className="room-card-top">
                <span className={`phase phase-${room.phase}`}>
                  {projectPhaseLabel(room.phase, locale)}
                </span>
                <span>{formatDate(room.updatedAt, locale)}</span>
              </div>
              <h2>{room.title}</h2>
              <p>{room.clientLabel}</p>
              <span className="next-action">
                {nextActionLabel(room.phase, locale)}{" "}
                <ArrowRight aria-hidden="true" size={15} />
              </span>
            </button>
          ))
        ) : (
          <div className="empty-state">
            <FolderOpen aria-hidden="true" size={28} />
            <h2>{t("noRooms")}</h2>
            <p>{t("noRoomsHint")}</p>
          </div>
        )}
      </section>
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

const nextActionLabel = (phase: ProjectPhase, locale: Language): string =>
  ({
    en: {
      setup: "Share Invite Link",
      discovery: "Continue discovery",
      freelancer_review: "Review Brief Draft",
      client_review: "Wait for Client review",
      approved: "Open Project Home",
      archived: "Restore Project Room",
    },
    de: {
      setup: "Einladungslink teilen",
      discovery: "Klärung fortsetzen",
      freelancer_review: "Briefentwurf prüfen",
      client_review: "Auf Client-Prüfung warten",
      approved: "Projektübersicht öffnen",
      archived: "Projektraum wiederherstellen",
    },
  })[locale][phase];

const formatDate = (timestamp: number, locale: Language) =>
  new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en", {
    day: "numeric",
    month: "short",
  }).format(timestamp);
