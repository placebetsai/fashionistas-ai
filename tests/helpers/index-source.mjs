// index.html plus its externalized app bundle (/assets/app.<hash>.js), so source-wiring tests see the same code as before the split.
import { readFileSync } from "node:fs";
import { join } from "node:path";
export function indexSource(root) {
  const html = readFileSync(join(root, "index.html"), "utf8");
  return html.replace(/<script src="\/(assets\/app\.[0-9a-f]+\.js)" defer><\/script>/g,
    (_, p) => "<script>" + readFileSync(join(root, p), "utf8") + "</script>");
}
