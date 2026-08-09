import type { CreatorProfile } from "../../infrastructure/interview-api";

export const hasCompletePublicCreatorIdentity = (
  profile: CreatorProfile | null | undefined,
) =>
  Boolean(
    profile?.displayName?.trim() &&
      profile.contactEmail?.trim() &&
      profile.privacyPolicyUrl?.trim(),
  );
