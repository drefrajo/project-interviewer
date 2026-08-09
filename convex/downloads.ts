"use node";

import JSZip from "jszip";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internalRefs } from "./internal_refs";

export const cleanup = internalAction({
  args: { archiveId: v.id("exportArchives") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const archive = await ctx.runQuery(internalRefs.downloadsData.getArchive, {
      archiveId: args.archiveId,
    });
    if (!archive) return null;
    await ctx.storage.delete(archive.storageId);
    await ctx.runMutation(internalRefs.downloadsData.removeArchive, {
      archiveId: args.archiveId,
    });
    return null;
  },
});

export const getManifest = action({
  args: { interviewId: v.id("interviews") },
  returns: v.object({ url: v.string(), filename: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated.");
    const manifest = await ctx.runQuery(internalRefs.downloadsData.get, {
      interviewId: args.interviewId,
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!manifest) throw new Error("Interview not found.");

    const zip = new JSZip();
    zip.file("interview.json", manifest.interviewJson);
    zip.file("interview-transcript.md", manifest.transcriptMarkdown);
    zip.file("interview-transcript.json", manifest.transcriptJson);
    if (manifest.projectDocument) {
      zip.file("project-document.md", manifest.projectDocument);
    }
    if (manifest.visualDirectionJson) {
      zip.file("visual-direction.json", manifest.visualDirectionJson);
    }
    for (const concept of manifest.concepts) {
      zip.file(
        `${concept.id}.md`,
        `# ${concept.name}\n\n${concept.rationale}\n`,
      );
      if (concept.imageId) {
        const image = await ctx.storage.get(concept.imageId);
        if (image) zip.file(`${concept.id}.png`, await image.arrayBuffer());
      }
    }
    const archive = await zip.generateAsync({ type: "uint8array" });
    const storageId = await ctx.storage.store(
      new Blob([archive], { type: "application/zip" }),
    );
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const archiveId = await ctx.runMutation(
      internalRefs.downloadsData.registerArchive,
      {
        interviewId: args.interviewId,
        tokenIdentifier: identity.tokenIdentifier,
        storageId,
        expiresAt,
      },
    );
    if (!archiveId) {
      await ctx.storage.delete(storageId);
      throw new Error("Interview was deleted while its export was generated.");
    }
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      await ctx.storage.delete(storageId);
      await ctx.runMutation(internalRefs.downloadsData.removeArchive, {
        archiveId,
      });
      throw new Error("Could not create Interview export.");
    }
    await ctx.scheduler.runAfter(15 * 60 * 1000, internalRefs.downloads.cleanup, {
      archiveId,
    });
    return {
      url,
      filename: `${manifest.projectName.replace(/[^a-z0-9_-]+/gi, "-")}.zip`,
    };
  },
});
