export const encodeCapabilityBytes = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const decodeCapabilityBytes = (value: string): Uint8Array => {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error("Invalid encrypted capability.");
  }
  return new Uint8Array(
    value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );
};

const capabilityEncryptionKey = async (
  deploymentSecret: string,
  usages: KeyUsage[],
): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(deploymentSecret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("project-interviewer"),
      info: encoder.encode("invite-capability:v1"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
};

export interface SealedCapabilityToken {
  ciphertext: string;
  iv: string;
}

export const sealCapabilityToken = async (
  token: string,
  deploymentSecret: string,
  scope: string,
): Promise<SealedCapabilityToken> => {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(scope),
    },
    await capabilityEncryptionKey(deploymentSecret, ["encrypt"]),
    encoder.encode(token),
  );
  return {
    ciphertext: encodeCapabilityBytes(new Uint8Array(ciphertext)),
    iv: encodeCapabilityBytes(iv),
  };
};

export const openCapabilityToken = async (
  sealed: SealedCapabilityToken,
  deploymentSecret: string,
  scope: string,
): Promise<string> => {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeCapabilityBytes(sealed.iv),
      additionalData: new TextEncoder().encode(scope),
    },
    await capabilityEncryptionKey(deploymentSecret, ["decrypt"]),
    decodeCapabilityBytes(sealed.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
};

export const createCapabilityToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeCapabilityBytes(bytes);
};

export const hashCapability = async (value: string): Promise<string> =>
  encodeCapabilityBytes(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
