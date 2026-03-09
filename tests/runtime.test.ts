import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import { loadCompanyConfig, validateCompanyConfig } from "../src/config.js";

const root = resolve(import.meta.dirname, "..");

test("repository company config validates", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const result = validateCompanyConfig(config, root);
  assert.deepEqual(result.errors, []);
});

test("company config exposes the expected runtime metadata", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  assert.equal((config.company as { name: string }).name, "Comphony");
  assert.equal((config.runtime as { mode: string }).mode, "local_first");
  assert.equal((config.projects as unknown[]).length, 1);
  assert.equal((config.agents as unknown[]).length, 2);
});
