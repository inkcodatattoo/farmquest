import { existsSync } from "node:fs";
const required=["apps/web","apps/api","apps/worker","apps/twitch-bot","packages/domain","packages/game-rules","packages/contracts","packages/database","packages/config","packages/logger","packages/testing","infra","docs"];
const missing=required.filter((p)=>!existsSync(p));
if(missing.length){console.error("Missing:",missing.join(", "));process.exit(1);}
console.log("FarmQuest prototype 0.1 foundation structure: OK");
