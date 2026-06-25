import { cpSync, existsSync, rmSync } from "node:fs";

if (existsSync("dist")) {
  rmSync("dist", { recursive: true, force: true });
}

if (!existsSync("out")) {
  throw new Error("Next static export output directory 'out' was not created.");
}

cpSync("out", "dist", { recursive: true });
