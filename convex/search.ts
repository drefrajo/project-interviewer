import {
  actionGeneric,
  internalQueryGeneric,
  makeFunctionReference,
  queryGeneric,
} from "convex/server";
import { v, type GenericId } from "convex/values";
import {
  buildStagedMaterialEvidence,
  decodeSourceLocator,
} from "../src/application/staged-material-retrieval";
import {
  requireRoomActorFromSession,
} from "./lib/server_authorization";

const getForClientReference = makeFunctionReference<
  "query",
  { roomId: GenericId<"projectRooms">; sessionHash: string },
  unknown
>("rooms:getForClient");
const getForFreelancerReference = makeFunctionReference<
  "query",
  { roomId: GenericId<"projectRooms"> },
  unknown
>("rooms:getForFreelancer");
const chunksByIdsReference = makeFunctionReference<
  "query",
  {
    roomId: GenericId<"projectRooms">;
    ids: GenericId<"materialChunks">[];
  },
  Array<{ _id: GenericId<"materialChunks"> } & Record<string, unknown>>
>("search:chunksByIds");

export const text = queryGeneric({
  args: {
    roomId: v.id("projectRooms"),
    searchText: v.string(),
    sessionHash: v.optional(v.string()),
  },
  handler: async (context, args) => {
    await requireRoomActorFromSession(
      context,
      args.roomId,
      args.sessionHash,
    );
    return context.db
      .query("materialChunks")
      .withSearchIndex("search_text", (query) =>
        query
          .search("text", args.searchText)
          .eq("roomId", args.roomId)
          .eq("active", true),
      )
      .take(12);
  },
});

export const chunksByIds = internalQueryGeneric({
  args: {
    roomId: v.id("projectRooms"),
    ids: v.array(v.id("materialChunks")),
  },
  handler: async (context, args) => {
    const documents = await Promise.all(
      args.ids.map((id) => context.db.get(id)),
    );
    return documents.filter(
      (document) =>
        document?.roomId === args.roomId && document.active === true,
    );
  },
});

export const interviewEvidenceBundle = internalQueryGeneric({
  args: {
    roomId: v.id("projectRooms"),
    searchText: v.string(),
    vectorChunkIds: v.optional(v.array(v.id("materialChunks"))),
  },
  handler: async (context, args) => {
    const [materials, analyses] = await Promise.all([
      context.db
        .query("projectMaterials")
        .withIndex("by_room_active", (query) =>
          query.eq("roomId", args.roomId),
        )
        .collect(),
      context.db
        .query("fileAnalyses")
        .withIndex("by_room", (query) =>
          query.eq("roomId", args.roomId),
        )
        .collect(),
    ]);
    const textMatches = args.searchText.trim()
      ? await context.db
          .query("materialChunks")
          .withSearchIndex("search_text", (query) =>
            query
              .search("text", args.searchText.trim().slice(0, 500))
              .eq("roomId", args.roomId)
              .eq("active", true),
          )
          .take(12)
      : [];
    const vectorMatches = await Promise.all(
      (args.vectorChunkIds ?? []).slice(0, 12).map((id) =>
        context.db.get(id),
      ),
    );
    const matches = [
      ...textMatches,
      ...vectorMatches.filter(
        (chunk) =>
          chunk?.roomId === args.roomId && chunk.active === true,
      ),
    ].filter(
      (chunk, index, all) =>
        all.findIndex(
          (candidate) => String(candidate?._id) === String(chunk?._id),
        ) === index,
    );
    const activeMaterials = materials.filter(
      (material) => material.active === true,
    );
    const materialNames = new Map(
      activeMaterials.map((material) => [
        String(material._id),
        material.name,
      ]),
    );
    const summaries = activeMaterials.flatMap((material) => {
      const latest = analyses
        .filter((analysis) => analysis.materialId === material._id)
        .sort((left, right) => right.analyzedAt - left.analyzedAt)[0];
      if (!latest) return [];
      return [
        {
          materialId: String(material._id),
          summary: latest.summary,
          sources: (Array.isArray(latest.summarySources)
            ? latest.summarySources
            : [])
            .map(decodeSourceLocator)
            .filter(
              (
                locator: ReturnType<typeof decodeSourceLocator>,
              ): locator is NonNullable<
                ReturnType<typeof decodeSourceLocator>
              > => locator !== undefined,
            ),
        },
      ];
    });
    return buildStagedMaterialEvidence({
      materials: activeMaterials.map((material) => ({
        id: String(material._id),
        name: material.name,
        state: material.state,
        active: material.active,
      })),
      summaries,
      matches: matches.flatMap((chunk) => {
        const locator = decodeSourceLocator(chunk.locator);
        const materialName = materialNames.get(String(chunk.materialId));
        return locator && materialName
          ? [
              {
                id: String(chunk._id),
                materialId: String(chunk.materialId),
                materialName,
                text: chunk.text,
                locator,
              },
            ]
          : [];
      }),
    });
  },
});

export const inspectInterviewChunk = internalQueryGeneric({
  args: {
    roomId: v.id("projectRooms"),
    chunkId: v.string(),
  },
  handler: async (context, args) => {
    const chunkId = context.db.normalizeId(
      "materialChunks",
      args.chunkId,
    );
    const chunk = chunkId ? await context.db.get(chunkId) : null;
    if (
      !chunk ||
      chunk.roomId !== args.roomId ||
      chunk.active !== true
    ) {
      return null;
    }
    const material = await context.db.get(chunk.materialId);
    const locator = decodeSourceLocator(chunk.locator);
    if (
      !material ||
      material.roomId !== args.roomId ||
      material.active !== true ||
      !locator
    ) {
      return null;
    }
    return {
      chunkId: String(chunk._id),
      materialId: String(material._id),
      materialName: material.name,
      text: chunk.text.slice(0, 1_200),
      locator,
      untrustedEvidence: true as const,
    };
  },
});

export const vector = actionGeneric({
  args: {
    roomId: v.id("projectRooms"),
    embedding: v.array(v.float64()),
    sessionHash: v.optional(v.string()),
  },
  handler: async (context, args) => {
    if (args.sessionHash) {
      await context.runQuery(getForClientReference, {
        roomId: args.roomId,
        sessionHash: args.sessionHash,
      });
    } else {
      await context.runQuery(getForFreelancerReference, {
        roomId: args.roomId,
      });
    }
    const results = await context.vectorSearch(
      "materialChunks",
      "by_embedding",
      {
        vector: args.embedding,
        limit: 12,
        filter: (query) => query.eq("roomId", args.roomId),
      },
    );
    const chunks = await context.runQuery(chunksByIdsReference, {
      roomId: args.roomId,
      ids: results.map((result) => result._id),
    });
    const scores = new Map(
      results.map((result) => [result._id, result._score]),
    );
    return chunks.map((chunk) => ({
      ...chunk,
      score: scores.get(chunk._id) ?? 0,
    }));
  },
});
