import { NextResponse } from "next/server";

type BingImage = {
  startdate?: string;
  url?: string;
  urlbase?: string;
  copyright?: string;
  title?: string;
};

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idxRaw = Number(searchParams.get("idx") || "0");
  const idx = Number.isFinite(idxRaw)
    ? Math.max(0, Math.min(7, Math.floor(idxRaw)))
    : 0;
  const fresh = searchParams.get("fresh") === "1";

  try {
    const bingUrl = new URL("https://www.bing.com/HPImageArchive.aspx");
    bingUrl.searchParams.set("format", "js");
    bingUrl.searchParams.set("idx", String(idx));
    bingUrl.searchParams.set("n", "1");
    bingUrl.searchParams.set("mkt", "en-US");

    const res = await fetch(bingUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Flowdesk/1.0; +https://flowdesk.app)",
        Accept: "application/json,text/plain,*/*",
      },
      // Live wallpaper must not sit on a stale edge cache
      cache: fresh ? "no-store" : "force-cache",
      next: fresh ? undefined : { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Bing wallpaper unavailable", status: res.status },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { images?: BingImage[] };
    const image = data.images?.[0];
    if (!image?.url && !image?.urlbase) {
      return NextResponse.json({ error: "No wallpaper found" }, { status: 404 });
    }

    const path = image.url?.startsWith("http")
      ? image.url
      : image.url
        ? `https://www.bing.com${image.url}`
        : null;

    const url =
      (path && path.includes("1920x1080") && path) ||
      (image.urlbase
        ? `https://www.bing.com${image.urlbase}_1920x1080.jpg`
        : path);

    if (!url) {
      return NextResponse.json({ error: "No wallpaper URL" }, { status: 404 });
    }

    return NextResponse.json(
      {
        url,
        title: image.title || "Bing wallpaper",
        copyright: image.copyright || "",
        startDate: image.startdate || "",
        idx,
      },
      {
        headers: {
          "Cache-Control": fresh
            ? "no-store"
            : "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Wallpaper fetch failed" },
      { status: 500 }
    );
  }
}
