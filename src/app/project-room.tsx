import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  FileText,
  FolderOpen,
  Home,
  Link2,
  MessageCircleQuestion,
  Share2,
} from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import type {
  Language,
  ProjectInterviewer,
  ProjectPhase,
  ProjectRoomView,
  RoomActor,
} from "../domain/project-interviewer";
import type { RouteContext } from "./routes";
import { TextField } from "./workspace";
import { useI18n } from "./i18n";
import { ProjectMaterialPanel } from "./project-material-panel";
import { projectPhaseLabel } from "./project-phase-copy";
import { DiscoveryInterviewPanel } from "./discovery-interview-panel";
import { ProjectBriefPanel } from "./project-brief-panel";

export const FreelancerProjectRoom = ({
  application,
  freelancer,
  materialFileStore,
}: RouteContext) => {
  const { roomId = "" } = useParams();
  const location = useLocation();
  const inviteToken = (location.state as { inviteToken?: string } | null)
    ?.inviteToken;
  return (
    <ProjectRoomLoader
      actor={freelancer}
      application={application}
      roomId={roomId}
      {...(materialFileStore ? { materialFileStore } : {})}
      {...(inviteToken ? { inviteToken } : {})}
    />
  );
};

const ProjectRoomLoader = ({
  application,
  actor,
  roomId,
  inviteToken,
  welcomeName,
  materialFileStore,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  roomId: string;
  inviteToken?: string;
  welcomeName?: string;
  materialFileStore?: RouteContext["materialFileStore"];
}) => {
  const { t } = useI18n();
  const [room, setRoom] = useState<ProjectRoomView>();
  useEffect(() => {
    void application.rooms.get(actor, roomId).then(setRoom);
  }, [actor, application, roomId]);
  if (!room) return <Loading label={t("openingRoom")} />;
  return (
    <ProjectRoomHome
      room={room}
      actor={actor}
      application={application}
      onReadinessChange={() => {
        void application.rooms.get(actor, roomId).then(setRoom);
      }}
      {...(materialFileStore ? { materialFileStore } : {})}
      {...(inviteToken ? { inviteToken } : {})}
      {...(welcomeName ? { welcomeName } : {})}
    />
  );
};

export const ClientEntry = ({
  application,
  materialFileStore,
}: RouteContext) => {
  const { t } = useI18n();
  sessionStorage.setItem("project-interviewer.actor-mode", "client");
  const { inviteToken = "" } = useParams();
  const [access, setAccess] = useState<Awaited<
    ReturnType<ProjectInterviewer["clientAccess"]["resolveInvite"]>
  > | null>(null);
  const [error, setError] = useState("");
  const deviceId = useMemo(getOrCreateDeviceId, []);

  useEffect(() => {
    void application.clientAccess
      .resolveInvite(inviteToken, { deviceId })
      .then(setAccess)
      .catch(() => setError(t("invalidInvite")));
  }, [application, deviceId, inviteToken, t]);

  if (error) {
    return (
      <main className="page centered" id="main-content">
        <section className="panel narrow">
          <h1>{t("unavailable")}</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }
  if (!access) return <Loading label={t("openingInvite")} />;
  if (access.onboardingRequired) {
    return (
      <ClientOnboarding
        access={access}
        application={application}
        onComplete={(room) =>
          setAccess({
            ...access,
            room,
            onboardingRequired: false,
            client: room.client,
          })
        }
      />
    );
  }
  return (
    <ProjectRoomHome
      actor={access.actor}
      actorKind="client"
      application={application}
      room={access.room}
      onReadinessChange={() => {
        void application.rooms
          .get(access.actor, access.room.id)
          .then((room) => setAccess({ ...access, room }));
      }}
      {...(materialFileStore ? { materialFileStore } : {})}
      {...(access.client?.displayName
        ? { welcomeName: access.client.displayName }
        : {})}
    />
  );
};

const ClientOnboarding = ({
  application,
  access,
  onComplete,
}: {
  application: ProjectInterviewer;
  access: Awaited<
    ReturnType<ProjectInterviewer["clientAccess"]["resolveInvite"]>
  >;
  onComplete(room: ProjectRoomView): void;
}) => {
  const { locale, setLocale, t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const room = await application.clientAccess.onboard(access.actor, {
      displayName: String(form.get("displayName")),
      interviewLanguage: String(form.get("interviewLanguage")) as Language,
      acknowledgedDisclosure: form.get("acknowledged") === "on",
    });
    onComplete(room);
  };
  return (
    <main className="page centered" id="main-content">
      <section className="onboarding">
        <p className="eyebrow">
          {access.room.title} · {access.room.freelancerDisplayName}
        </p>
        <h1>{t("beforeBegin")}</h1>
        <p className="lead">{t("process")}</p>
        <div className="disclosure-grid">
          <Disclosure
            icon={<FileText aria-hidden="true" />}
            title={t("filesLimits")}
          >
            {t("filesLimitsBody")}
          </Disclosure>
          <Disclosure
            icon={<Share2 aria-hidden="true" />}
            title={t("aiProcessing")}
          >
            {t("aiProcessingBody")}
          </Disclosure>
          <Disclosure
            icon={<Link2 aria-hidden="true" />}
            title={t("protectAccess")}
          >
            {t("protectAccessBody")}
          </Disclosure>
        </div>
        <form className="onboarding-form" onSubmit={submit}>
          <TextField label={t("yourName")} name="displayName" required />
          <label className="field">
            <span>{t("interviewLanguage")}</span>
            <select
              name="interviewLanguage"
              onChange={(event) =>
                setLocale(event.target.value as Language)
              }
              value={locale}
            >
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
          <label className="check-row">
            <input name="acknowledged" required type="checkbox" />
            <span>
              {t("acknowledgement")}
            </span>
          </label>
          <button className="button primary wide" disabled={submitting}>
            {submitting ? t("entering") : t("enterRoom")}
          </button>
        </form>
      </section>
    </main>
  );
};

const Disclosure = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) => (
  <article className="disclosure">
    {icon}
    <h2>{title}</h2>
    <p>{children}</p>
  </article>
);

const ProjectRoomHome = ({
  application,
  actor,
  room,
  inviteToken,
  welcomeName,
  actorKind = "freelancer",
  materialFileStore,
  onReadinessChange,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  room: ProjectRoomView;
  inviteToken?: string;
  welcomeName?: string;
  actorKind?: "freelancer" | "client";
  materialFileStore?: RouteContext["materialFileStore"];
  onReadinessChange?(): void;
}) => {
  const { locale, t } = useI18n();
  const sectionAvailability = availabilityFor(room);
  return (
  <main className="room-layout" id="main-content">
    <aside className="room-sidebar">
      {actorKind === "freelancer" ? (
        <a className="back-link" href="/">
          {t("backWorkspace")}
        </a>
      ) : (
        <span className="back-link">{t("clientProjectHome")}</span>
      )}
      <p className="eyebrow">{room.clientLabel}</p>
      <h1>{room.title}</h1>
      <span className={`phase phase-${room.phase}`}>
        {projectPhaseLabel(room.phase, locale)}
      </span>
      <nav aria-label={t("roomNavigation")}>
        <a className="active" href="#overview">
          <Home aria-hidden="true" size={18} /> {t("overview")}
        </a>
        <a href="#material">
          <FileText aria-hidden="true" size={18} /> {t("material")}
        </a>
        <a href="#interview">
          <MessageCircleQuestion aria-hidden="true" size={18} />{" "}
          {t("interview")}
        </a>
        <a href="#brief">
          <FolderOpen aria-hidden="true" size={18} /> {t("brief")}
        </a>
        <a href="#resources">
          <Link2 aria-hidden="true" size={18} /> {t("resources")}
        </a>
      </nav>
    </aside>
    <div className="room-main">
      <section className="room-intro" id="overview">
        <div>
          <p className="eyebrow">{t("projectHome")}</p>
          <h2>
            {welcomeName ? t("welcome", { name: welcomeName }) : t("overview")}
          </h2>
          <p>{room.projectDescription}</p>
        </div>
        <div className="next-step">
          <span>{t("nextStep")}</span>
          <strong>{nextActionFor(room.phase, locale)}</strong>
        </div>
      </section>

      {inviteToken ? (
        <section className="invite-panel" aria-labelledby="invite-heading">
          <Share2 aria-hidden="true" />
          <div>
            <h2 id="invite-heading">{t("inviteCreated")}</h2>
            <p>{t("inviteHint")}</p>
            <code>{`${window.location.origin}/invite/${inviteToken}`}</code>
          </div>
        </section>
      ) : null}

      <ProjectMaterialPanel
        actor={actor}
        application={application}
        room={room}
        {...(materialFileStore ? { materialFileStore } : {})}
        {...(onReadinessChange ? { onReadinessChange } : {})}
      />

      <section className="home-grid">
        <DiscoveryInterviewPanel
          actor={actor}
          application={application}
          available={sectionAvailability.interview}
          room={room}
          {...(onReadinessChange
            ? { onRoomChange: onReadinessChange }
            : {})}
        />
        <ProjectBriefPanel
          actor={actor}
          application={application}
          room={room}
          {...(onReadinessChange
            ? { onRoomChange: onReadinessChange }
            : {})}
        />
        <AvailabilityCard
          available
          id="resources"
          title={t("resources")}
          icon={<Link2 aria-hidden="true" />}
        >
          {t("resourcesBody")}
        </AvailabilityCard>
      </section>
    </div>
  </main>
  );
};

const AvailabilityCard = ({
  id,
  title,
  icon,
  available = false,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  available?: boolean;
  children: ReactNode;
}) => (
  <article className="availability-card" id={id}>
    <div className="card-icon">{icon}</div>
    <div>
      <span className={available ? "status-ready" : "status-soon"}>
        <AvailabilityLabel available={available} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  </article>
);

const AvailabilityLabel = ({ available }: { available: boolean }) => {
  const { t } = useI18n();
  return <>{available ? t("available") : t("notAvailable")}</>;
};

const Loading = ({ label }: { label: string }) => (
  <main className="page centered" id="main-content">
    <div aria-live="polite" className="loading" role="status">
      <span aria-hidden="true" />
      {label}
    </div>
  </main>
);

const getOrCreateDeviceId = (): string => {
  const key = "project-interviewer.device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
};

const nextActionFor = (phase: ProjectPhase, locale: Language): string =>
  ({
    en: {
      setup: "Share the Invite Link",
      discovery: "Continue the Discovery Interview",
      freelancer_review: "Review the Brief Draft",
      client_review: "Review the Project Brief",
      approved: "Use the approved Project Home",
      archived: "Read-only archived Project Home",
    },
    de: {
      setup: "Einladungslink teilen",
      discovery: "Klärungsinterview fortsetzen",
      freelancer_review: "Briefentwurf prüfen",
      client_review: "Projektbrief prüfen",
      approved: "Freigegebene Projektübersicht nutzen",
      archived: "Archivierte Projektübersicht (nur Lesen)",
    },
  })[locale][phase];

const availabilityFor = (room: ProjectRoomView) => ({
  material: true,
  interview: room.interviewReadiness === "ready",
  brief: ["freelancer_review", "client_review", "approved", "archived"].includes(
    room.phase,
  ),
});
