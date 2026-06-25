import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

if (existsSync("dist")) {
  rmSync("dist", { recursive: true, force: true });
}

if (!existsSync("out")) {
  throw new Error("Next static export output directory 'out' was not created.");
}

mkdirSync("dist/client", { recursive: true });
mkdirSync("dist/server", { recursive: true });
cpSync("out", "dist/client", { recursive: true });

writeFileSync(
  "dist/server/index.js",
  `const hasFileExtension = /\\.[a-zA-Z0-9]+$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/state") {
      return Response.json({ configured: false, mode: "local" });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (!hasFileExtension.test(url.pathname)) {
      const htmlUrl = new URL(request.url);
      htmlUrl.pathname = url.pathname.replace(/\\/$/, "") + ".html";
      const htmlResponse = await env.ASSETS.fetch(new Request(htmlUrl, request));
      if (htmlResponse.status !== 404) {
        return htmlResponse;
      }
    }

    const fallbackUrl = new URL(request.url);
    fallbackUrl.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  }
};
`
);
