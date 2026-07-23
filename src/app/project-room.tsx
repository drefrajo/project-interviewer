import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Check,
  Copy,
  FileText,
  FolderOpen,
  Home,
  Link2,
  MessageCircleQuestion,
  Share2,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type {
  Language,
  ProjectInterviewer,
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
import { SharedResourcesPanel } from "./shared-resources-panel";
import {
  projectAttentionFor,
  projectHomeTabs,
  type ProjectHomeTab,
} from "./project-next-action";

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
  const inviteRequestRef = useRef<{
    application: ProjectInterviewer;
    key: string;
  } | null>(null);

  useEffect(() => {
    const requestKey = `${inviteToken}\u0000${deviceId}`;
    if (
      inviteRequestRef.current?.application === application &&
      inviteRequestRef.current.key === requestKey
    ) {
      return;
    }
    inviteRequestRef.current = { application, key: requestKey };
    void application.clientAccess
      .resolveInvite(inviteToken, { deviceId })
      .then((nextAccess) => {
        if (
          inviteRequestRef.current?.application === application &&
          inviteRequestRef.current.key === requestKey
        ) {
          setAccess(nextAccess);
        }
      })
      .catch(() => {
        if (
          inviteRequestRef.current?.application !== application ||
          inviteRequestRef.current.key !== requestKey
        ) {
          return;
        }
        inviteRequestRef.current = null;
        setError(t("invalidInvite"));
      });
  }, [application, deviceId, inviteToken, t]);

  useEffect(() => {
    if (!access || access.onboardingRequired) return;
    const timer = window.setInterval(() => {
      void application.rooms
        .get(access.actor, access.room.id)
        .then((room) => {
          setError("");
          setAccess((current) =>
            current ? { ...current, room } : current,
          );
        })
        .catch(() => setError(t("invalidInvite")));
    }, 500);
    return () => window.clearInterval(timer);
  }, [access, application, t]);

  if (error) {
    return (
      <main
        className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-8 sm:px-8"
        id="main-content"
      >
        <section className="w-full max-w-xl border border-line bg-surface p-6 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-8">
          <h1 className="mb-3 font-display text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl">
            {t("unavailable")}
          </h1>
          <p className="mb-0 leading-7 text-muted">{error}</p>
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
    <main
      className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-5xl items-center px-4 py-8 sm:px-8 lg:px-12"
      id="main-content"
    >
      <section className="w-full border border-line bg-surface p-6 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-8 lg:p-10">
        <p className="mb-3 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
          {access.room.title} · {access.room.freelancerDisplayName}
        </p>
        <h1 className="mb-3 font-display text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl">
          {t("beforeBegin")}
        </h1>
        <p className="mb-8 max-w-3xl text-lg leading-7 text-muted">
          {t("process")}
        </p>
        <div className="mb-8 grid gap-3 md:grid-cols-3">
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
        <form className="grid gap-5 border-t border-line pt-6 sm:grid-cols-2" onSubmit={submit}>
          <TextField label={t("yourName")} name="displayName" required />
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
            <span>{t("interviewLanguage")}</span>
            <select
              className="min-h-11 rounded-md border border-[#bec7c0] bg-white px-3 py-2 font-normal"
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
          <label className="flex items-start gap-3 text-sm leading-6 text-ink sm:col-span-2">
            <input
              className="mt-0.5 size-5 shrink-0"
              name="acknowledged"
              required
              type="checkbox"
            />
            <span>
              {t("acknowledgement")}
            </span>
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0f3d2f] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            disabled={submitting}
          >
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
  <article className="border border-line bg-[#f8f8f4] p-4">
    <div className="mb-3 text-forest">{icon}</div>
    <h2 className="mb-2 font-display text-lg font-extrabold tracking-tight text-ink">
      {title}
    </h2>
    <p className="mb-0 text-sm leading-6 text-muted">{children}</p>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = projectHomeTabs.includes(
    requestedTab as ProjectHomeTab,
  )
    ? (requestedTab as ProjectHomeTab)
    : "overview";
  const tabButtons = useRef<Partial<Record<ProjectHomeTab, HTMLButtonElement>>>(
    {},
  );
  const tabs = [
    {
      id: "overview" as const,
      icon: <Home aria-hidden="true" size={18} />,
      label: t("overview"),
    },
    {
      id: "material" as const,
      icon: <FileText aria-hidden="true" size={18} />,
      label: t("material"),
    },
    {
      id: "interview" as const,
      icon: <MessageCircleQuestion aria-hidden="true" size={18} />,
      label: t("interview"),
    },
    {
      id: "brief" as const,
      icon: <FolderOpen aria-hidden="true" size={18} />,
      label: t("brief"),
    },
  ];
  const selectTab = (tab: ProjectHomeTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "overview") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next);
  };
  const moveFocus = (current: ProjectHomeTab, direction: number) => {
    const index = tabs.findIndex(({ id }) => id === current);
    const next = tabs[(index + direction + tabs.length) % tabs.length]!.id;
    selectTab(next);
    window.requestAnimationFrame(() => tabButtons.current[next]?.focus());
  };
  const attention = projectAttentionFor(room, actorKind, locale);
  return (
    <main
      className="grid min-h-[calc(100vh-4.5rem)] grid-cols-[minmax(0,1fr)] bg-canvas lg:grid-cols-[17rem_minmax(0,1fr)]"
      id="main-content"
    >
      <aside className="sticky top-0 z-10 min-w-0 max-w-full self-start border-b border-line bg-[#edf0e9] px-4 py-3 lg:h-[calc(100vh-4.5rem)] lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-6 lg:py-8">
        <div className="lg:mb-10">
          {actorKind === "freelancer" ? (
            <a
              className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-muted no-underline hover:text-ink lg:mb-10"
              href="/"
            >
              {t("backWorkspace")}
            </a>
          ) : (
            <span className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-muted lg:mb-10">
              {t("clientProjectHome")}
            </span>
          )}
          <p className="mb-2 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
            {room.clientLabel}
          </p>
          <h1 className="mb-3 font-display text-2xl leading-tight font-extrabold tracking-tight text-ink">
            {room.title}
          </h1>
          <span className="inline-flex bg-[#e3ede8] px-2 py-1 text-xs font-extrabold tracking-wide text-forest uppercase">
            {projectPhaseLabel(room.phase, locale)}
          </span>
        </div>
        <nav
          aria-label={t("roomNavigation")}
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              aria-controls={`room-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#255dff] lg:w-full ${
                activeTab === tab.id
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:bg-white/70 hover:text-ink"
              }`}
              id={`room-tab-${tab.id}`}
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  moveFocus(tab.id, 1);
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveFocus(tab.id, -1);
                }
                if (event.key === "Home") {
                  event.preventDefault();
                  selectTab(tabs[0]!.id);
                  window.requestAnimationFrame(() =>
                    tabButtons.current[tabs[0]!.id]?.focus(),
                  );
                }
                if (event.key === "End") {
                  event.preventDefault();
                  const last = tabs.at(-1)!;
                  selectTab(last.id);
                  window.requestAnimationFrame(() =>
                    tabButtons.current[last.id]?.focus(),
                  );
                }
              }}
              ref={(element) => {
                if (element) tabButtons.current[tab.id] = element;
              }}
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
              type="button"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <section
          aria-labelledby={`room-tab-${activeTab}`}
          className="mx-auto max-w-7xl"
          id={`room-panel-${activeTab}`}
          role="tabpanel"
          tabIndex={0}
        >
          {activeTab === "overview" ? (
            <ProjectRoomOverview
              actor={actor}
              application={application}
              attention={attention}
              room={room}
              selectTab={selectTab}
              {...(inviteToken ? { inviteToken } : {})}
              {...(onReadinessChange ? { onReadinessChange } : {})}
              {...(welcomeName ? { welcomeName } : {})}
            />
          ) : null}
          {activeTab === "material" ? (
            <ProjectMaterialPanel
              actor={actor}
              application={application}
              readOnly={room.phase === "archived"}
              room={room}
              {...(materialFileStore ? { materialFileStore } : {})}
              {...(onReadinessChange ? { onReadinessChange } : {})}
              onContinueToInterview={() => selectTab("interview")}
            />
          ) : null}
          {activeTab === "interview" ? (
            <DiscoveryInterviewPanel
              actor={actor}
              application={application}
              available={sectionAvailability.interview}
              readOnly={room.phase === "archived"}
              room={room}
              {...(onReadinessChange
                ? { onRoomChange: onReadinessChange }
                : {})}
            />
          ) : null}
          {activeTab === "brief" ? (
            <ProjectBriefPanel
              actor={actor}
              application={application}
              room={room}
              {...(onReadinessChange
                ? { onRoomChange: onReadinessChange }
                : {})}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
};

const ProjectRoomOverview = ({
  application,
  actor,
  attention,
  inviteToken,
  onReadinessChange,
  room,
  selectTab,
  welcomeName,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  attention: ReturnType<typeof projectAttentionFor>;
  inviteToken?: string;
  onReadinessChange?(): void;
  room: ProjectRoomView;
  selectTab(tab: ProjectHomeTab): void;
  welcomeName?: string;
}) => {
  const { t } = useI18n();
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
      <section className="border border-line bg-surface p-6 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-8">
        <p className="mb-3 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
          {t("projectHome")}
        </p>
        <h2 className="mb-4 font-display text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl">
          {welcomeName ? t("welcome", { name: welcomeName }) : t("overview")}
        </h2>
        <p className="mb-8 max-w-3xl text-base leading-7 text-muted">
          {room.projectDescription}
        </p>
        <dl className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-extrabold tracking-[0.12em] text-muted uppercase">
              {t("clientLabel")}
            </dt>
            <dd className="mt-1 font-semibold text-ink">{room.clientLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-extrabold tracking-[0.12em] text-muted uppercase">
              Freelancer
            </dt>
            <dd className="mt-1 font-semibold text-ink">
              {room.freelancerDisplayName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-extrabold tracking-[0.12em] text-muted uppercase">
              {t("briefLanguage")}
            </dt>
            <dd className="mt-1 font-semibold text-ink">
              {room.briefLanguage === "de" ? "Deutsch" : "English"}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid content-start gap-5">
        <section className="flex flex-col justify-between bg-forest p-6 text-white shadow-[0_1.5rem_4rem_rgb(19_34_29_/_14%)] sm:p-8">
          <div>
            <p className="mb-3 text-xs font-extrabold tracking-[0.14em] text-lime uppercase">
              {t("nextStep")}
            </p>
            <h2 className="mb-3 font-display text-2xl leading-tight font-extrabold tracking-tight">
              {attention.title}
            </h2>
            <p className="text-sm leading-6 text-white/80">{attention.detail}</p>
          </div>
          {attention.targetTab && attention.label ? (
            <button
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-lime px-4 py-2 text-sm font-extrabold text-ink transition-colors hover:bg-[#d9f58e]"
              onClick={() => selectTab(attention.targetTab!)}
              type="button"
            >
              {attention.label}
            </button>
          ) : null}
        </section>
        <SharedResourcesPanel
          actor={actor}
          application={application}
          readOnly={room.phase === "archived" && actor.kind === "client"}
          roomId={room.id}
        />
      </div>

      {actor.kind === "freelancer" ? (
        <div className="xl:col-span-2">
          <InviteLinkControls
            actor={actor}
            application={application}
            roomId={room.id}
            {...(inviteToken ? { initialInviteToken: inviteToken } : {})}
          />
        </div>
      ) : null}

      <div className="xl:col-span-2">
        <ProjectLifecycleControls
          actor={actor}
          application={application}
          room={room}
          {...(onReadinessChange ? { onRoomChange: onReadinessChange } : {})}
        />
      </div>
    </div>
  );
};

const InviteLinkControls = ({
  application,
  actor,
  roomId,
  initialInviteToken,
}: {
  application: ProjectInterviewer;
  actor: Extract<RoomActor, { kind: "freelancer" }>;
  roomId: string;
  initialInviteToken?: string;
}) => {
  const { t } = useI18n();
  const [inviteToken, setInviteToken] = useState(initialInviteToken);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    "loading" | "active" | "unavailable" | "revoked"
  >(initialInviteToken ? "active" : "loading");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const inviteLoadRevision = useRef(0);
  useEffect(() => {
    let active = true;
    const loadInvite = () => {
      const revision = ++inviteLoadRevision.current;
      void application.clientAccess
        .getInvite(actor, roomId)
        .then((invite) => {
          if (!active || revision !== inviteLoadRevision.current) return;
          setStatus(invite.status);
          setCopied(false);
          if (invite.status === "active") {
            setInviteToken(invite.inviteToken);
          } else if (invite.status === "revoked") {
            setInviteToken(undefined);
          } else if (!initialInviteToken) {
            setInviteToken(undefined);
          }
        })
        .catch((cause: unknown) => {
          if (!active || revision !== inviteLoadRevision.current) return;
          setError(cause instanceof Error ? cause.message : String(cause));
        });
    };
    const loadVisibleInvite = () => {
      if (document.visibilityState === "visible") loadInvite();
    };
    loadInvite();
    window.addEventListener("focus", loadInvite);
    document.addEventListener("visibilitychange", loadVisibleInvite);
    return () => {
      active = false;
      window.removeEventListener("focus", loadInvite);
      document.removeEventListener("visibilitychange", loadVisibleInvite);
    };
  }, [actor, application, initialInviteToken, roomId]);
  const inviteUrl = inviteToken
    ? `${window.location.origin}/invite/${inviteToken}`
    : undefined;
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-labelledby="invite-heading"
      className="flex items-start gap-4 border-l-4 border-coral bg-[#fff1e7] p-5"
    >
      <Share2 aria-hidden="true" className="mt-1 shrink-0 text-[#9b432d]" />
      <div className="min-w-0">
        <h2 className="mb-1 font-display text-lg font-extrabold tracking-tight text-ink" id="invite-heading">
          {inviteToken ? t("inviteCreated") : t("inviteControls")}
        </h2>
        {inviteToken ? (
          <>
            <p className="mb-3 text-sm leading-6 text-muted">{t("inviteHint")}</p>
            <code className="block break-all rounded bg-white/70 p-3 text-sm text-ink">{inviteUrl}</code>
          </>
        ) : null}
        {status === "unavailable" && !inviteToken ? (
          <p className="mt-3 text-sm text-ink" role="status">{t("inviteUnavailable")}</p>
        ) : null}
        {status === "revoked" ? <p className="mt-3 text-sm text-ink" role="status">{t("inviteRevoked")}</p> : null}
        {error ? <p className="mt-3 text-sm font-bold text-[#852f21]" role="alert">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {inviteUrl ? (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-[#174f3f]"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await navigator.clipboard.writeText(inviteUrl);
                  setCopied(true);
                })
              }
              type="button"
            >
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copied ? t("inviteCopied") : t("copyInvite")}
            </button>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-white"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  inviteLoadRevision.current += 1;
                  const result = await application.clientAccess.rotateInvite(
                    actor,
                    roomId,
                  );
                  inviteLoadRevision.current += 1;
                  setInviteToken(result.inviteToken);
                setStatus("active");
                setCopied(false);
              })
            }
            type="button"
          >
            {t("rotateInvite")}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#e9b29e] bg-transparent px-4 py-2 text-sm font-bold text-[#852f21] hover:bg-white"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  inviteLoadRevision.current += 1;
                  await application.clientAccess.revokeInvite(actor, roomId);
                  inviteLoadRevision.current += 1;
                  setInviteToken(undefined);
                setStatus("revoked");
                setCopied(false);
              })
            }
            type="button"
          >
            {t("revokeInvite")}
          </button>
        </div>
      </div>
    </section>
  );
};

const Loading = ({ label }: { label: string }) => (
  <main
    className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-8 sm:px-8"
    id="main-content"
  >
    <div
      aria-live="polite"
      className="flex items-center gap-3 font-semibold text-muted"
      role="status"
    >
      <span aria-hidden="true" className="size-3 animate-pulse rounded-full bg-forest" />
      {label}
    </div>
  </main>
);

const ProjectLifecycleControls = ({
  application,
  actor,
  room,
  onRoomChange,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  room: ProjectRoomView;
  onRoomChange?(): void;
}) => {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  if (actor.kind !== "freelancer") return null;
  const text =
    locale === "de"
      ? {
          archive: "Projektraum archivieren",
          restore: "Projektraum wiederherstellen",
          remove: "Projektraum löschen",
          confirm:
            "Der Zugriff endet sofort. Der Raum kann sieben Tage lang wiederhergestellt werden.",
          confirmRemove: "Löschen und Zugriff widerrufen",
          cancel: "Abbrechen",
          reopen: "Klärung erneut öffnen",
        }
      : {
          archive: "Archive Project Room",
          restore: "Restore Project Room",
          remove: "Delete Project Room",
          confirm:
            "Access ends immediately. You can recover this room for seven days.",
          confirmRemove: "Delete and revoke access",
          cancel: "Cancel",
          reopen: "Reopen discovery",
        };
  const perform = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      onRoomChange?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const canReopen = [
    "freelancer_review",
    "client_review",
    "approved",
  ].includes(room.phase);
  return (
    <section
      aria-label={
        locale === "de"
          ? "Projektraum-Lebenszyklus"
          : "Project Room lifecycle"
      }
      className="border border-line bg-surface p-5 shadow-sm"
    >
      {error ? <p className="mb-3 font-bold text-[#852f21]" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {room.phase === "archived" ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-[#0f3d2f]"
            disabled={busy}
            onClick={() =>
              void perform(() =>
                application.projectHome.lifecycle.restoreArchived(
                  actor,
                  room.id,
                ),
              )
            }
            type="button"
          >
            {text.restore}
          </button>
        ) : (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-[#f5f6f0]"
            disabled={busy}
            onClick={() =>
              void perform(() =>
                application.projectHome.lifecycle.archive(
                  actor,
                  room.id,
                ),
              )
            }
            type="button"
          >
            {text.archive}
          </button>
        )}
        {canReopen ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-[#f5f6f0]"
            disabled={busy}
            onClick={() =>
              void perform(() =>
                application.projectHome.lifecycle.reopenDiscovery(
                  actor,
                  room.id,
                ),
              )
            }
            type="button"
          >
            {text.reopen}
          </button>
        ) : null}
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#e9b29e] bg-transparent px-4 py-2 text-sm font-bold text-[#852f21] hover:bg-[#fff1e7]"
          disabled={busy}
          onClick={() => setConfirmingDelete(true)}
          type="button"
        >
          {text.remove}
        </button>
      </div>
      {confirmingDelete ? (
        <div className="mt-4 border-t border-[#f0c6b3] bg-[#fff1e7] p-4" role="alert">
          <p className="mb-3 text-sm leading-6 text-ink">{text.confirm}</p>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#e9b29e] bg-white px-4 py-2 text-sm font-bold text-[#852f21] hover:bg-[#fff7f2]"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await application.projectHome.lifecycle.delete(
                    actor,
                    room.id,
                  );
                  navigate("/");
                })
              }
              type="button"
            >
              {text.confirmRemove}
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-white"
              onClick={() => setConfirmingDelete(false)}
              type="button"
            >
              {text.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

const getOrCreateDeviceId = (): string => {
  const key = "project-interviewer.device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
};

const availabilityFor = (room: ProjectRoomView) => ({
  material: true,
  interview: room.interviewReadiness === "ready",
  brief: ["freelancer_review", "client_review", "approved", "archived"].includes(
    room.phase,
  ),
});
