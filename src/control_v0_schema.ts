import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { CONTROL_V0_SCHEMA_ID } from "./control_v0.js";

type ValidationResult = {
  ok: boolean;
  errors: any[] | null | undefined;
};

async function loadControlSchema() {
  const schemaPath = fileURLToPath(new URL("../schemas/mova.control_v0.schema.json", import.meta.url));
  const raw = await fs.readFile(schemaPath, "utf8");
  return JSON.parse(raw);
}

export async function validateControlV0Schema(control: any): Promise<ValidationResult> {
  const schema = await loadControlSchema();
  const ajv = new (Ajv as any)({ allErrors: true, strict: true, validateSchema: false });
  (addFormats as any)(ajv);
  ajv.addSchema(schema, CONTROL_V0_SCHEMA_ID);
  const validate = ajv.compile(schema);
  const ok = Boolean(validate(control));
  return { ok, errors: validate.errors };
}
