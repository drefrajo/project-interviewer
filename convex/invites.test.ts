import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { createCapability, getCapability } from "./invites";

type RegisteredAction = {
  _handler: (
    context: {
      runAction: (
        reference: Parameters<typeof getFunctionName>[0],
        args: { roomId: string },
      ) => Promise<unknown>;
    },
    args: { roomId: string },
  ) => Promise<unknown>;
};

describe("Invite Link action compatibility", () => {
  it.each([
    {
      action: createCapability,
      target: "invite_actions:createCapability",
      result: { token: "invite-token", version: 2 },
    },
    {
      action: getCapability,
      target: "invite_actions:getCapability",
      result: { status: "active", token: "invite-token", version: 2 },
    },
  ])("delegates the legacy action path to $target", async ({
    action,
    target,
    result,
  }) => {
    const runAction = vi.fn(async (reference, args) => {
      expect(getFunctionName(reference)).toBe(target);
      expect(args).toEqual({ roomId: "room-id" });
      return result;
    });

    await expect(
      (action as unknown as RegisteredAction)._handler(
        { runAction },
        { roomId: "room-id" },
      ),
    ).resolves.toEqual(result);
    expect(runAction).toHaveBeenCalledOnce();
  });
});
