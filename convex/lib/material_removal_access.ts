type MaterialRemovalActor = {
  kind: "freelancer" | "client";
  actorId: string;
};

type MaterialRemovalSubject = {
  state: string;
  uploaderId: string;
};

export const canRemoveProjectMaterial = ({
  material,
  actor,
  usedInTurn,
}: {
  material: MaterialRemovalSubject;
  actor: MaterialRemovalActor;
  usedInTurn: boolean;
}): boolean => {
  if (usedInTurn) return actor.kind === "freelancer";
  if (material.state === "failed" || material.state === "unsupported") {
    return true;
  }
  return material.uploaderId === actor.actorId;
};
