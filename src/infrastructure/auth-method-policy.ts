export const authMethodConfiguration = {
  registrationProviders: ["google", "github"],
  passwordEnabled: false,
  implicitAccountLinking: false,
  passkeysArePrimary: true,
} as const;

export type AuthenticationInventory = Readonly<{
  oauthProviders: readonly string[];
  passkeyIds: readonly string[];
}>;

export type AuthenticationMethod =
  | Readonly<{ kind: "oauth"; id: string }>
  | Readonly<{ kind: "passkey"; id: string }>;

type RemovalDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      reason: "last_method" | "two_passkeys_required" | "method_not_found";
    }>;

const canRemove = (
  inventory: AuthenticationInventory,
  method: AuthenticationMethod,
): RemovalDecision => {
  const exists =
    method.kind === "oauth"
      ? inventory.oauthProviders.includes(method.id)
      : inventory.passkeyIds.includes(method.id);
  if (!exists) {
    return { allowed: false, reason: "method_not_found" };
  }

  const totalMethods =
    inventory.oauthProviders.length + inventory.passkeyIds.length;
  if (totalMethods === 1) {
    return { allowed: false, reason: "last_method" };
  }

  if (
    method.kind === "oauth" &&
    inventory.oauthProviders.length === 1 &&
    inventory.passkeyIds.length < 2
  ) {
    return { allowed: false, reason: "two_passkeys_required" };
  }

  return { allowed: true };
};

export const accountMethodPolicy = { canRemove } as const;
