import fs from "node:fs";
const path = "src/routes/jogo.$id.tsx";
let source = fs.readFileSync(path, "utf8");
const start = source.indexOf('<nav className="arena-tools"');
const end = source.indexOf("</nav>", start);
if (start < 0 || end < 0) throw new Error("Missing toolbar");
const tools = source.slice(start, end).replaceAll("<Button", '<button type="button"').replaceAll("</Button>", "</button>").replace(/^\s*(?:variant="arena"|size="icon")\r?\n/gm, "");
source = source.slice(0, start) + tools + source.slice(end);
fs.writeFileSync(path, source);
