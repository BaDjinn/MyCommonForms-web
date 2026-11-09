import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("dist");
const manifest = JSON.parse(await readFile(path.join(dist, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.name, "LocalForm");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "/");
assert.ok(Array.isArray(manifest.icons));
for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith("/"), `Icon path must be absolute: ${icon.src}`);
  const file = await stat(path.join(dist, icon.src.slice(1)));
  assert.ok(file.size > 100, `Icon appears empty: ${icon.src}`);
}
const html = await readFile(path.join(dist, "index.html"), "utf8");
assert.match(html, /<title>LocalForm<\/title>/);
assert.ok(!/simplepdf\.com\/simple-pdf\/assets\/meta/.test(html));
for (const file of ["favicon.ico", "icons/favicon-32.png", "icons/localform.svg"]) {
  assert.ok((await stat(path.join(dist, file))).size > 100, `Missing asset: ${file}`);
}
console.log("LocalForm PWA assets verified.");
