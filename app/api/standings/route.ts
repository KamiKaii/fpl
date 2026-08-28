import { NextResponse } from "next/server";

type StandingRow = {
  position: number;
  team: string;
  played: number;
  points: number;
  gd: number;
  gf: number;
  ga: number;
  wins: number;
  draws: number;
  losses: number;
  cleanSheets: number;
};

type FootballDataTeam = {
  name: string;
};

type FootballDataStanding = {
  position: number;
  team: FootballDataTeam;
  playedGames: number;
  points: number;
  goalDifference: number;
  goalsFor: number;
  goalsAgainst: number;
};

type FootballDataMatch = {
  status: string;
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
};

type FootballDataStandingsResponse = {
  season: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number | null;
  };
  standings: {
    stage: string;
    type: string;
    table: FootballDataStanding[];
  }[];
};

type FootballDataMatchesResponse = {
  matches: FootballDataMatch[];
};

/*
 * 2026/27 Premier League teams
 *
 * Promoted:
 * - Coventry City
 * - Hull City
 * - Ipswich Town
 *
 * Relegated from 2025/26:
 * - Wolverhampton Wanderers
 * - Burnley
 * - West Ham United
 */
const CURRENT_TEAMS = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
  "Chelsea",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Hull City",
  "Ipswich Town",
  "Leeds United",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle United",
  "Nottingham Forest",
  "Sunderland",
  "Tottenham",
  "Coventry City",
] as const;

const STANDINGS_URL =
  "https://api.football-data.org/v4/competitions/PL/standings";

const MATCHES_URL =
  "https://api.football-data.org/v4/competitions/PL/matches?status=FINISHED";

function normalizeTeamName(name: string): string {
  const map: Record<string, string> = {
    "Arsenal FC": "Arsenal",

    "Aston Villa FC": "Aston Villa",

    "AFC Bournemouth": "Bournemouth",
    "Bournemouth FC": "Bournemouth",

    "Brentford FC": "Brentford",

    "Brighton & Hove Albion FC": "Brighton",
    "Brighton & Hove Albion": "Brighton",

    "Chelsea FC": "Chelsea",

    "Crystal Palace FC": "Crystal Palace",

    "Everton FC": "Everton",

    "Fulham FC": "Fulham",

    "Hull City AFC": "Hull City",
    "Hull City FC": "Hull City",

    "Ipswich Town FC": "Ipswich Town",

    "Leeds United FC": "Leeds United",

    "Liverpool FC": "Liverpool",

    "Manchester City FC": "Manchester City",

    "Manchester United FC": "Manchester United",

    "Newcastle United FC": "Newcastle United",

    "Nottingham Forest FC": "Nottingham Forest",

    "Sunderland AFC": "Sunderland",
    "Sunderland FC": "Sunderland",

    "Tottenham Hotspur FC": "Tottenham",
    "Tottenham Hotspur": "Tottenham",

    "Coventry City FC": "Coventry City",
    "Coventry City": "Coventry City",
  };

  return map[name] ?? name.replace(/ FC$| AFC$/, "").trim();
}

type TeamStats = {
  wins: number;
  draws: number;
  losses: number;
  cleanSheets: number;
};

function createEmptyStats(): TeamStats {
  return {
    wins: 0,
    draws: 0,
    losses: 0,
    cleanSheets: 0,
  };
}

export async function GET() {
  try {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "FOOTBALL_DATA_API_KEY environment variable is not configured.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 1. Get current Premier League standings
    // ---------------------------------------------------------

    const standingsRes = await fetch(STANDINGS_URL, {
      headers: {
        "X-Auth-Token": apiKey,
      },
      cache: "no-store",
    });

    if (!standingsRes.ok) {
      const errorText = await standingsRes.text();

      return NextResponse.json(
        {
          error: `Failed to fetch Premier League standings: ${standingsRes.status}`,
          details: errorText,
        },
        { status: 500 }
      );
    }

    const standingsData: FootballDataStandingsResponse =
      await standingsRes.json();

    const totalStanding = standingsData.standings.find(
      (standing) =>
        standing.stage === "REGULAR_SEASON" &&
        standing.type === "TOTAL"
    );

    if (!totalStanding) {
      return NextResponse.json(
        {
          error:
            "Could not find the overall Premier League standings.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 2. Get all completed Premier League matches
    // ---------------------------------------------------------

    const matchesRes = await fetch(MATCHES_URL, {
      headers: {
        "X-Auth-Token": apiKey,
      },
      cache: "no-store",
    });

    if (!matchesRes.ok) {
      const errorText = await matchesRes.text();

      return NextResponse.json(
        {
          error: `Failed to fetch Premier League matches: ${matchesRes.status}`,
          details: errorText,
        },
        { status: 500 }
      );
    }

    const matchesData: FootballDataMatchesResponse =
      await matchesRes.json();

    // ---------------------------------------------------------
    // 3. Calculate wins / draws / losses / clean sheets
    // ---------------------------------------------------------

    const teamStats: Record<string, TeamStats> = {};

    for (const team of CURRENT_TEAMS) {
      teamStats[team] = createEmptyStats();
    }

    for (const match of matchesData.matches) {
      if (match.status !== "FINISHED") {
        continue;
      }

      const homeTeam = normalizeTeamName(match.homeTeam.name);
      const awayTeam = normalizeTeamName(match.awayTeam.name);

      const homeGoals = match.score.fullTime.home;
      const awayGoals = match.score.fullTime.away;

      // Skip matches without a completed score.
      if (homeGoals === null || awayGoals === null) {
        continue;
      }

      // Ignore unexpected teams.
      if (!teamStats[homeTeam] || !teamStats[awayTeam]) {
        continue;
      }

      // Wins / draws / losses
      if (homeGoals > awayGoals) {
        teamStats[homeTeam].wins++;
        teamStats[awayTeam].losses++;
      } else if (homeGoals < awayGoals) {
        teamStats[awayTeam].wins++;
        teamStats[homeTeam].losses++;
      } else {
        teamStats[homeTeam].draws++;
        teamStats[awayTeam].draws++;
      }

      // Clean sheets
      if (awayGoals === 0) {
        teamStats[homeTeam].cleanSheets++;
      }

      if (homeGoals === 0) {
        teamStats[awayTeam].cleanSheets++;
      }
    }

    // ---------------------------------------------------------
    // 4. Build final standings
    // ---------------------------------------------------------

    const standings: StandingRow[] = totalStanding.table
      .slice(0, 20)
      .map((row) => {
        const team = normalizeTeamName(row.team.name);
        const stats = teamStats[team] ?? createEmptyStats();

        return {
          position: row.position,
          team,
          played: row.playedGames,
          points: row.points,
          gd: row.goalDifference,
          gf: row.goalsFor,
          ga: row.goalsAgainst,
          wins: stats.wins,
          draws: stats.draws,
          losses: stats.losses,
          cleanSheets: stats.cleanSheets,
        };
      });

    if (standings.length !== 20) {
      return NextResponse.json(
        {
          error: "Expected 20 Premier League teams.",
          parsed: standings,
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 5. Calculate all 11 Special Picks
    // ---------------------------------------------------------

    const mostGoals = [...standings].sort(
      (a, b) => b.gf - a.gf
    )[0];

    const fewestGoals = [...standings].sort(
      (a, b) => a.gf - b.gf
    )[0];

    const fewestGoalsConceded = [...standings].sort(
      (a, b) => a.ga - b.ga
    )[0];

    const mostGoalsConceded = [...standings].sort(
      (a, b) => b.ga - a.ga
    )[0];

    const bestGoalDifference = [...standings].sort(
      (a, b) => b.gd - a.gd
    )[0];

    const worstGoalDifference = [...standings].sort(
      (a, b) => a.gd - b.gd
    )[0];

    const closestGoalDifferenceToZero = [...standings].sort(
      (a, b) => Math.abs(a.gd) - Math.abs(b.gd)
    )[0];

    const mostWins = [...standings].sort(
      (a, b) => b.wins - a.wins
    )[0];

    const mostDraws = [...standings].sort(
      (a, b) => b.draws - a.draws
    )[0];

    const mostLosses = [...standings].sort(
      (a, b) => b.losses - a.losses
    )[0];

    const mostCleanSheets = [...standings].sort(
      (a, b) => b.cleanSheets - a.cleanSheets
    )[0];

    const specialPicks = {
      mostGoals: {
        team: mostGoals.team,
        value: mostGoals.gf,
      },

      fewestGoals: {
        team: fewestGoals.team,
        value: fewestGoals.gf,
      },

      fewestGoalsConceded: {
        team: fewestGoalsConceded.team,
        value: fewestGoalsConceded.ga,
      },

      mostGoalsConceded: {
        team: mostGoalsConceded.team,
        value: mostGoalsConceded.ga,
      },

      bestGoalDifference: {
        team: bestGoalDifference.team,
        value: bestGoalDifference.gd,
      },

      worstGoalDifference: {
        team: worstGoalDifference.team,
        value: worstGoalDifference.gd,
      },

      closestGoalDifferenceToZero: {
        team: closestGoalDifferenceToZero.team,
        value: closestGoalDifferenceToZero.gd,
      },

      mostWins: {
        team: mostWins.team,
        value: mostWins.wins,
      },

      mostDraws: {
        team: mostDraws.team,
        value: mostDraws.draws,
      },

      mostLosses: {
        team: mostLosses.team,
        value: mostLosses.losses,
      },

      mostCleanSheets: {
        team: mostCleanSheets.team,
        value: mostCleanSheets.cleanSheets,
      },
    };

    // ---------------------------------------------------------
    // 6. Return everything to page.tsx
    // ---------------------------------------------------------

    return NextResponse.json({
      source: "football-data.org",
      season: standingsData.season,
      updatedAt: new Date().toISOString(),
      standings,
      specialPicks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Unexpected error while fetching Premier League data.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}