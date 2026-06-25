import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "밥심 식사배달관리",
    short_name: "밥심배달",
    description: "거래처 식수 변경과 배달 준비를 관리하는 밥심 운영 앱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fff7e6",
    theme_color: "#c8191f",
    icons: [
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/bapsim-logo.png",
        sizes: "1056x393",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
