import { PROTOTYPE_01_FIXTURES } from "./fixtures/prototype-0.1.js";

console.log("FarmQuest Prototype 0.1 fixture manifest loaded.");
console.log({
  prototype: PROTOTYPE_01_FIXTURES.meta.prototype,
  starterSeed: PROTOTYPE_01_FIXTURES.farm.starterSeedKey.value,
  workerEnabled: PROTOTYPE_01_FIXTURES.services.worker,
  twitchBotEnabled: PROTOTYPE_01_FIXTURES.services.twitchBot
});
