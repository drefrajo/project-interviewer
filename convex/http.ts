import {
  httpActionGeneric,
  httpRouter,
  makeFunctionReference,
} from "convex/server";
import type { GenericId } from "convex/values";
import { authComponent, createAuth } from "./auth";
import {
  createCapabilityToken,
  hashCapability,
} from "./lib/capability-crypto";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

const exchangeCapabilityHashReference = makeFunctionReference<
  "mutation",
  {
    tokenHash: string;
    sessionHash: string;
    deviceHash: string;
  },
  { roomId: GenericId<"projectRooms">; inviteVersion: number }
>("invites:exchangeCapabilityHash");

const clientCorsHeaders = () => ({
  "access-control-allow-origin": process.env.SITE_URL ?? "",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  vary: "Origin",
});

http.route({
  path: "/api/client/session",
  method: "OPTIONS",
  handler: httpActionGeneric(async () =>
    new Response(null, { status: 204, headers: clientCorsHeaders() }),
  ),
});

http.route({
  path: "/api/client/session",
  method: "POST",
  handler: httpActionGeneric(async (context, request) => {
    const body = (await request.json()) as {
      inviteToken?: unknown;
      deviceId?: unknown;
    };
    if (
      typeof body.inviteToken !== "string" ||
      typeof body.deviceId !== "string"
    ) {
      return Response.json(
        { error: "invalid_request" },
        { status: 400, headers: clientCorsHeaders() },
      );
    }
    const sessionToken = createCapabilityToken();
    const result = await context.runMutation(
      exchangeCapabilityHashReference,
      {
        tokenHash: await hashCapability(body.inviteToken),
        sessionHash: await hashCapability(sessionToken),
        deviceHash: await hashCapability(body.deviceId),
      },
    );
    return Response.json(
      {
        roomId: result.roomId,
        inviteVersion: result.inviteVersion,
        sessionToken,
      },
      { headers: clientCorsHeaders() },
    );
  }),
});

export default http;
