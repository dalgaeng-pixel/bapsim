import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "밥심",
    short_name: "밥심",
    description: "매일 먹는 맛있는 식사, 밥심",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fff7e6",
    theme_color: "#c8191f",
    icons: [
      {
        src: "/bapsim-logo.png",
        sizes: "1056x393",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
