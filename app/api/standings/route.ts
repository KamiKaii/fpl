import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

type StandingRow = {
  position: number;
  team: string;
  played: number;
  points: number;
  gd: number;
  gf: number;
  ga: number;
};

const URL = "https://native-stats.org/competition/PL/";

function normalizeTeamName(name: string) {
  const cleaned = name.replace(/\s+/g, " ").trim();

  const map: Record<string, string> = {
    "Man City": "Manchester City",
    "Man United": "Manchester United",
    "Brighton Hove": "Brighton",
    "Brighton & Hove Albion": "Brighton",
    "Wolverhampton": "Wolves",
    "Wolverhampton Wanderers": "Wolves",
    "Nottingham": "Nottingham Forest",
    "West Ham": "West Ham",
    "Leeds United": "Leeds United",
    "Crystal Palace": "Crystal Palace",
    "Newcastle": "Newcastle United",
    "Aston Villa": "Aston Villa",
    "Liverpool": "Liverpool",
    "Arsenal": "Arsenal",
    "Chelsea": "Chelsea",
    "Tottenham": "Tottenham",
    "Brentford": "Brentford",
    "Everton": "Everton",
    "Fulham": "Fulham",
    "Sunderland": "Sunderland",
    "Bournemouth": "Bournemouth",
    "Burnley": "Burnley",
  };

  return map[cleaned] ?? cleaned;
}

export async function GET() {
  try {
    const res = await fetch(URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch standings page: ${res.status}` },
        { status: 500 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const text = $("body").text().replace(/\s+/g, " ").trim();

    // Matches chunks like:
    // 1. Arsenal ARS 31 70 39 61:22
    const regex =
      /(\d+)\.\s+([A-Za-z&.\- ]+?)\s+[A-Z]{2,3}\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\d+):(\d+)/g;

    const rows: StandingRow[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const position = Number(match[1]);
      const team = normalizeTeamName(match[2]);
      const played = Number(match[3]);
      const points = Number(match[4]);
      const gd = Number(match[5]);
      const gf = Number(match[6]);
      const ga = Number(match[7]);

      if (position >= 1 && position <= 20) {
        rows.push({ position, team, played, points, gd, gf, ga });
      }
    }

    const uniqueRows = rows
      .filter(
        (row, index, arr) =>
          arr.findIndex((r) => r.position === row.position) === index
      )
      .sort((a, b) => a.position - b.position)
      .slice(0, 20);

    if (uniqueRows.length !== 20) {
      return NextResponse.json(
        {
          error: "Could not parse 20 standings rows from Native Stats.",
          parsed: uniqueRows,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: URL,
      updatedAt: new Date().toISOString(),
      standings: uniqueRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected error while fetching standings.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}