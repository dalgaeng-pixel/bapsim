import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const startUrl = code ? `/client/${code}` : "/";

  const manifest = {
    name: "밥심",
    short_name: "밥심",
    description: "매일 먹는 맛있는 식사, 밥심",
    start_url: startUrl,
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

  return NextResponse.json(manifest);
}
