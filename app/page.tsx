"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../lib/supabaseClient";

type ApiStandingRow = {
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

type TeamRow = {
  team: string;
  played: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;
};

type SpecialPick = {
  team: string;
  value: number;
};

type SpecialPicks = {
  mostGoals: SpecialPick;
  fewestGoals: SpecialPick;
  fewestGoalsConceded: SpecialPick;
  mostGoalsConceded: SpecialPick;
  bestGoalDifference: SpecialPick;
  worstGoalDifference: SpecialPick;
  closestGoalDifferenceToZero: SpecialPick;
  mostWins: SpecialPick;
  mostDraws: SpecialPick;
  mostLosses: SpecialPick;
  mostCleanSheets: SpecialPick;
};

type Picks = {
  top5: string[];
  bottom5: string[];
  wildcardTeam: string;
  wildcardPosition: string;
  zeroGoalDiff: string;
  mostDraws: string;
  mostGoals: string;
  fewestGoals: string;
  fewestGoalsConceded: string;
  mostGoalsConceded: string;
  bestGoalDifference: string;
  worstGoalDifference: string;
  mostWins: string;
  mostLosses: string;
  mostCleanSheets: string;
};

type Participant = {
  id: string;
  username: string;
  picks: Picks;
};

type ScoreBadge = {
  label: string;
  title: string;
  variant: "top5" | "bottom5" | "wildcard" | "special";
};

type ScoredParticipant = Participant & {
  score: number;
  badges: ScoreBadge[];
};

type ParticipantRow = {
  id: string;
  username: string;

  top5: string[];
  bottom5: string[];

  wildcard_team: string;
  wildcard_position: number;

  zero_goal_diff: string;
  most_draws: string;
  most_goals: string;
  fewest_goals: string;
  fewest_goals_conceded: string;
  most_goals_conceded: string;
  best_goal_difference: string;
  worst_goal_difference: string;
  most_wins: string;
  most_losses: string;
  most_clean_sheets: string;

  created_at: string;
};

const TEAM_NAMES = [
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

const TEAM_NAME_MAP: Record<string, string> = {
  Arsenal: "Arsenal",
  "Aston Villa": "Aston Villa",
  Bournemouth: "Bournemouth",
  "AFC Bournemouth": "Bournemouth",

  Brentford: "Brentford",

  Brighton: "Brighton",
  "Brighton & Hove Albion": "Brighton",

  Chelsea: "Chelsea",

  "Crystal Palace": "Crystal Palace",

  Everton: "Everton",

  Fulham: "Fulham",

  "Hull City": "Hull City",
  "Hull City AFC": "Hull City",

  "Ipswich Town": "Ipswich Town",

  "Leeds United": "Leeds United",

  Liverpool: "Liverpool",

  "Manchester City": "Manchester City",

  "Manchester United": "Manchester United",

  "Newcastle United": "Newcastle United",

  "Nottingham Forest": "Nottingham Forest",

  Sunderland: "Sunderland",

  Tottenham: "Tottenham",
  "Tottenham Hotspur": "Tottenham",

  "Coventry City": "Coventry City",
};

const K9_KEY = "fpl-admin-k1n9k4i";

const RULES = [
  {
    title: "Top 5 & Bottom 5 Predictions",
    items: [
      "Correct exact position — 3 points",
      "Correct area only (team finishes in top 5 or bottom 5, but not the exact spot) — 1 point",
    ],
  },
  {
    title: "Mystery Pick",
    items: [
      "1 team predicted to finish 6th–15th, with exact spot — 5 points",
    ],
  },
  {
    title: "Special Picks",
    items: [
      "Most goals — 3 points",
      "Fewest goals — 3 points",
      "Fewest goals conceded — 3 points",
      "Most goals conceded — 3 points",
      "Best goal difference — 3 points",
      "Worst goal difference — 3 points",
      "Goal difference closest to 0 — 3 points",
      "Most wins — 3 points",
      "Most draws — 3 points",
      "Most losses — 3 points",
      "Most clean sheets — 3 points",
    ],
  },
  {
    title: "Scoring Example",
    items: [
      "Predict Arsenal 2nd — Arsenal finish 2nd = 3 points",
      "Predict Arsenal 2nd — Arsenal finish 4th (still top 5) = 1 point",
      "Mystery Pick Tottenham 10th — Tottenham finish 10th = 5 points",
    ],
  },
];

function normalizeTeamName(team: string) {
  return TEAM_NAME_MAP[team] ?? team;
}

function ordinal(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) {
    return `${n}th`;
  }

  if (n % 10 === 1) {
    return `${n}st`;
  }

  if (n % 10 === 2) {
    return `${n}nd`;
  }

  if (n % 10 === 3) {
    return `${n}rd`;
  }

  return `${n}th`;
}

function formatRankList(items: string[], start: number) {
  return items
    .map((item, index) => `${start + index}. ${item}`)
    .join("\n");
}

function scoreParticipant(
  participant: Participant,
  table: Array<TeamRow & { position: number }>,
  specialPicks: SpecialPicks | null
): ScoredParticipant {
  let score = 0;
  const badges: ScoreBadge[] = [];

  const positionMap = Object.fromEntries(
    table.map((row) => [row.team, row.position])
  );

  // ---------------------------------------------------------
  // Top 5
  // ---------------------------------------------------------

  let top5Points = 0;

  participant.picks.top5.forEach((team, index) => {
    const pickedPosition = index + 1;
    const currentPosition = positionMap[team];

    if (currentPosition === pickedPosition) {
      score += 3;
      top5Points += 3;
    } else if (
      currentPosition >= 1 &&
      currentPosition <= 5
    ) {
      score += 1;
      top5Points += 1;
    }
  });

  if (top5Points > 0) {
    const top5Hits = participant.picks.top5.filter(
      (team, index) => {
        const pickedPosition = index + 1;
        const currentPosition = positionMap[team];

        return (
          currentPosition === pickedPosition ||
          (currentPosition >= 1 && currentPosition <= 5)
        );
      }
    ).length;

    badges.push({
      label: `${top5Hits}x Top Five (${top5Points} points)`,
      title: `Top 5 picks: ${top5Points} pts across ${top5Hits} hit${
        top5Hits === 1 ? "" : "s"
      }`,
      variant: "top5",
    });
  }

  // ---------------------------------------------------------
  // Bottom 5
  // ---------------------------------------------------------

  let bottom5Points = 0;

  participant.picks.bottom5.forEach((team, index) => {
    const pickedPosition = index + 16;
    const currentPosition = positionMap[team];

    if (currentPosition === pickedPosition) {
      score += 3;
      bottom5Points += 3;
    } else if (
      currentPosition >= 16 &&
      currentPosition <= 20
    ) {
      score += 1;
      bottom5Points += 1;
    }
  });

  if (bottom5Points > 0) {
    const bottom5Hits = participant.picks.bottom5.filter(
      (team, index) => {
        const pickedPosition = index + 16;
        const currentPosition = positionMap[team];

        return (
          currentPosition === pickedPosition ||
          (currentPosition >= 16 && currentPosition <= 20)
        );
      }
    ).length;

    badges.push({
      label: `${bottom5Hits}x Bottom Five (${bottom5Points} points)`,
      title: `Bottom 5 picks: ${bottom5Points} pts across ${bottom5Hits} hit${
        bottom5Hits === 1 ? "" : "s"
      }`,
      variant: "bottom5",
    });
  }

  // ---------------------------------------------------------
  // Mystery / Wildcard
  // ---------------------------------------------------------

  if (
    positionMap[participant.picks.wildcardTeam] ===
    Number(participant.picks.wildcardPosition)
  ) {
    score += 5;

    badges.push({
      label: "Wildcard",
      title: "Wildcard exact hit: 5 pts",
      variant: "wildcard",
    });
  }

  // ---------------------------------------------------------
  // All 11 Special Picks
  // ---------------------------------------------------------

  if (specialPicks) {
    const specialCategories: Array<{
      pick: string;
      leader: string;
      label: string;
    }> = [
      {
        pick: participant.picks.mostGoals,
        leader: specialPicks.mostGoals.team,
        label: "Most Goals",
      },
      {
        pick: participant.picks.fewestGoals,
        leader: specialPicks.fewestGoals.team,
        label: "Fewest Goals",
      },
      {
        pick: participant.picks.fewestGoalsConceded,
        leader: specialPicks.fewestGoalsConceded.team,
        label: "Fewest GA",
      },
      {
        pick: participant.picks.mostGoalsConceded,
        leader: specialPicks.mostGoalsConceded.team,
        label: "Most GA",
      },
      {
        pick: participant.picks.bestGoalDifference,
        leader: specialPicks.bestGoalDifference.team,
        label: "Best GD",
      },
      {
        pick: participant.picks.worstGoalDifference,
        leader: specialPicks.worstGoalDifference.team,
        label: "Worst GD",
      },
      {
        pick: participant.picks.zeroGoalDiff,
        leader: specialPicks.closestGoalDifferenceToZero.team,
        label: "Closest to 0 GD",
      },
      {
        pick: participant.picks.mostWins,
        leader: specialPicks.mostWins.team,
        label: "Most Wins",
      },
      {
        pick: participant.picks.mostDraws,
        leader: specialPicks.mostDraws.team,
        label: "Most Draws",
      },
      {
        pick: participant.picks.mostLosses,
        leader: specialPicks.mostLosses.team,
        label: "Most Losses",
      },
      {
        pick: participant.picks.mostCleanSheets,
        leader: specialPicks.mostCleanSheets.team,
        label: "Most Clean Sheets",
      },
    ];

    let specialPoints = 0;

    specialCategories.forEach((category) => {
      if (
        category.pick &&
        category.pick === category.leader
      ) {
        score += 3;
        specialPoints += 3;
      }
    });

    if (specialPoints > 0) {
      badges.push({
        label: `Special Picks (${specialPoints} points)`,
        title: `Special Picks: ${specialPoints} pts`,
        variant: "special",
      });
    }
  }

  return {
    ...participant,
    score,
    badges,
  };
}

function toEditableRows(
  standings: ApiStandingRow[]
): TeamRow[] {
  return standings.map((row) => ({
    team: normalizeTeamName(row.team),
    played: row.played,
    points: row.points,
    gf: row.gf,
    ga: row.ga,
    gd: row.gd,
  }));
}

function dbRowToParticipant(
  row: ParticipantRow
): Participant {
  return {
    id: row.id,
    username: row.username,

    picks: {
      top5: row.top5,
      bottom5: row.bottom5,

      wildcardTeam: row.wildcard_team,
      wildcardPosition: String(row.wildcard_position),

      zeroGoalDiff: row.zero_goal_diff,
      mostDraws: row.most_draws,
      mostGoals: row.most_goals,
      fewestGoals: row.fewest_goals,
      fewestGoalsConceded: row.fewest_goals_conceded,
      mostGoalsConceded: row.most_goals_conceded,
      bestGoalDifference: row.best_goal_difference,
      worstGoalDifference: row.worst_goal_difference,
      mostWins: row.most_wins,
      mostLosses: row.most_losses,
      mostCleanSheets: row.most_clean_sheets,
    },
  };
}

const EMPTY_ENTRY: Picks & { username: string } = {
  username: "",

  top5: ["", "", "", "", ""],
  bottom5: ["", "", "", "", ""],

  wildcardTeam: "",
  wildcardPosition: "",

  zeroGoalDiff: "",
  mostDraws: "",
  mostGoals: "",
  fewestGoals: "",
  fewestGoalsConceded: "",
  mostGoalsConceded: "",
  bestGoalDifference: "",
  worstGoalDifference: "",
  mostWins: "",
  mostLosses: "",
  mostCleanSheets: "",
};

export default function Page() {
  const [leagueTable, setLeagueTable] =
    useState<TeamRow[]>([]);

  const [specialPicks, setSpecialPicks] =
    useState<SpecialPicks | null>(null);

  const [participants, setParticipants] =
    useState<Participant[]>([]);

  const [loadingTable, setLoadingTable] =
    useState(true);

  const [loadingParticipants, setLoadingParticipants] =
    useState(true);

  const [tableError, setTableError] =
    useState<string | null>(null);

  const [participantError, setParticipantError] =
    useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "standings" | "form" | "rules"
  >("standings");

  const [editingPlayerId, setEditingPlayerId] =
    useState<string | null>(null);

  const [entry, setEntry] = useState<
    Picks & { username: string }
  >(EMPTY_ENTRY);

  // ---------------------------------------------------------
  // Load participants from Supabase
  // ---------------------------------------------------------

  useEffect(() => {
    async function loadParticipants() {
      setLoadingParticipants(true);
      setParticipantError(null);

      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        setParticipantError(error.message);
        setLoadingParticipants(false);
        return;
      }

      setParticipants(
        ((data ?? []) as ParticipantRow[]).map(
          dbRowToParticipant
        )
      );

      setLoadingParticipants(false);
    }

    loadParticipants();
  }, []);

  // ---------------------------------------------------------
  // Load live Premier League data
  // ---------------------------------------------------------

  useEffect(() => {
    async function loadStandings() {
      try {
        setLoadingTable(true);
        setTableError(null);

        const res = await fetch("/api/standings", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.error || "Failed to load standings"
          );
        }

        setLeagueTable(
          toEditableRows(data.standings)
        );

        setSpecialPicks(
          data.specialPicks ?? null
        );
      } catch (err) {
        setTableError(
          err instanceof Error
            ? err.message
            : "Unknown error"
        );
      } finally {
        setLoadingTable(false);
      }
    }

    loadStandings();
  }, []);

  // ---------------------------------------------------------
  // Sort league table
  // ---------------------------------------------------------

  const displayTable = useMemo(() => {
    return [...leagueTable]
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        if (b.gd !== a.gd) {
          return b.gd - a.gd;
        }

        if (b.gf !== a.gf) {
          return b.gf - a.gf;
        }

        return a.team.localeCompare(b.team);
      })
      .map((row, index) => ({
        ...row,
        position: index + 1,
      }));
  }, [leagueTable]);

  // ---------------------------------------------------------
  // Fantasy leaderboard
  // ---------------------------------------------------------

  const leaderboard = useMemo(() => {
    return participants
      .map((participant) =>
        scoreParticipant(
          participant,
          displayTable,
          specialPicks
        )
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.username.localeCompare(b.username)
      );
  }, [
    participants,
    displayTable,
    specialPicks,
  ]);

  function resetForm() {
    setEditingPlayerId(null);
    setEntry({
      ...EMPTY_ENTRY,
      top5: [...EMPTY_ENTRY.top5],
      bottom5: [...EMPTY_ENTRY.bottom5],
    });
  }

  // ---------------------------------------------------------
  // Add / Edit participant
  // ---------------------------------------------------------

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!entry.username.trim()) {
      alert("Please enter a username.");
      return;
    }

    if (
      entry.top5.some((pick) => !pick) ||
      entry.bottom5.some((pick) => !pick)
    ) {
      alert(
        "Please complete all top 5 and bottom 5 picks."
      );
      return;
    }

    const specialPickValues = [
      entry.zeroGoalDiff,
      entry.mostDraws,
      entry.mostGoals,
      entry.fewestGoals,
      entry.fewestGoalsConceded,
      entry.mostGoalsConceded,
      entry.bestGoalDifference,
      entry.worstGoalDifference,
      entry.mostWins,
      entry.mostLosses,
      entry.mostCleanSheets,
    ];

    if (
      !entry.wildcardTeam ||
      !entry.wildcardPosition ||
      specialPickValues.some((pick) => !pick)
    ) {
      alert(
        "Please complete all special picks."
      );
      return;
    }

    // Top 5 unique
    if (
      new Set(entry.top5).size !==
      entry.top5.length
    ) {
      alert(
        "Top 5 picks must all be different teams."
      );
      return;
    }

    // Bottom 5 unique
    if (
      new Set(entry.bottom5).size !==
      entry.bottom5.length
    ) {
      alert(
        "Bottom 5 picks must all be different teams."
      );
      return;
    }

    // Top 5 and Bottom 5 cannot overlap
    const placementTeams = [
      ...entry.top5,
      ...entry.bottom5,
    ];

    if (
      new Set(placementTeams).size !==
      placementTeams.length
    ) {
      alert(
        "Top 5 and Bottom 5 picks cannot contain the same team twice."
      );
      return;
    }

    // Wildcard cannot overlap Top 5 / Bottom 5
    if (
      placementTeams.includes(
        entry.wildcardTeam
      )
    ) {
      alert(
        "Wildcard team must be different from your Top 5 and Bottom 5 picks."
      );
      return;
    }

    // Mystery Pick must be 6th–15th
    const wildcardPosition = Number(
      entry.wildcardPosition
    );

    if (
      wildcardPosition < 6 ||
      wildcardPosition > 15
    ) {
      alert(
        "Mystery Pick position must be between 6th and 15th."
      );
      return;
    }

    const payload = {
      username: entry.username.trim(),

      top5: entry.top5,
      bottom5: entry.bottom5,

      wildcard_team: entry.wildcardTeam,
      wildcard_position: wildcardPosition,

      zero_goal_diff: entry.zeroGoalDiff,
      most_draws: entry.mostDraws,
      most_goals: entry.mostGoals,
      fewest_goals: entry.fewestGoals,
      fewest_goals_conceded:
        entry.fewestGoalsConceded,
      most_goals_conceded:
        entry.mostGoalsConceded,
      best_goal_difference:
        entry.bestGoalDifference,
      worst_goal_difference:
        entry.worstGoalDifference,
      most_wins: entry.mostWins,
      most_losses: entry.mostLosses,
      most_clean_sheets:
        entry.mostCleanSheets,
    };

    if (editingPlayerId) {
      const { data, error } = await supabase
        .from("participants")
        .update(payload)
        .eq("id", editingPlayerId)
        .select()
        .single();

      if (error) {
        alert(
          `Failed to update player: ${error.message}`
        );
        return;
      }

      setParticipants((current) =>
        current.map((player) =>
          player.id === editingPlayerId
            ? dbRowToParticipant(
                data as ParticipantRow
              )
            : player
        )
      );
    } else {
      const { data, error } = await supabase
        .from("participants")
        .insert(payload)
        .select()
        .single();

      if (error) {
        alert(
          `Failed to add player: ${error.message}`
        );
        return;
      }

      setParticipants((current) => [
        ...current,
        dbRowToParticipant(
          data as ParticipantRow
        ),
      ]);
    }

    resetForm();
    setActiveTab("standings");
  }

  // ---------------------------------------------------------
  // Delete participant
  // ---------------------------------------------------------

  async function handleDeletePlayer(id: string) {
    const enteredPassword = window.prompt(
      "Enter admin password to delete this player:"
    );

    if (enteredPassword !== K9_KEY) {
      window.alert("Incorrect password.");
      return;
    }

    const { error } = await supabase
      .from("participants")
      .delete()
      .eq("id", id);

    if (error) {
      window.alert(
        `Failed to delete player: ${error.message}`
      );
      return;
    }

    setParticipants((current) =>
      current.filter(
        (player) => player.id !== id
      )
    );
  }

  // ---------------------------------------------------------
  // Edit participant
  // ---------------------------------------------------------

  function handleEditPlayer(
    player: Participant
  ) {
    const enteredPassword = window.prompt(
      "Enter admin password to edit this player:"
    );

    if (enteredPassword !== K9_KEY) {
      window.alert("Incorrect password.");
      return;
    }

    setEditingPlayerId(player.id);

    setEntry({
      username: player.username,

      top5: [...player.picks.top5],
      bottom5: [...player.picks.bottom5],

      wildcardTeam:
        player.picks.wildcardTeam,

      wildcardPosition:
        player.picks.wildcardPosition,

      zeroGoalDiff:
        player.picks.zeroGoalDiff,

      mostDraws:
        player.picks.mostDraws,

      mostGoals:
        player.picks.mostGoals,

      fewestGoals:
        player.picks.fewestGoals,

      fewestGoalsConceded:
        player.picks.fewestGoalsConceded,

      mostGoalsConceded:
        player.picks.mostGoalsConceded,

      bestGoalDifference:
        player.picks.bestGoalDifference,

      worstGoalDifference:
        player.picks.worstGoalDifference,

      mostWins:
        player.picks.mostWins,

      mostLosses:
        player.picks.mostLosses,

      mostCleanSheets:
        player.picks.mostCleanSheets,
    });

    setActiveTab("form");
  }

  // ---------------------------------------------------------
  // Special Pick display rows
  // ---------------------------------------------------------

  const specialPickRows = specialPicks
    ? [
        [
          "Most Goals",
          specialPicks.mostGoals,
        ],
        [
          "Fewest Goals",
          specialPicks.fewestGoals,
        ],
        [
          "Fewest Goals Conceded",
          specialPicks.fewestGoalsConceded,
        ],
        [
          "Most Goals Conceded",
          specialPicks.mostGoalsConceded,
        ],
        [
          "Best Goal Difference",
          specialPicks.bestGoalDifference,
        ],
        [
          "Worst Goal Difference",
          specialPicks.worstGoalDifference,
        ],
        [
          "Closest to 0 Goal Difference",
          specialPicks.closestGoalDifferenceToZero,
        ],
        [
          "Most Wins",
          specialPicks.mostWins,
        ],
        [
          "Most Draws",
          specialPicks.mostDraws,
        ],
        [
          "Most Losses",
          specialPicks.mostLosses,
        ],
        [
          "Most Clean Sheets",
          specialPicks.mostCleanSheets,
        ],
      ] as [string, SpecialPick][]
    : [];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Header */}

        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            Fantasy Premier League
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            Fantasy Premier League
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Live standings and statistics are
            updated automatically.
          </p>
        </div>

        {/* Navigation */}

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() =>
              setActiveTab("standings")
            }
            className={`rounded-2xl px-4 py-2 font-medium ${
              activeTab === "standings"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 shadow-sm"
            }`}
          >
            Standings
          </button>

          <button
            onClick={() =>
              setActiveTab("form")
            }
            className={`rounded-2xl px-4 py-2 font-medium ${
              activeTab === "form"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 shadow-sm"
            }`}
          >
            Add Player
          </button>

          <button
            onClick={() =>
              setActiveTab("rules")
            }
            className={`rounded-2xl px-4 py-2 font-medium ${
              activeTab === "rules"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 shadow-sm"
            }`}
          >
            Rules
          </button>
        </div>

        {/* Loading / Errors */}

        {loadingTable && (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
            Loading live table…
          </div>
        )}

        {tableError && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-red-700 shadow-sm">
            Could not load standings:{" "}
            {tableError}
          </div>
        )}

        {loadingParticipants && (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
            Loading participants…
          </div>
        )}

        {participantError && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-red-700 shadow-sm">
            Could not load participants:{" "}
            {participantError}
          </div>
        )}

        {/* =====================================================
            STANDINGS
        ===================================================== */}

        {activeTab === "standings" &&
          !!displayTable.length && (
            <>
              {/* Fantasy Leaderboard */}

              <section className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">
                  League Leaderboard
                </h2>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3">
                          Rank
                        </th>

                        <th className="px-4 py-3">
                          Player
                        </th>

                        <th className="px-4 py-3">
                          Points From
                        </th>

                        <th className="px-4 py-3 text-right">
                          Score
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {leaderboard.map(
                        (person, index) => (
                          <tr
                            key={person.id}
                            className="border-t border-slate-200"
                          >
                            <td className="px-4 py-3 font-medium">
                              #{index + 1}
                            </td>

                            <td className="px-4 py-3 font-medium">
                              {person.username}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {person.badges.length ? (
                                  person.badges.map(
                                    (badge) => (
                                      <span
                                        key={`${person.id}-${badge.label}`}
                                        title={
                                          badge.title
                                        }
                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                          badge.variant ===
                                          "top5"
                                            ? "bg-sky-100 text-sky-800"
                                            : badge.variant ===
                                              "bottom5"
                                            ? "bg-rose-100 text-rose-800"
                                            : badge.variant ===
                                              "wildcard"
                                            ? "bg-violet-100 text-violet-800"
                                            : "bg-emerald-100 text-emerald-800"
                                        }`}
                                      >
                                        {
                                          badge.label
                                        }
                                      </span>
                                    )
                                  )
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    —
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-right font-semibold">
                              {person.score} pts
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Special Picks */}

              <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">
                    Special Picks
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Current leaders — 3 points
                    for a correct prediction.
                  </p>
                </div>

                {specialPickRows.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-4 py-3">
                            Special Pick
                          </th>

                          <th className="px-4 py-3">
                            Current Leader
                          </th>

                          <th className="px-4 py-3 text-right">
                            Stat
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {specialPickRows.map(
                          ([label, pick]) => (
                            <tr
                              key={label}
                              className="border-t border-slate-200"
                            >
                              <td className="px-4 py-3 font-medium">
                                {label}
                              </td>

                              <td className="px-4 py-3">
                                {pick.team}
                              </td>

                              <td className="px-4 py-3 text-right font-semibold">
                                {label.includes(
                                  "Goal Difference"
                                ) &&
                                pick.value > 0
                                  ? `+${pick.value}`
                                  : pick.value}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                    Special pick statistics are
                    unavailable.
                  </div>
                )}
              </section>

              {/* Player Picks */}

              <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">
                    Player Picks
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1800px] text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3">
                          Player
                        </th>

                        <th className="px-4 py-3">
                          Top 5
                        </th>

                        <th className="px-4 py-3">
                          Bottom 5
                        </th>

                        <th className="px-4 py-3">
                          Wildcard
                        </th>

                        <th className="px-4 py-3">
                          Most Goals
                        </th>

                        <th className="px-4 py-3">
                          Fewest Goals
                        </th>

                        <th className="px-4 py-3">
                          Fewest GA
                        </th>

                        <th className="px-4 py-3">
                          Most GA
                        </th>

                        <th className="px-4 py-3">
                          Best GD
                        </th>

                        <th className="px-4 py-3">
                          Worst GD
                        </th>

                        <th className="px-4 py-3">
                          Closest 0 GD
                        </th>

                        <th className="px-4 py-3">
                          Most Wins
                        </th>

                        <th className="px-4 py-3">
                          Most Draws
                        </th>

                        <th className="px-4 py-3">
                          Most Losses
                        </th>

                        <th className="px-4 py-3">
                          Clean Sheets
                        </th>

                        <th className="px-4 py-3 text-right">
                          Edit
                        </th>

                        <th className="px-4 py-3 text-right">
                          Delete
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {participants.map(
                        (player) => (
                          <tr
                            key={player.id}
                            className="border-t border-slate-200 align-top"
                          >
                            <td className="whitespace-nowrap px-4 py-3 font-medium">
                              {player.username}
                            </td>

                            <td className="whitespace-pre px-4 py-3 text-slate-700">
                              {formatRankList(
                                player.picks.top5,
                                1
                              )}
                            </td>

                            <td className="whitespace-pre px-4 py-3 text-slate-700">
                              {formatRankList(
                                player.picks.bottom5,
                                16
                              )}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {
                                player.picks
                                  .wildcardTeam
                              }{" "}
                              -{" "}
                              {ordinal(
                                Number(
                                  player.picks
                                    .wildcardPosition
                                )
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .mostGoals
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .fewestGoals
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .fewestGoalsConceded
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .mostGoalsConceded
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .bestGoalDifference
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .worstGoalDifference
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .zeroGoalDiff
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .mostWins
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .mostDraws
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .mostLosses
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                player.picks
                                  .mostCleanSheets
                              }
                            </td>

                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() =>
                                  handleEditPlayer(
                                    player
                                  )
                                }
                                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                              >
                                Edit
                              </button>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() =>
                                  handleDeletePlayer(
                                    player.id
                                  )
                                }
                                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* League Table */}

              <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">
                  League Table
                </h2>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="px-2 py-3">
                          #
                        </th>

                        <th className="px-2 py-3">
                          Team
                        </th>

                        <th className="px-2 py-3 text-center">
                          P
                        </th>

                        <th className="px-2 py-3 text-center">
                          GD
                        </th>

                        <th className="px-2 py-3 text-center">
                          GF
                        </th>

                        <th className="px-2 py-3 text-center">
                          GA
                        </th>

                        <th className="px-2 py-3 text-center">
                          Pts
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {displayTable.map((row) => (
                        <tr
                          key={row.team}
                          className="border-b last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-2 py-3 font-medium">
                            {row.position}
                          </td>

                          <td className="whitespace-nowrap px-2 py-3 font-medium">
                            {row.team}
                          </td>

                          <td className="px-2 py-3 text-center">
                            {row.played}
                          </td>

                          <td className="px-2 py-3 text-center">
                            {row.gd > 0
                              ? `+${row.gd}`
                              : row.gd}
                          </td>

                          <td className="px-2 py-3 text-center">
                            {row.gf}
                          </td>

                          <td className="px-2 py-3 text-center">
                            {row.ga}
                          </td>

                          <td className="px-2 py-3 text-center font-semibold">
                            {row.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

        {/* =====================================================
            ADD / EDIT PLAYER
        ===================================================== */}

        {activeTab === "form" && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingPlayerId
                    ? "Edit Player"
                    : "Add Player"}
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Use this form to add a new
                  participant and all of their
                  picks.
                </p>
              </div>

              {editingPlayerId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-8"
            >
              {/* Username */}

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Username
                </label>

                <input
                  value={entry.username}
                  onChange={(e) =>
                    setEntry((current) => ({
                      ...current,
                      username:
                        e.target.value,
                    }))
                  }
                  className="w-full max-w-md rounded-2xl border border-slate-300 px-4 py-2 outline-none focus:border-slate-500"
                  placeholder="Enter username"
                />
              </div>

              {/* Top / Bottom 5 */}

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Top 5 */}

                <div className="rounded-3xl bg-slate-50 p-4">
                  <h3 className="mb-4 text-lg font-semibold">
                    Top 5 Picks
                  </h3>

                  <div className="space-y-3">
                    {entry.top5.map(
                      (value, index) => {
                        const exclude =
                          entry.top5
                            .filter(
                              (team, i) =>
                                i !== index &&
                                team
                            )
                            .concat(
                              entry.bottom5.filter(
                                Boolean
                              )
                            );

                        return (
                          <div
                            key={`top-${index}`}
                          >
                            <label className="mb-1 block text-sm font-medium">
                              Position{" "}
                              {index + 1}
                            </label>

                            <select
                              value={value}
                              onChange={(e) => {
                                const next = [
                                  ...entry.top5,
                                ];

                                next[index] =
                                  normalizeTeamName(
                                    e.target
                                      .value
                                  );

                                setEntry(
                                  (current) => ({
                                    ...current,
                                    top5: next,
                                  })
                                );
                              }}
                              className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                            >
                              <option value="">
                                Select team
                              </option>

                              {TEAM_NAMES.filter(
                                (team) =>
                                  !exclude.includes(
                                    team
                                  ) ||
                                  team === value
                              ).map((team) => (
                                <option
                                  key={team}
                                  value={team}
                                >
                                  {team}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Bottom 5 */}

                <div className="rounded-3xl bg-slate-50 p-4">
                  <h3 className="mb-4 text-lg font-semibold">
                    Bottom 5 Picks
                  </h3>

                  <div className="space-y-3">
                    {entry.bottom5.map(
                      (value, index) => {
                        const exclude =
                          entry.bottom5
                            .filter(
                              (team, i) =>
                                i !== index &&
                                team
                            )
                            .concat(
                              entry.top5.filter(
                                Boolean
                              )
                            );

                        return (
                          <div
                            key={`bottom-${index}`}
                          >
                            <label className="mb-1 block text-sm font-medium">
                              Position{" "}
                              {index + 16}
                            </label>

                            <select
                              value={value}
                              onChange={(e) => {
                                const next = [
                                  ...entry.bottom5,
                                ];

                                next[index] =
                                  normalizeTeamName(
                                    e.target
                                      .value
                                  );

                                setEntry(
                                  (current) => ({
                                    ...current,
                                    bottom5: next,
                                  })
                                );
                              }}
                              className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                            >
                              <option value="">
                                Select team
                              </option>

                              {TEAM_NAMES.filter(
                                (team) =>
                                  !exclude.includes(
                                    team
                                  ) ||
                                  team === value
                              ).map((team) => (
                                <option
                                  key={team}
                                  value={team}
                                >
                                  {team}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>

              {/* Mystery Pick */}

              <div className="rounded-3xl bg-slate-50 p-4">
                <h3 className="mb-1 text-lg font-semibold">
                  Mystery Pick
                </h3>

                <p className="mb-4 text-sm text-slate-500">
                  Pick one team to finish
                  exactly between 6th and 15th.
                  Worth 5 points.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Team
                    </label>

                    <select
                      value={
                        entry.wildcardTeam
                      }
                      onChange={(e) =>
                        setEntry(
                          (current) => ({
                            ...current,
                            wildcardTeam:
                              normalizeTeamName(
                                e.target.value
                              ),
                          })
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                    >
                      <option value="">
                        Select team
                      </option>

                      {TEAM_NAMES.filter(
                        (team) =>
                          !entry.top5.includes(
                            team
                          ) &&
                          !entry.bottom5.includes(
                            team
                          )
                      ).map((team) => (
                        <option
                          key={team}
                          value={team}
                        >
                          {team}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Position
                    </label>

                    <select
                      value={
                        entry.wildcardPosition
                      }
                      onChange={(e) =>
                        setEntry(
                          (current) => ({
                            ...current,
                            wildcardPosition:
                              e.target.value,
                          })
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                    >
                      <option value="">
                        Select position
                      </option>

                      {Array.from(
                        { length: 10 },
                        (_, i) => i + 6
                      ).map((pos) => (
                        <option
                          key={pos}
                          value={String(pos)}
                        >
                          {ordinal(pos)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Special Picks */}

              <div className="rounded-3xl bg-slate-50 p-4">
                <h3 className="mb-4 text-lg font-semibold">
                  Special Picks
                </h3>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    [
                      "Most Goals",
                      "mostGoals",
                    ],
                    [
                      "Fewest Goals",
                      "fewestGoals",
                    ],
                    [
                      "Fewest Goals Conceded",
                      "fewestGoalsConceded",
                    ],
                    [
                      "Most Goals Conceded",
                      "mostGoalsConceded",
                    ],
                    [
                      "Best Goal Difference",
                      "bestGoalDifference",
                    ],
                    [
                      "Worst Goal Difference",
                      "worstGoalDifference",
                    ],
                    [
                      "Closest to 0 Goal Difference",
                      "zeroGoalDiff",
                    ],
                    [
                      "Most Wins",
                      "mostWins",
                    ],
                    [
                      "Most Draws",
                      "mostDraws",
                    ],
                    [
                      "Most Losses",
                      "mostLosses",
                    ],
                    [
                      "Most Clean Sheets",
                      "mostCleanSheets",
                    ],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <label className="mb-1 block text-sm font-medium">
                        {label}
                      </label>

                      <select
                        value={
                          entry[
                            key as keyof Picks
                          ] as string
                        }
                        onChange={(e) =>
                          setEntry(
                            (current) => ({
                              ...current,
                              [key]:
                                normalizeTeamName(
                                  e.target
                                    .value
                                ),
                            })
                          )
                        }
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">
                          Select team
                        </option>

                        {TEAM_NAMES.map(
                          (team) => (
                            <option
                              key={team}
                              value={team}
                            >
                              {team}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
              >
                {editingPlayerId
                  ? "Save Changes"
                  : "Add Player"}
              </button>
            </form>
          </section>
        )}

        {/* =====================================================
            RULES
        ===================================================== */}

        {activeTab === "rules" && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              Official Rules
            </h2>

            <div className="space-y-6">
              {RULES.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-2 text-lg font-semibold">
                    {section.title}
                  </h3>

                  <div className="space-y-1 text-slate-700">
                    {section.items.map(
                      (item) => (
                        <div key={item}>
                          • {item}
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
