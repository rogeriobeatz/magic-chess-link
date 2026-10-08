import fs from "node:fs";
const path = "src/routes/jogo.$id.tsx";
const source = fs.readFileSync(path, "utf8");
const start = source.indexOf('  return (\n    <main className="game-shell');
if (start < 0) throw new Error("Missing arena markup boundary");
fs.writeFileSync(path, source.slice(0, start) + fs.readFileSync(".tmp/arena-markup.txt", "utf8"));
