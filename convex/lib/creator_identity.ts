import type { Doc } from "../_generated/dataModel";

export type PublicCreatorIdentity = {
  displayName: string;
  contactEmail: string;
  privacyPolicyUrl?: string;
};

export const publicCreatorIdentity = (
  creator: Doc<"creatorProfiles">,
): PublicCreatorIdentity | null =>
  creator.contactEmail
    ? {
        displayName: creator.displayName,
        contactEmail: creator.contactEmail,
        ...(creator.privacyPolicyUrl
          ? { privacyPolicyUrl: creator.privacyPolicyUrl }
          : {}),
      }
    : null;

export const requirePublicCreatorIdentity = (
  creator: Doc<"creatorProfiles">,
) => {
  const identity = publicCreatorIdentity(creator);
  if (!identity) {
    throw new Error(
      "Complete your public display name and contact email in Settings before creating or sharing Interviews.",
    );
  }
  return identity;
};
