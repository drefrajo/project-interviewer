import {
  createProjectInterviewer,
  type FreelancerActor,
  type ProjectInterviewer,
  type ProjectInterviewerSnapshot,
} from "../domain/project-interviewer";

const STATE_KEY = "project-interviewer.local-state.v1";
const FREELANCER_KEY = "project-interviewer.local-freelancer.v1";

const readSnapshot = (): ProjectInterviewerSnapshot | undefined => {
  const value = localStorage.getItem(STATE_KEY);
  if (!value) return undefined;
  try {
    return JSON.parse(value) as ProjectInterviewerSnapshot;
  } catch {
    localStorage.removeItem(STATE_KEY);
    return undefined;
  }
};

const randomToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(bytes);
};

const hashInviteToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return bytesToBase64Url(new Uint8Array(digest));
};

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

export const createLocalApplication = async (): Promise<{
  application: ProjectInterviewer;
  freelancer: FreelancerActor;
}> => {
  const initialState = readSnapshot();
  const application = createProjectInterviewer({
    ids: {
      next: (prefix) => `${prefix}_${crypto.randomUUID()}`,
      inviteToken: randomToken,
      deviceId: () => crypto.randomUUID(),
    },
    clock: { now: () => Date.now() },
    inviteTokens: { hash: hashInviteToken },
    ...(initialState ? { initialState } : {}),
    persist: (snapshot) =>
      localStorage.setItem(STATE_KEY, JSON.stringify(snapshot)),
  });

  const savedFreelancerId = localStorage.getItem(FREELANCER_KEY);
  const existingFreelancer = application
    .inspectState()
    .freelancers.find(({ id }) => id === savedFreelancerId);
  const freelancer = existingFreelancer
    ? await application.identities.resumeDevelopmentFreelancer(
        existingFreelancer.id,
      )
    : await application.identities.createDevelopmentFreelancer({
        displayName: "Local Freelancer",
      });

  localStorage.setItem(FREELANCER_KEY, freelancer.freelancerId);
  return { application, freelancer };
};
