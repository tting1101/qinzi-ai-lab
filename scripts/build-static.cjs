"use strict";
const fs = require("node:fs");
const path = require("node:path");

// Publish only browser assets. Never copy account files, local config or source.
const root = path.join(__dirname, "..");
const output = path.join(root, "dist");
const files = ["index.html", "styles.css", "script.js", "topics.js",
  "images/weekend.webp", "images/inventor.webp", "images/monster.webp"];
if (fs.existsSync(output)) {
  // Refuse unknown content instead of recursively deleting an existing directory.
  const allowed = new Set([...files, "images"]);
  for (const entry of fs.readdirSync(output, { recursive: true })) {
    if (!allowed.has(entry.replaceAll(path.sep, "/"))) throw new Error("Unexpected static output; inspect before building.");
  }
}
fs.mkdirSync(path.join(output, "images"), { recursive: true });
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(output, file));
console.log(`Static publish assets: ${files.length}; account/config/source files: excluded.`);
