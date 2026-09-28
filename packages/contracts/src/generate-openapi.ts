import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generatePrototype01OpenApi } from "./openapi.js";

const destination = resolve(
  process.cwd(),
  "../../docs/openapi/farmquest-0.1.json"
);

await mkdir(resolve(destination, ".."), { recursive: true });

const document = generatePrototype01OpenApi();
await writeFile(destination, `${JSON.stringify(document, null, 2)}\n`, "utf8");

console.log(`OpenAPI generated: ${destination}`);
