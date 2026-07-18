import { v } from "convex/values";

export const sourceLocatorValidator = v.union(
  v.object({
    kind: v.literal("page"),
    label: v.string(),
    page: v.number(),
  }),
  v.object({
    kind: v.literal("slide"),
    label: v.string(),
    slide: v.number(),
  }),
  v.object({
    kind: v.literal("sheet"),
    label: v.string(),
    sheet: v.string(),
    range: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("image"),
    label: v.string(),
    image: v.number(),
  }),
  v.object({
    kind: v.literal("paragraph"),
    label: v.string(),
    paragraph: v.optional(v.number()),
  }),
  v.object({
    kind: v.literal("text_range"),
    label: v.string(),
    start: v.number(),
    end: v.number(),
  }),
);

export const evidenceReferenceValidator = v.union(
  v.object({
    type: v.literal("material"),
    materialId: v.string(),
    locator: sourceLocatorValidator,
  }),
  v.object({
    type: v.literal("turn"),
    turnId: v.string(),
  }),
  v.object({
    type: v.literal("correction"),
    correctionId: v.string(),
  }),
  v.object({
    type: v.literal("analysis_feedback"),
    feedbackId: v.string(),
  }),
  v.object({
    type: v.literal("model_inference"),
    description: v.string(),
  }),
);

export const briefSourceValidator = v.union(
  evidenceReferenceValidator,
  v.object({ type: v.literal("project_description") }),
  v.object({
    type: v.literal("freelancer_edit"),
    editId: v.string(),
    description: v.string(),
  }),
);
