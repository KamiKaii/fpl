"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type ApiStandingRow = {
  position: number;
  team: string;
  played: number;
  points: number;
  gd: number;
  gf: number;
  ga: number;
};

type TeamRow = {
  team: string;
  played: number;
  points: number;
  gf: number;
  ga: number;
};

type Picks = {
  top5: string[];
  bottom5: string[];
  wildcardTeam: string;
  wildcardPosition: string;
  mostCards: string;
  managerSacked: string;
  zeroGoalDiff: string;
  mostDraws: string;
};

type Participant = {
  id: string;
  username: string;
  picks: Picks;
};

type ScoreBadge = {
  label: string;
  title: string;
  variant: "top5" | "bottom5" | "wildcard" | "cards" | "fired" | "zero_gd";
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
  most_cards: string;
  manager_sacked: string;
  zero_goal_diff: string;
  most_draws: string;
  created_at: string;
};

const TEAM_NAMES = [
  "Arsenal",
  "Aston Villa",
  "AFC Bournemouth",
  "Brentford",
  "Brighton & Hove Albion",
  "Burnley",
  "Chelsea",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Leeds United",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle United",
  "Nottingham Forest",
  "Sunderland",
  "Tottenham Hotspur",
  "West Ham United",
  "Wolverhampton Wanderers",
] as const;

const TEAM_NAME_MAP: Record<string, string> = {
  Arsenal: "Arsenal",
  "Aston Villa": "Aston Villa",
  Bournemouth: "AFC Bournemouth",
  "AFC Bournemouth": "AFC Bournemouth",
  Brentford: "Brentford",
  Brighton: "Brighton & Hove Albion",
  "Brighton & Hove Albion": "Brighton & Hove Albion",
  Burnley: "Burnley",
  Chelsea: "Chelsea",
  "Crystal Palace": "Crystal Palace",
  Everton: "Everton",
  Fulham: "Fulham",
  "Leeds United": "Leeds United",
  Liverpool: "Liverpool",
  "Manchester City": "Manchester City",
  "Manchester United": "Manchester United",
  "Newcastle United": "Newcastle United",
  "Nottingham Forest": "Nottingham Forest",
  Sunderland: "Sunderland",
  Tottenham: "Tottenham Hotspur",
  "Tottenham Hotspur": "Tottenham Hotspur",
  "West Ham": "West Ham United",
  "West Ham United": "West Ham United",
  Wolves: "Wolverhampton Wanderers",
  "Wolverhampton Wanderers": "Wolverhampton Wanderers",
};

const START_OF_SEASON_MANAGER_OPTIONS = [
  "Mikel Arteta - Arsenal",
  "Unai Emery - Aston Villa",
  "Andoni Iraola - AFC Bournemouth",
  "Keith Andrews - Brentford",
  "Fabian Hurzeler - Brighton & Hove Albion",
  "Scott Parker - Burnley",
  "Enzo Maresca - Chelsea",
  "Oliver Glasner - Crystal Palace",
  "David Moyes - Everton",
  "Marco Silva - Fulham",
  "Daniel Farke - Leeds United",
  "Arne Slot - Liverpool",
  "Pep Guardiola - Manchester City",
  "Ruben Amorim - Manchester United",
  "Eddie Howe - Newcastle United",
  "Nuno Espírito Santo - Nottingham Forest",
  "Régis Le Bris - Sunderland",
  "Thomas Frank - Tottenham Hotspur",
  "Graham Potter - West Ham United",
  "Vítor Pereira - Wolverhampton Wanderers",
] as const;

const K9_KEY = "fpl-admin-k1n9k4i";

const MANAGERS_SACKED = [
  { name: "Nuno Espírito Santo", team: "Nottingham Forest" },
  { name: "Graham Potter", team: "West Ham United" },
  { name: "Ange Postecoglou", team: "Nottingham Forest" },
  { name: "Vítor Pereira", team: "Wolverhampton Wanderers" },
  { name: "Enzo Maresca", team: "Chelsea" },
  { name: "Ruben Amorim", team: "Manchester United" },
  { name: "Thomas Frank", team: "Tottenham Hotspur" },
  { name: "Sean Dyche", team: "Nottingham Forest" },
  { name: "Igor Tudor", team: "Tottenham Hotspur" },
];

const CARD_LEADERS = [
  { team: "Chelsea", cards: 88 },
  { team: "Brighton & Hove Albion", cards: 79 },
  { team: "AFC Bournemouth", cards: 52 },
];

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
    items: ["1 team predicted to finish 6th–15th, with exact spot — 5 points"],
  },
  {
    title: "Special Picks",
    items: [
      "Manager sacked anytime in the season — 3 points",
      "Team with goal differential closest to 0 — 3 points",
      "Team with the most cards (yellow/red combined) — 3 points",
      "Team with the most draws — 3 points",
    ],
  },
  {
    title: "Scoring Example",
    items: [
      "Predict Arsenal 2nd — Arsenal finish 2nd = 3 points",
      "Predict Arsenal 2nd — Arsenal finish 4th (still top 5) = 1 point",
      "Mystery Pick Tottenham Hotspur 10th — Tottenham Hotspur finish 10th = 5 points",
    ],
  },
];

function normalizeTeamName(team: string) {
  return TEAM_NAME_MAP[team] ?? team;
}

function ordinal(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

function formatRankList(items: string[], start: number) {
  return items.map((item, index) => `${start + index}. ${item}`).join("\n");
}

function getClosestZeroGoalDiffTeams(table: Array<TeamRow & { gd: number }>) {
  if (!table.length) return { teams: [] as string[], distance: 0 };
  const minDistance = Math.min(...table.map((row) => Math.abs(row.gd)));
  return {
    teams: table.filter((row) => Math.abs(row.gd) === minDistance).map((row) => row.team),
    distance: minDistance,
  };
}

function scoreParticipant(
  participant: Participant,
  table: Array<TeamRow & { gd: number; position: number }>,
  closestZeroTeams: string[]
): ScoredParticipant {
  let score = 0;
  const badges: ScoreBadge[] = [];
  const positionMap = Object.fromEntries(table.map((row) => [row.team, row.position]));

  let top5Points = 0;
  participant.picks.top5.forEach((team, index) => {
    const pickedPosition = index + 1;
    const currentPosition = positionMap[team];
    if (currentPosition === pickedPosition) {
      score += 3;
      top5Points += 3;
    } else if (currentPosition >= 1 && currentPosition <= 5) {
      score += 1;
      top5Points += 1;
    }
  });
  if (top5Points > 0) {
    const top5Hits = participant.picks.top5.filter((team, index) => {
    const pickedPosition = index + 1;
    const currentPosition = positionMap[team];
    return currentPosition === pickedPosition || (currentPosition >= 1 && currentPosition <= 5);
  }).length;
  badges.push({
    label: `${top5Hits}x Top 5`,
    title: `Top 5 picks: ${top5Points} pts across ${top5Hits} hit${top5Hits === 1 ? "" : "s"}`,
    variant: "top5",
  });
  }

  let bottom5Points = 0;
  participant.picks.bottom5.forEach((team, index) => {
    const pickedPosition = index + 16;
    const currentPosition = positionMap[team];
    if (currentPosition === pickedPosition) {
      score += 3;
      bottom5Points += 3;
    } else if (currentPosition >= 16 && currentPosition <= 20) {
      score += 1;
      bottom5Points += 1;
    }
  });
  if (bottom5Points > 0) {
    const bottom5Hits = participant.picks.bottom5.filter((team, index) => {
    const pickedPosition = index + 16;
    const currentPosition = positionMap[team];
    return currentPosition === pickedPosition || (currentPosition >= 16 && currentPosition <= 20);
  }).length;
  badges.push({
    label: `${bottom5Hits}x Bottom 5`,
    title: `Bottom 5 picks: ${bottom5Points} pts across ${bottom5Hits} hit${bottom5Hits === 1 ? "" : "s"}`,
    variant: "bottom5",
  });
  }

  if (positionMap[participant.picks.wildcardTeam] === Number(participant.picks.wildcardPosition)) {
    score += 5;
    badges.push({ label: "Wildcard", title: "Wildcard exact hit: 5 pts", variant: "wildcard" });
  }

  if (participant.picks.mostCards === "Chelsea") {
    score += 3;
    badges.push({ label: "Cards", title: "Most cards: 3 pts", variant: "cards" });
  }

const sackedManagerOptions = MANAGERS_SACKED.map(
  (item) => `${item.name} - ${item.team}`
);

if (sackedManagerOptions.includes(participant.picks.managerSacked)) {
  score += 3;
  badges.push({ label: "Fired", title: "Manager sacked: 3 pts", variant: "fired" });
}

  if (closestZeroTeams.includes(participant.picks.zeroGoalDiff)) {
    score += 3;
    badges.push({ label: "Zero GD", title: "Closest to zero goal difference: 3 pts", variant: "zero_gd" });
  }

  return { ...participant, score, badges };
}

function toEditableRows(standings: ApiStandingRow[]): TeamRow[] {
  return standings.map((row) => ({
    team: normalizeTeamName(row.team),
    played: row.played,
    points: row.points,
    gf: row.gf,
    ga: row.ga,
  }));
}

function dbRowToParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    username: row.username,
    picks: {
      top5: row.top5,
      bottom5: row.bottom5,
      wildcardTeam: row.wildcard_team,
      wildcardPosition: String(row.wildcard_position),
      mostCards: row.most_cards,
      managerSacked: row.manager_sacked,
      zeroGoalDiff: row.zero_goal_diff,
      mostDraws: row.most_draws,
    },
  };
}

export default function Page() {
  const [leagueTable, setLeagueTable] = useState<TeamRow[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"standings" | "form" | "rules">("standings");
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [entry, setEntry] = useState<Picks & { username: string }>({
    username: "",
    top5: ["", "", "", "", ""],
    bottom5: ["", "", "", "", ""],
    wildcardTeam: "",
    wildcardPosition: "",
    mostCards: "",
    managerSacked: "",
    zeroGoalDiff: "",
    mostDraws: "",
  });

  useEffect(() => {
    async function loadParticipants() {
      setLoadingParticipants(true);
      setParticipantError(null);

      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        setParticipantError(error.message);
        setLoadingParticipants(false);
        return;
      }

      setParticipants(((data ?? []) as ParticipantRow[]).map(dbRowToParticipant));
      setLoadingParticipants(false);
    }

    loadParticipants();
  }, []);

  useEffect(() => {
    async function loadStandings() {
      try {
        setLoadingTable(true);
        setTableError(null);
        const res = await fetch("/api/standings", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load standings");
        setLeagueTable(toEditableRows(data.standings));
      } catch (err) {
        setTableError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoadingTable(false);
      }
    }

    loadStandings();
  }, []);

  const displayTable = useMemo(() => {
    return [...leagueTable]
      .map((row) => ({
        ...row,
        gd: row.gf - row.ga,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.team.localeCompare(b.team);
      })
      .map((row, index) => ({ ...row, position: index + 1 }));
  }, [leagueTable]);

  const closestZeroGoalDiff = useMemo(() => getClosestZeroGoalDiffTeams(displayTable), [displayTable]);

  const leaderboard = useMemo(() => {
    return participants
      .map((participant) => scoreParticipant(participant, displayTable, closestZeroGoalDiff.teams))
      .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  }, [participants, displayTable, closestZeroGoalDiff]);

  function resetForm() {
    setEditingPlayerId(null);
    setEntry({
      username: "",
      top5: ["", "", "", "", ""],
      bottom5: ["", "", "", "", ""],
      wildcardTeam: "",
      wildcardPosition: "",
      mostCards: "",
      managerSacked: "",
      zeroGoalDiff: "",
      mostDraws: "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!entry.username.trim()) {
      alert("Please enter a username.");
      return;
    }

    if (entry.top5.some((pick) => !pick) || entry.bottom5.some((pick) => !pick)) {
      alert("Please complete all top 5 and bottom 5 picks.");
      return;
    }

    if (!entry.wildcardTeam || !entry.wildcardPosition || !entry.mostCards || !entry.managerSacked || !entry.zeroGoalDiff || !entry.mostDraws) {
      alert("Please complete all special picks.");
      return;
    }

    const top5Unique = new Set(entry.top5).size === entry.top5.length;
    const bottom5Unique = new Set(entry.bottom5).size === entry.bottom5.length;

    if (!top5Unique) {
      alert("Top 5 picks must all be different teams.");
      return;
    }

    if (!bottom5Unique) {
      alert("Bottom 5 picks must all be different teams.");
      return;
    }

    const placementTeams = [...entry.top5, ...entry.bottom5];

    if (new Set(placementTeams).size !== placementTeams.length) {
      alert("Top 5 and Bottom 5 picks cannot contain the same team twice.");
      return;
    }

    if (placementTeams.includes(entry.wildcardTeam)) {
      alert("Wildcard team must be different from your Top 5 and Bottom 5 picks.");
      return;
    }

    const payload = {
      username: entry.username.trim(),
      top5: entry.top5,
      bottom5: entry.bottom5,
      wildcard_team: entry.wildcardTeam,
      wildcard_position: Number(entry.wildcardPosition),
      most_cards: entry.mostCards,
      manager_sacked: entry.managerSacked,
      zero_goal_diff: entry.zeroGoalDiff,
      most_draws: entry.mostDraws,
    };

    if (editingPlayerId) {
      const { data, error } = await supabase
        .from("participants")
        .update(payload)
        .eq("id", editingPlayerId)
        .select()
        .single();

      if (error) {
        alert(`Failed to update player: ${error.message}`);
        return;
      }

      setParticipants((current) =>
        current.map((player) => (player.id === editingPlayerId ? dbRowToParticipant(data as ParticipantRow) : player))
      );
    } else {
      const { data, error } = await supabase
        .from("participants")
        .insert(payload)
        .select()
        .single();

      if (error) {
        alert(`Failed to add player: ${error.message}`);
        return;
      }

      setParticipants((current) => [...current, dbRowToParticipant(data as ParticipantRow)]);
    }

    resetForm();
    setActiveTab("standings");
  }

  async function handleDeletePlayer(id: string) {
    const enteredPassword = window.prompt("Enter admin password to delete this player:");
    if (enteredPassword !== K9_KEY) {
      window.alert("Incorrect password.");
      return;
    }

    const { error } = await supabase.from("participants").delete().eq("id", id);

    if (error) {
      window.alert(`Failed to delete player: ${error.message}`);
      return;
    }

    setParticipants((current) => current.filter((player) => player.id !== id));
  }

  function handleEditPlayer(player: Participant) {
    const enteredPassword = window.prompt("Enter admin password to edit this player:");
    if (enteredPassword !== K9_KEY) {
      window.alert("Incorrect password.");
      return;
    }

    setEditingPlayerId(player.id);
    setEntry({
      username: player.username,
      top5: [...player.picks.top5],
      bottom5: [...player.picks.bottom5],
      wildcardTeam: player.picks.wildcardTeam,
      wildcardPosition: player.picks.wildcardPosition,
      mostCards: player.picks.mostCards,
      managerSacked: player.picks.managerSacked,
      zeroGoalDiff: player.picks.zeroGoalDiff,
      mostDraws: player.picks.mostDraws,
    });
    setActiveTab("form");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            Fantasy Premier League
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Fantasy Premier League</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Live standings are pulled from Native Stats.</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab("standings")}
            className={`rounded-2xl px-4 py-2 font-medium ${activeTab === "standings" ? "bg-slate-900 text-white" : "bg-white text-slate-700 shadow-sm"}`}
          >
            Standings
          </button>
          <button
            onClick={() => setActiveTab("form")}
            className={`rounded-2xl px-4 py-2 font-medium ${activeTab === "form" ? "bg-slate-900 text-white" : "bg-white text-slate-700 shadow-sm"}`}
          >
            Add Player
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`rounded-2xl px-4 py-2 font-medium ${activeTab === "rules" ? "bg-slate-900 text-white" : "bg-white text-slate-700 shadow-sm"}`}
          >
            Rules
          </button>
        </div>

        {loadingTable && <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">Loading live table…</div>}
        {tableError && <div className="mb-6 rounded-2xl bg-red-50 p-4 text-red-700 shadow-sm">Could not load standings: {tableError}</div>}
        {loadingParticipants && <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">Loading participants…</div>}
        {participantError && <div className="mb-6 rounded-2xl bg-red-50 p-4 text-red-700 shadow-sm">Could not load participants: {participantError}</div>}

        {activeTab === "standings" && !!displayTable.length && (
          <>
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">League Leaderboard</h2>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Points From</th>
                      <th className="px-4 py-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((person, index) => (
                      <tr key={person.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-medium">#{index + 1}</td>
                        <td className="px-4 py-3 font-medium">{person.username}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {person.badges.length ? (
                                person.badges.map((badge) => (
                                  <span
                                    key={`${person.id}-${badge.label}`}
                                    title={badge.title}
                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      badge.variant === "top5"
                                        ? "bg-sky-100 text-sky-800"
                                        : badge.variant === "bottom5"
                                          ? "bg-rose-100 text-rose-800"
                                          : badge.variant === "wildcard"
                                            ? "bg-violet-100 text-violet-800"
                                            : badge.variant === "cards"
                                              ? "bg-amber-100 text-amber-800"
                                              : badge.variant === "fired"
                                                ? "bg-slate-200 text-slate-800"
                                                : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {badge.label}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{person.score} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="text-xl font-bold tracking-tight text-slate-900">Most Cards Leader</div>
                <div className="mt-4 space-y-2 text-slate-700">
                  <div className="text-2xl font-bold leading-tight">{CARD_LEADERS[0].team} - {CARD_LEADERS[0].cards} cards</div>
                  <div className="text-base font-medium leading-tight">{CARD_LEADERS[1].team} - {CARD_LEADERS[1].cards} cards</div>
                  <div className="text-sm font-medium leading-tight">{CARD_LEADERS[2].team} - {CARD_LEADERS[2].cards} cards</div>
                </div>
                <div className="mt-4 text-xs text-slate-500">Updated April 10, 2026 · Numbers may not be exact and are approximate values from Claude.</div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="text-xl font-bold tracking-tight text-slate-900">Managers Sacked</div>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  {MANAGERS_SACKED.map((item) => (
                    <div key={item.name} className="whitespace-nowrap leading-tight">
                      <strong>{item.name}</strong> - {item.team}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-slate-500">Updated April 10, 2026</div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="text-xl font-bold tracking-tight text-slate-900">Zero Goal Difference</div>
                <div className="mt-4 space-y-2 text-slate-700">
                  {closestZeroGoalDiff.teams.map((team) => (
                    <div key={team} className="text-base font-semibold leading-tight whitespace-nowrap">{team}</div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-slate-500">
                  {closestZeroGoalDiff.distance === 0
                    ? "Teams currently at 0 goal difference."
                    : `Teams closest to 0 goal difference (±${closestZeroGoalDiff.distance}).`}
                </div>
              </div>
            </div>

            <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Player Picks</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1600px] text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Top 5</th>
                      <th className="px-4 py-3">Bottom 5</th>
                      <th className="px-4 py-3">Wildcard</th>
                      <th className="px-4 py-3">Manager Sacked</th>
                      <th className="px-4 py-3">Zero Goal Differential</th>
                      <th className="px-4 py-3">Most Cards</th>
                      <th className="px-4 py-3">Most Draws</th>
                      <th className="px-4 py-3 text-right">Edit</th>
                      <th className="px-4 py-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((player) => (
                      <tr key={player.id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{player.username}</td>
                        <td className="px-4 py-3 whitespace-pre text-slate-700">{formatRankList(player.picks.top5, 1)}</td>
                        <td className="px-4 py-3 whitespace-pre text-slate-700">{formatRankList(player.picks.bottom5, 16)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{player.picks.wildcardTeam} - {ordinal(Number(player.picks.wildcardPosition))}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{player.picks.managerSacked}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{player.picks.zeroGoalDiff}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{player.picks.mostCards}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{player.picks.mostDraws}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleEditPlayer(player)}
                            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                          >
                            Edit
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">League Table</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="px-2 py-3">#</th>
                      <th className="px-2 py-3">Team</th>
                      <th className="px-2 py-3 text-center">P</th>
                      <th className="px-2 py-3 text-center">GD</th>
                      <th className="px-2 py-3 text-center">GF</th>
                      <th className="px-2 py-3 text-center">GA</th>
                      <th className="px-2 py-3 text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTable.map((row) => (
                      <tr key={row.team} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-2 py-3 font-medium">{row.position}</td>
                        <td className="px-2 py-3 font-medium whitespace-nowrap">{row.team}</td>
                        <td className="px-2 py-3 text-center">{row.played}</td>
                        <td className="px-2 py-3 text-center">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                        <td className="px-2 py-3 text-center">{row.gf}</td>
                        <td className="px-2 py-3 text-center">{row.ga}</td>
                        <td className="px-2 py-3 text-center font-semibold">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeTab === "form" && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{editingPlayerId ? "Edit Player" : "Add Player"}</h2>
                <p className="mt-1 text-sm text-slate-600">Use this form to add a new participant and all of their picks.</p>
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

            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="mb-2 block text-sm font-medium">Username</label>
                <input
                  value={entry.username}
                  onChange={(e) => setEntry((current) => ({ ...current, username: e.target.value }))}
                  className="w-full max-w-md rounded-2xl border border-slate-300 px-4 py-2 outline-none focus:border-slate-500"
                  placeholder="Enter username"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <h3 className="mb-4 text-lg font-semibold">Top 5 Picks</h3>
                  <div className="space-y-3">
                    {entry.top5.map((value, index) => {
                      const exclude = entry.top5.filter((team, i) => i !== index && team).concat(entry.bottom5.filter(Boolean));
                      return (
                        <div key={`top-${index}`}>
                          <label className="mb-1 block text-sm font-medium">Position {index + 1}</label>
                          <select
                            value={value}
                            onChange={(e) => {
                              const next = [...entry.top5];
                              next[index] = normalizeTeamName(e.target.value);
                              setEntry((current) => ({ ...current, top5: next }));
                            }}
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                          >
                            <option value="">Select team</option>
                            {TEAM_NAMES.filter((team) => !exclude.includes(team) || team === value).map((team) => (
                              <option key={team} value={team}>{team}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50 p-4">
                  <h3 className="mb-4 text-lg font-semibold">Bottom 5 Picks</h3>
                  <div className="space-y-3">
                    {entry.bottom5.map((value, index) => {
                      const exclude = entry.bottom5.filter((team, i) => i !== index && team).concat(entry.top5.filter(Boolean));
                      return (
                        <div key={`bottom-${index}`}>
                          <label className="mb-1 block text-sm font-medium">Position {index + 16}</label>
                          <select
                            value={value}
                            onChange={(e) => {
                              const next = [...entry.bottom5];
                              next[index] = normalizeTeamName(e.target.value);
                              setEntry((current) => ({ ...current, bottom5: next }));
                            }}
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                          >
                            <option value="">Select team</option>
                            {TEAM_NAMES.filter((team) => !exclude.includes(team) || team === value).map((team) => (
                              <option key={team} value={team}>{team}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <h3 className="mb-4 text-lg font-semibold">Wildcard Pick</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Team</label>
                      <select
                        value={entry.wildcardTeam}
                        onChange={(e) => setEntry((current) => ({ ...current, wildcardTeam: normalizeTeamName(e.target.value) }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                      >
                        <option value="">Select team</option>
                        {TEAM_NAMES.map((team) => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Position</label>
                      <select
                        value={entry.wildcardPosition}
                        onChange={(e) => setEntry((current) => ({ ...current, wildcardPosition: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                      >
                        <option value="">Select position</option>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map((pos) => (
                          <option key={pos} value={String(pos)}>{ordinal(pos)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50 p-4">
                  <h3 className="mb-4 text-lg font-semibold">Special Picks</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block whitespace-nowrap text-sm font-medium">Manager Sacked</label>
                      <select
                        value={entry.managerSacked}
                        onChange={(e) => setEntry((current) => ({ ...current, managerSacked: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select manager</option>
                        {START_OF_SEASON_MANAGER_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block whitespace-nowrap text-sm font-medium">Zero Goal Differential</label>
                      <select
                        value={entry.zeroGoalDiff}
                        onChange={(e) => setEntry((current) => ({ ...current, zeroGoalDiff: normalizeTeamName(e.target.value) }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select team</option>
                        {TEAM_NAMES.map((team) => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block whitespace-nowrap text-sm font-medium">Most Cards</label>
                      <select
                        value={entry.mostCards}
                        onChange={(e) => setEntry((current) => ({ ...current, mostCards: normalizeTeamName(e.target.value) }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select team</option>
                        {TEAM_NAMES.map((team) => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block whitespace-nowrap text-sm font-medium">Most Draws</label>
                      <select
                        value={entry.mostDraws}
                        onChange={(e) => setEntry((current) => ({ ...current, mostDraws: normalizeTeamName(e.target.value) }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select team</option>
                        {TEAM_NAMES.map((team) => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800">
                {editingPlayerId ? "Save Changes" : "Add Player"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "rules" && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">Official Rules</h2>
            <div className="space-y-6">
              {RULES.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-2 text-lg font-semibold">{section.title}</h3>
                  <div className="space-y-1 text-slate-700">
                    {section.items.map((item) => (
                      <div key={item}>• {item}</div>
                    ))}
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
