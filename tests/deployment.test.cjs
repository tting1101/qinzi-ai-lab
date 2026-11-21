"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.join(__dirname, "..");

test("Vercel static output contains exactly seven unchanged browser assets", () => {
  execFileSync(process.execPath, ["scripts/build-static.cjs"], { cwd: root });
  const files = ["index.html", "styles.css", "script.js", "topics.js",
    "images/weekend.webp", "images/inventor.webp", "images/monster.webp"];
  const actual = fs.readdirSync(path.join(root, "dist"), { recursive: true })
    .map(name => name.replaceAll(path.sep, "/")).filter(name => name !== "images");
  assert.deepEqual(actual.sort(), [...files].sort());
  for (const file of files) {
    const hash = name => createHash("sha256").update(fs.readFileSync(name)).digest("hex");
    assert.equal(hash(path.join(root, "dist", file)), hash(path.join(root, file)));
  }
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  assert.equal(config.outputDirectory, "dist");
  assert.equal(config.buildCommand, "node scripts/build-static.cjs");
});

test("four Vercel endpoints reuse the tested handler without starting a listener", () => {
  const handler = require("../lib/cloud-handler");
  for (const route of ["register", "login", "logout", "me"]) {
    assert.equal(require(`../api/${route}`), handler);
  }
});
