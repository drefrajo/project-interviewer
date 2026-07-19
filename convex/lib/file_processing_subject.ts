type FileProcessingMaterial = {
  roomId: string;
};

export const isFileProcessingSubjectInRoom = ({
  material,
  roomId,
}: {
  material: FileProcessingMaterial;
  roomId: string;
}) => material.roomId === roomId;
