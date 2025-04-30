import * as core from "@actions/core";

async function run() {
  const packageName = core.getInput("packageName");
  const version = core.getInput("version");
  const typedocJson = core.getInput("typedocJson");

  console.log(`Uploading Typedoc JSON for ${packageName} v${version}`);
  console.log(typedocJson);
}

run();
