import type { MaterialUploadStore } from "../application/material-upload-store";
import type { ProjectInterviewer } from "../domain/project-interviewer";
import { createHostedApplication } from "./hosted-application";
import {
  actorValue,
  browserCryptography,
  record,
  references,
  stringValue,
  type HostedConvexTransport,
} from "./hosted-contract";

export const createHostedApplicationBundle = (
  transport: HostedConvexTransport,
): {
  application: ProjectInterviewer;
  materialFileStore: MaterialUploadStore;
} => {
  const pendingUploads = new Map<
    string,
    { materialId: string; operationId: string }
  >();
  const application = createHostedApplication(
    transport,
    browserCryptography,
    pendingUploads,
  );
  const materialFileStore: MaterialUploadStore = {
    async save(file, scope) {
      if (!scope.actor) throw new Error("The upload actor is missing.");
      const reference = browserCryptography.randomToken();
      const requested = record(
        await transport.mutation(references.materials.requestUpload, {
          roomId: scope.roomId,
          actor: actorValue(scope.actor),
          name: file.name,
          size: file.size,
          declaredContentType:
            file.type || "application/octet-stream",
          idempotencyKey: reference,
        }),
      );
      const response = await fetch(
        stringValue(requested.uploadUrl, "upload URL"),
        {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        },
      );
      if (!response.ok) throw new Error("Project Material upload failed.");
      const uploaded = record(await response.json());
      const committed = record(
        await transport.mutation(references.materials.commitUpload, {
          roomId: scope.roomId,
          actor: actorValue(scope.actor),
          intentId: stringValue(requested.intentId, "upload intent"),
          storageId: stringValue(uploaded.storageId, "storage id"),
        }),
      );
      pendingUploads.set(reference, {
        materialId: stringValue(committed.materialId, "material id"),
        operationId: stringValue(committed.operationId, "operation id"),
      });
      return reference;
    },
    async remove(reference, scope) {
      const pending = pendingUploads.get(reference);
      if (!pending || !scope.actor) return;
      await application.materials.remove(
        scope.actor,
        scope.roomId,
        pending.materialId,
      );
      pendingUploads.delete(reference);
    },
  };
  return { application, materialFileStore };
};
