import assert from "node:assert/strict";
import test from "node:test";
import { extractImportSpecifiers } from "./imports";

test("extracts default, named, side-effect, and dynamic imports", () => {
  const src = `
import a from 'foo';
import { x } from "bar";
import type { T } from './types';
import 'side-only';
async function d() { await import('dynamic-mod'); }
`;
  const got = extractImportSpecifiers(src);
  assert.deepEqual(new Set(got), new Set(["foo", "bar", "./types", "side-only", "dynamic-mod"]));
});

test("dedupes and sorts specifiers", () => {
  const src = `import x from 'a'; import y from 'a';`;
  assert.deepEqual(extractImportSpecifiers(src), ["a"]);
});

test("login demo file would surface auth-related packages", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(
    __dirname,
    "..",
    "examples",
    "simple-login",
    "loginRoute.ts"
  );
  const source = await fs.readFile(file, "utf8");
  const specifiers = extractImportSpecifiers(source);
  assert.ok(specifiers.includes("@supabase/supabase-js"));
  assert.ok(specifiers.includes("bcrypt"));
  assert.ok(specifiers.includes("zod"));
});
