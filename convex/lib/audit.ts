import type {
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import type { GenericId } from "convex/values";

export const recordAudit = async (
  context: GenericMutationCtx<GenericDataModel>,
  input: {
    roomId: GenericId<"projectRooms">;
    actorKind: "freelancer" | "client" | "system";
    action: string;
    actorId?: string;
    deviceHash?: unknown;
    now?: number;
  },
) =>
  context.db.insert("auditEvents", {
    roomId: input.roomId,
    actorKind: input.actorKind,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(typeof input.deviceHash === "string" && input.deviceHash
      ? { deviceHash: input.deviceHash }
      : {}),
    action: input.action,
    createdAt: input.now ?? Date.now(),
  });
