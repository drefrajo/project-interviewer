import type { Doc } from "../_generated/dataModel";

export type PublicCreatorIdentity = {
  displayName: string;
  contactEmail: string;
  privacyPolicyUrl: string;
};

export const publicCreatorIdentity = (
  creator: Doc<"creatorProfiles">,
): PublicCreatorIdentity | null =>
  creator.contactEmail && creator.privacyPolicyUrl
    ? {
        displayName: creator.displayName,
        contactEmail: creator.contactEmail,
        privacyPolicyUrl: creator.privacyPolicyUrl,
      }
    : null;

export const requirePublicCreatorIdentity = (
  creator: Doc<"creatorProfiles">,
) => {
  const identity = publicCreatorIdentity(creator);
  if (!identity) {
    throw new Error(
      "Complete your public display name, contact email, and privacy policy URL in Settings before creating or sharing Interviews.",
    );
  }
  return identity;
};
