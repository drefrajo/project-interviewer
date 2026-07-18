import type { RoomActor } from "../domain/project-interviewer";

export interface MaterialUploadStore {
  save(
    file: File,
    scope: {
      roomId: string;
      uploaderId: string;
      actor?: RoomActor;
    },
  ): Promise<string>;
  remove(
    reference: string,
    scope: {
      roomId: string;
      uploaderId: string;
      actor?: RoomActor;
    },
  ): Promise<void>;
}
