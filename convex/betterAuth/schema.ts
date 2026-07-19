import { defineSchema } from "convex/server";
import { tables } from "./generatedSchema";

const schema = defineSchema({
  ...tables,
  passkey: tables.passkey.index(
    "credentialID",
    ["credentialID"],
  ),
});

export default schema;
