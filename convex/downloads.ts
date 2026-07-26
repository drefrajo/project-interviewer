"use node";

import JSZip from "jszip";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internalRefs } from "./internal_refs";

export const cleanup = internalAction({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
    return null;
  },
});

export const getManifest = action({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated.");
    const manifest = await ctx.runQuery(internalRefs.downloadsData.get, {
      interviewId: args.interviewId,
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!manifest) throw new Error("Project Submission not found.");

    const zip = new JSZip();
    zip.file("project-document.md", manifest.projectDocument);
    zip.file(
      "visual-direction.json",
      JSON.stringify(manifest.visualDirection, null, 2),
    );
    zip.file("interview-transcript.md", manifest.transcript);
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
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Could not create Project Submission download.");
    await ctx.scheduler.runAfter(15 * 60 * 1000, internalRefs.downloads.cleanup, {
      storageId,
    });
    return {
      url,
      filename: `${manifest.projectName.replace(/[^a-z0-9_-]+/gi, "-")}.zip`,
    };
  },
});
