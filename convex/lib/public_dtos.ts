type Document = Readonly<Record<string, unknown>>;

export const clientRoomDto = (room: Document) => ({
  id: room._id,
  title: room.title,
  clientLabel: room.clientLabel,
  projectDescription: room.projectDescription,
  briefLanguage: room.briefLanguage,
  phase: room.phase,
  interviewReadiness: room.interviewReadiness,
  lastActivityAt: room.lastActivityAt,
});

export const clientMaterialDto = (material: Document) => ({
  id: material.id ?? material._id,
  roomId: material.roomId,
  name: material.name,
  size: material.size,
  declaredContentType: material.declaredContentType,
  actualContentType: material.actualContentType,
  state: material.state,
  stage: material.stage,
  active: material.active,
  retryAvailable: material.retryAvailable,
  uploaderKind: material.uploaderKind,
  extraction: material.extraction,
  analysis: material.analysis,
  analysisVersions: material.analysisVersions,
  failureCode: material.failureCode,
  canRemove: material.canRemove,
  createdAt: material.createdAt,
  updatedAt: material.updatedAt,
});
