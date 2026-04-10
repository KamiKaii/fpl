"use client";

import { useEffect, useMemo, useState } from "react";

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

type ScoredParticipant = Participant & {
  score: number;
};

const TEAM_NAMES = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
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
  "Tottenham",
  "West Ham",
  "Wolves",
];

const SACKED_MANAGER_OPTIONS = [
  "Nuno Espírito Santo - Nottingham Forest",
  "Graham Potter - West Ham United",
  "Ange Postecoglou - Nottingham Forest",
  "Vítor Pereira - Wolverhampton Wanderers",
  "Enzo Maresca - Chelsea",
  "Ruben Amorim - Manchester United",
  "Thomas Frank - Tottenham Hotspur",
  "Sean Dyche - Nottingham Forest",
  "Igor Tudor - Tottenham Hotspur",
];

const STORAGE_KEY = "fpl-friends-tracker-v4";
const K9_KEY = "fpl-admin-k1n9k4i";

const DEFAULT_PARTICIPANTS: Participant[] = [];

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
  "Chelsea - 88 cards",
  "Brighton - 79 cards",
  "Bournemouth - 52 cards",
];

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function ordinal(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

function scoreParticipant(participant: Participant, table: Array<TeamRow & { gd: number; position: number }>): ScoredParticipant {
  let score = 0;
  const positionMap = Object.fromEntries(table.map((row) => [row.team, row.position]));

  participant.picks.top5.forEach((team, index) => {
    const pickedPosition = index + 1;
    const currentPosition = positionMap[team];
    if (currentPosition === pickedPosition) score += 3;
    else if (currentPosition >= 1 && currentPosition <= 5) score += 1;
  });

  participant.picks.bottom5.forEach((team, index) => {
    const pickedPosition = index + 16;
    const currentPosition = positionMap[team];
    if (currentPosition === pickedPosition) score += 3;
    else if (currentPosition >= 16 && currentPosition <= 20) score += 1;
  });

  if (positionMap[participant.picks.wildcardTeam] === Number(participant.picks.wildcardPosition)) score += 5;
  if (participant.picks.mostCards === "Chelsea") score += 3;
  if (participant.picks.managerSacked === "Graham Potter - West Ham United") score += 3;

  const zeroGoalDifferenceHit = table.find(
    (row) => row.team === participant.picks.zeroGoalDiff && row.gd === 0
  );
  if (zeroGoalDifferenceHit) score += 3;

  return { ...participant, score };
}

function selectOptions(exclude: string[], current?: string) {
  return TEAM_NAMES.filter((team) => !exclude.includes(team) || team === current);
}

function toEditableRows(standings: ApiStandingRow[]): TeamRow[] {
  return standings.map((row) => ({
    team: row.team,
    played: row.played,
    points: row.points,
    gf: row.gf,
    ga: row.ga,
  }));
}

function formatRankList(items: string[], start: number) {
  return items.map((item, index) => `${start + index}. ${item}`).join("\n");
}

export default function Page() {
  const [leagueTable, setLeagueTable] = useState<TeamRow[]>([]);
  const [participants, setParticipants] = useState<Participant[]>(DEFAULT_PARTICIPANTS);
  const [loadingTable, setLoadingTable] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"standings" | "form">("standings");
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.participants) setParticipants(parsed.participants);
    } catch {
      // ignore bad local data
    }
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ participants }));
  }, [participants]);

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

  const leaderboard = useMemo(() => {
    return participants
      .map((participant) => scoreParticipant(participant, displayTable))
      .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  }, [participants, displayTable]);

  const zeroGdTeams = displayTable.filter((team) => team.gd === 0).map((team) => team.team);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const allSelected = [
      ...entry.top5,
      ...entry.bottom5,
      entry.wildcardTeam,
      entry.mostCards,
      entry.zeroGoalDiff,
      entry.mostDraws,
    ].filter(Boolean);

    if (!entry.username.trim()) return alert("Please enter a username.");
    if (entry.top5.some((pick) => !pick) || entry.bottom5.some((pick) => !pick)) {
      return alert("Please complete all top 5 and bottom 5 picks.");
    }
    if (!entry.wildcardTeam || !entry.wildcardPosition || !entry.mostCards || !entry.managerSacked || !entry.zeroGoalDiff || !entry.mostDraws) {
      return alert("Please complete all special picks.");
    }
    if (new Set(allSelected).size !== allSelected.length) {
      return alert("Each team-based pick must be a different team.");
    }

    setParticipants((current) => [
      ...current,
      {
        id: uid(),
        username: entry.username.trim(),
        picks: {
          top5: entry.top5,
          bottom5: entry.bottom5,
          wildcardTeam: entry.wildcardTeam,
          wildcardPosition: entry.wildcardPosition,
          mostCards: entry.mostCards,
          managerSacked: entry.managerSacked,
          zeroGoalDiff: entry.zeroGoalDiff,
          mostDraws: entry.mostDraws,
        },
      },
    ]);

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
    setActiveTab("standings");
  }

  function handleDeletePlayer(id: string) {
  const enteredPassword = window.prompt("Enter admin password to delete this player:");
  if (enteredPassword !== K9_KEY) {
    window.alert("Incorrect password.");
    return;
  }
  setParticipants((current) => current.filter((player) => player.id !== id));
}

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            Fantasy Premier League
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Fantasy Premier League</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Live standings are pulled from Native Stats through your own Next.js API route.
          </p>
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
        </div>

        {loadingTable && <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">Loading live table…</div>}
        {tableError && <div className="mb-6 rounded-2xl bg-red-50 p-4 text-red-700 shadow-sm">Could not load standings: {tableError}</div>}

        {activeTab === "standings" && !!displayTable.length && (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="text-base font-semibold tracking-wide text-slate-800">Most Cards Leader</div>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  {CARD_LEADERS.map((item) => (
                    <div key={item} className="whitespace-nowrap">{item}</div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-slate-500">Updated April 10, 2026 · Numbers may not be exact and are approximate values from Claude.</div>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="text-base font-semibold tracking-wide text-slate-800">Managers Sacked</div>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  {MANAGERS_SACKED.map((item) => (
                    <div key={item.name} className="whitespace-nowrap text-sm">
                      <strong>{item.name}</strong> - {item.team}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-slate-500">Updated April 10, 2026</div>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="text-base font-semibold tracking-wide text-slate-800">Zero Goal Difference</div>
                <div className="mt-4 text-xl font-semibold">{zeroGdTeams.length ? zeroGdTeams.join(", ") : "No Team Right Now"}</div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-3xl bg-white p-5 shadow-sm">
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
                          <td className="px-2 py-3 font-medium">{row.team}</td>
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

              <section className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">Players' Standings</h2>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Player</th>
                        <th className="px-4 py-3 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((person, index) => (
                        <tr key={person.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 font-medium">#{index + 1}</td>
                          <td className="px-4 py-3 font-medium">{person.username}</td>
                          <td className="px-4 py-3 text-right font-semibold">{person.score} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Player Picks</h2>
                <div className="text-sm text-slate-500">Delete requires admin password</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1400px] text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Top 5 (1-5)</th>
                      <th className="px-4 py-3">Bottom 5 (16-20)</th>
                      <th className="px-4 py-3">Wildcard</th>
                      <th className="px-4 py-3">Manager Sacked</th>
                      <th className="px-4 py-3">Zero Goal Differential</th>
                      <th className="px-4 py-3">Most Cards</th>
                      <th className="px-4 py-3">Most Draws</th>
                      <th className="px-4 py-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((player) => (
                      <tr key={player.id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3 font-medium">{player.username}</td>
                        <td className="px-4 py-3 whitespace-pre-line text-slate-700">{formatRankList(player.picks.top5, 1)}</td>
                        <td className="px-4 py-3 whitespace-pre-line text-slate-700">{formatRankList(player.picks.bottom5, 16)}</td>
                        <td className="px-4 py-3 text-slate-700">{player.picks.wildcardTeam} - {ordinal(Number(player.picks.wildcardPosition))}</td>
                        <td className="px-4 py-3 text-slate-700">{player.picks.managerSacked}</td>
                        <td className="px-4 py-3 text-slate-700">{player.picks.zeroGoalDiff}</td>
                        <td className="px-4 py-3 text-slate-700">{player.picks.mostCards}</td>
                        <td className="px-4 py-3 text-slate-700">{player.picks.mostDraws}</td>
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
          </>
        )}

        {activeTab === "form" && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Add Player</h2>
            <p className="mb-4 text-sm text-slate-600">Use this form to add a new participant and all of their picks.</p>
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
                      const exclude = entry.top5.filter((team, i) => i !== index && team).concat(entry.bottom5.filter(Boolean), [entry.wildcardTeam, entry.mostCards, entry.zeroGoalDiff, entry.mostDraws].filter(Boolean));
                      return (
                        <div key={`top-${index}`}>
                          <label className="mb-1 block text-sm font-medium">Position {index + 1}</label>
                          <select
                            value={value}
                            onChange={(e) => {
                              const next = [...entry.top5];
                              next[index] = e.target.value;
                              setEntry((current) => ({ ...current, top5: next }));
                            }}
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                          >
                            <option value="">Select team</option>
                            {selectOptions(exclude, value).map((team) => (
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
                      const exclude = entry.bottom5.filter((team, i) => i !== index && team).concat(entry.top5.filter(Boolean), [entry.wildcardTeam, entry.mostCards, entry.zeroGoalDiff, entry.mostDraws].filter(Boolean));
                      return (
                        <div key={`bottom-${index}`}>
                          <label className="mb-1 block text-sm font-medium">Position {index + 16}</label>
                          <select
                            value={value}
                            onChange={(e) => {
                              const next = [...entry.bottom5];
                              next[index] = e.target.value;
                              setEntry((current) => ({ ...current, bottom5: next }));
                            }}
                            className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                          >
                            <option value="">Select team</option>
                            {selectOptions(exclude, value).map((team) => (
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
                        onChange={(e) => setEntry((current) => ({ ...current, wildcardTeam: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                      >
                        <option value="">Select team</option>
                        {selectOptions(entry.top5.filter(Boolean).concat(entry.bottom5.filter(Boolean), [entry.mostCards, entry.zeroGoalDiff, entry.mostDraws].filter(Boolean)), entry.wildcardTeam).map((team) => (
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
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Manager Sacked</label>
                      <select
                        value={entry.managerSacked}
                        onChange={(e) => setEntry((current) => ({ ...current, managerSacked: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                      >
                        <option value="">Select manager</option>
                        {SACKED_MANAGER_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Zero Goal Differential</label>
                      <select
                        value={entry.zeroGoalDiff}
                        onChange={(e) => setEntry((current) => ({ ...current, zeroGoalDiff: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                      >
                        <option value="">Select team</option>
                        {selectOptions(entry.top5.filter(Boolean).concat(entry.bottom5.filter(Boolean), [entry.wildcardTeam, entry.mostCards, entry.mostDraws].filter(Boolean)), entry.zeroGoalDiff).map((team) => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Most Cards</label>
                      <select
                        value={entry.mostCards}
                        onChange={(e) => setEntry((current) => ({ ...current, mostCards: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                      >
                        <option value="">Select team</option>
                        {selectOptions(entry.top5.filter(Boolean).concat(entry.bottom5.filter(Boolean), [entry.wildcardTeam, entry.zeroGoalDiff, entry.mostDraws].filter(Boolean)), entry.mostCards).map((team) => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Most Draws</label>
                      <select
                        value={entry.mostDraws}
                        onChange={(e) => setEntry((current) => ({ ...current, mostDraws: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                      >
                        <option value="">Select team</option>
                        {selectOptions(entry.top5.filter(Boolean).concat(entry.bottom5.filter(Boolean), [entry.wildcardTeam, entry.mostCards, entry.zeroGoalDiff].filter(Boolean)), entry.mostDraws).map((team) => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800">
                Add Player
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
