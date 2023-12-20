import { getTraits } from "../utils/openSea.js";

const TEST_SLUG = "myhomiesindreamland";

async function main() {
  const traits = await getTraits(TEST_SLUG);
  console.log(traits);
}

main();