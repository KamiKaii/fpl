"use client";

import { useEffect, useMemo, useState } from "react";

type TeamRow = {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  managerSacked: boolean;
  mostCardsLeader: boolean;
};

type Picks = {
  top5: string[];
  bottom5: string[];
  wildcardTeam: string;
  wildcardPosition: string;
  mostCards: string;
  managerSacked: string;
  zeroGoalDiff: string;
};

type Participant = {
  id: string;
  username: string;
  picks: Picks;
};

type ScoredParticipant = Participant & {
  score: number;
  breakdown: string[];
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

const STORAGE_KEY = "fpl-friends-tracker-v1";

const DEFAULT_LEAGUE_TABLE: TeamRow[] = [
  { team: "Liverpool", played: 5, wins: 4, draws: 1, losses: 0, gf: 12, ga: 4, managerSacked: false, mostCardsLeader: false },
  { team: "Manchester City", played: 5, wins: 4, draws: 0, losses: 1, gf: 11, ga: 5, managerSacked: false, mostCardsLeader: false },
  { team: "Arsenal", played: 5, wins: 3, draws: 2, losses: 0, gf: 9, ga: 3, managerSacked: false, mostCardsLeader: false },
  { team: "Chelsea", played: 5, wins: 3, draws: 1, losses: 1, gf: 10, ga: 6, managerSacked: false, mostCardsLeader: false },
  { team: "Tottenham", played: 5, wins: 3, draws: 0, losses: 2, gf: 8, ga: 6, managerSacked: false, mostCardsLeader: false },
  { team: "Newcastle United", played: 5, wins: 2, draws: 2, losses: 1, gf: 7, ga: 5, managerSacked: false, mostCardsLeader: false },
  { team: "Aston Villa", played: 5, wins: 2, draws: 1, losses: 2, gf: 8, ga: 8, managerSacked: false, mostCardsLeader: false },
  { team: "Brighton", played: 5, wins: 2, draws: 1, losses: 2, gf: 7, ga: 7, managerSacked: false, mostCardsLeader: false },
  { team: "Manchester United", played: 5, wins: 2, draws: 0, losses: 3, gf: 6, ga: 7, managerSacked: false, mostCardsLeader: false },
  { team: "Fulham", played: 5, wins: 1, draws: 2, losses: 2, gf: 5, ga: 6, managerSacked: false, mostCardsLeader: false },
  { team: "Brentford", played: 5, wins: 1, draws: 2, losses: 2, gf: 5, ga: 7, managerSacked: false, mostCardsLeader: false },
  { team: "Crystal Palace", played: 5, wins: 1, draws: 2, losses: 2, gf: 4, ga: 6, managerSacked: false, mostCardsLeader: false },
  { team: "Bournemouth", played: 5, wins: 1, draws: 1, losses: 3, gf: 5, ga: 8, managerSacked: false, mostCardsLeader: true },
  { team: "West Ham", played: 5, wins: 1, draws: 1, losses: 3, gf: 4, ga: 8, managerSacked: true, mostCardsLeader: false },
  { team: "Everton", played: 5, wins: 1, draws: 1, losses: 3, gf: 3, ga: 7, managerSacked: false, mostCardsLeader: false },
  { team: "Wolves", played: 5, wins: 1, draws: 0, losses: 4, gf: 4, ga: 9, managerSacked: false, mostCardsLeader: false },
  { team: "Leeds United", played: 5, wins: 1, draws: 0, losses: 4, gf: 4, ga: 10, managerSacked: false, mostCardsLeader: false },
  { team: "Burnley", played: 5, wins: 0, draws: 2, losses: 3, gf: 3, ga: 8, managerSacked: false, mostCardsLeader: false },
  { team: "Nottingham Forest", played: 5, wins: 0, draws: 1, losses: 4, gf: 2, ga: 9, managerSacked: false, mostCardsLeader: false },
  { team: "Sunderland", played: 5, wins: 0, draws: 1, losses: 4, gf: 1, ga: 11, managerSacked: false, mostCardsLeader: false },
];

const DEFAULT_PARTICIPANTS: Participant[] = [
  {
    id: "1",
    username: "Preston",
    picks: {
      top5: ["Manchester City", "Arsenal", "Liverpool", "Chelsea", "Tottenham"],
      bottom5: ["Everton", "Wolves", "Leeds United", "Burnley", "Sunderland"],
      wildcardTeam: "Aston Villa",
      wildcardPosition: "7",
      mostCards: "Bournemouth",
      managerSacked: "West Ham",
      zeroGoalDiff: "Brighton",
    },
  },
  {
    id: "2",
    username: "Alex",
    picks: {
      top5: ["Liverpool", "Manchester City", "Arsenal", "Chelsea", "Newcastle United"],
      bottom5: ["West Ham", "Everton", "Wolves", "Nottingham Forest", "Sunderland"],
      wildcardTeam: "Chelsea",
      wildcardPosition: "4",
      mostCards: "Bournemouth",
      managerSacked: "West Ham",
      zeroGoalDiff: "Aston Villa",
    },
  },
];

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function computeTable(table: TeamRow[]) {
  return [...table]
    .map((row) => ({
      ...row,
      gd: row.gf - row.ga,
      points: row.wins * 3 + row.draws,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    })
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function scoreParticipant(participant: Participant, table: ReturnType<typeof computeTable>): ScoredParticipant {
  let score = 0;
  const breakdown: string[] = [];
  const positionMap = Object.fromEntries(table.map((row) => [row.team, row.position]));

  participant.picks.top5.forEach((team, index) => {
    const pickedPosition = index + 1;
    const currentPosition = positionMap[team];
    if (currentPosition === pickedPosition) {
      score += 3;
      breakdown.push(`${team}: exact top 5 spot (+3)`);
    } else if (currentPosition >= 1 && currentPosition <= 5) {
      score += 1;
      breakdown.push(`${team}: in top 5 (+1)`);
    }
  });

  participant.picks.bottom5.forEach((team, index) => {
    const pickedPosition = index + 16;
    const currentPosition = positionMap[team];
    if (currentPosition === pickedPosition) {
      score += 3;
      breakdown.push(`${team}: exact bottom 5 spot (+3)`);
    } else if (currentPosition >= 16 && currentPosition <= 20) {
      score += 1;
      breakdown.push(`${team}: in bottom 5 (+1)`);
    }
  });

  if (positionMap[participant.picks.wildcardTeam] === Number(participant.picks.wildcardPosition)) {
    score += 5;
    breakdown.push(`${participant.picks.wildcardTeam}: wildcard exact spot (+5)`);
  }

  const cardsLeader = table.find((row) => row.mostCardsLeader)?.team;
  if (participant.picks.mostCards === cardsLeader) {
    score += 3;
    breakdown.push(`${participant.picks.mostCards}: most cards (+3)`);
  }

  const sackedTeam = table.find((row) => row.managerSacked)?.team;
  if (participant.picks.managerSacked === sackedTeam) {
    score += 3;
    breakdown.push(`${participant.picks.managerSacked}: manager sacked (+3)`);
  }

  const zeroGoalDifferenceHit = table.find(
    (row) => row.team === participant.picks.zeroGoalDiff && row.gd === 0
  );
  if (zeroGoalDifferenceHit) {
    score += 3;
    breakdown.push(`${participant.picks.zeroGoalDiff}: zero goal difference (+3)`);
  }

  return { ...participant, score, breakdown };
}

function selectOptions(exclude: string[], current?: string) {
  return TEAM_NAMES.filter((team) => !exclude.includes(team) || team === current);
}

export default function Page() {
  const [leagueTable, setLeagueTable] = useState<TeamRow[]>(DEFAULT_LEAGUE_TABLE);
  const [participants, setParticipants] = useState<Participant[]>(DEFAULT_PARTICIPANTS);
  const [saved, setSaved] = useState(false);
  const [entry, setEntry] = useState<Picks & { username: string }>({
    username: "",
    top5: ["", "", "", "", ""],
    bottom5: ["", "", "", "", ""],
    wildcardTeam: "",
    wildcardPosition: "",
    mostCards: "",
    managerSacked: "",
    zeroGoalDiff: "",
  });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.leagueTable) setLeagueTable(parsed.leagueTable);
      if (parsed.participants) setParticipants(parsed.participants);
    } catch {
      // ignore bad local data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leagueTable, participants }));
  }, [leagueTable, participants]);

  const table = useMemo(() => computeTable(leagueTable), [leagueTable]);

  const leaderboard = useMemo(() => {
    return participants
      .map((participant) => scoreParticipant(participant, table))
      .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  }, [participants, table]);

  const zeroGdTeams = table.filter((team) => team.gd === 0).map((team) => team.team);
  const cardsLeader = table.find((team) => team.mostCardsLeader)?.team ?? "—";
  const sackedTeam = table.find((team) => team.managerSacked)?.team ?? "—";

  function saveNow() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leagueTable, participants }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function updateRow(team: string, field: keyof TeamRow, value: string | boolean) {
    setLeagueTable((current) =>
      current.map((row) => {
        if (row.team !== team) return row;
        if (typeof value === "boolean") return { ...row, [field]: value };
        return { ...row, [field]: Number(value) } as TeamRow;
      })
    );
  }

  function setExclusiveFlag(team: string, field: "mostCardsLeader" | "managerSacked") {
    setLeagueTable((current) =>
      current.map((row) => ({
        ...row,
        [field]: row.team === team,
      }))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const allSelected = [
      ...entry.top5,
      ...entry.bottom5,
      entry.wildcardTeam,
      entry.mostCards,
      entry.managerSacked,
      entry.zeroGoalDiff,
    ].filter(Boolean);

    if (!entry.username.trim()) {
      alert("Please enter a username.");
      return;
    }

    if (entry.top5.some((pick) => !pick) || entry.bottom5.some((pick) => !pick)) {
      alert("Please complete all top 5 and bottom 5 picks.");
      return;
    }

    if (!entry.wildcardTeam || !entry.wildcardPosition || !entry.mostCards || !entry.managerSacked || !entry.zeroGoalDiff) {
      alert("Please complete all special picks.");
      return;
    }

    if (new Set(allSelected).size !== allSelected.length) {
      alert("Each pick must be a different team.");
      return;
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
    });
  }

  function resetDemo() {
    setLeagueTable(DEFAULT_LEAGUE_TABLE);
    setParticipants(DEFAULT_PARTICIPANTS);
  }

  function removeParticipant(id: string) {
    setParticipants((current) => current.filter((person) => person.id !== id));
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            Friends Fantasy Premier League Tracker
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Premier League picks tracker</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Hardcoded teams and sample data for now. Update the league table manually, then watch the friend leaderboard score itself automatically.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={saveNow} className="rounded-2xl bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800">
              {saved ? "Saved" : "Save"}
            </button>
            <button onClick={resetDemo} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-50">
              Reset demo data
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Participants</div>
            <div className="mt-2 text-3xl font-bold">{participants.length}</div>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Most cards leader</div>
            <div className="mt-2 text-xl font-semibold">{cardsLeader}</div>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Manager sacked</div>
            <div className="mt-2 text-xl font-semibold">{sackedTeam}</div>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Zero goal difference</div>
            <div className="mt-2 text-xl font-semibold">{zeroGdTeams.length ? zeroGdTeams.join(", ") : "No team right now"}</div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">League table</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="px-2 py-3">#</th>
                    <th className="px-2 py-3">Team</th>
                    <th className="px-2 py-3 text-center">P</th>
                    <th className="px-2 py-3 text-center">W</th>
                    <th className="px-2 py-3 text-center">D</th>
                    <th className="px-2 py-3 text-center">L</th>
                    <th className="px-2 py-3 text-center">GD</th>
                    <th className="px-2 py-3 text-center">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row) => (
                    <tr key={row.team} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-2 py-3 font-medium">{row.position}</td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{row.team}</span>
                          {row.mostCardsLeader && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Cards</span>}
                          {row.managerSacked && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Sacked</span>}
                          {row.gd === 0 && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">GD 0</span>}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">{row.played}</td>
                      <td className="px-2 py-3 text-center">{row.wins}</td>
                      <td className="px-2 py-3 text-center">{row.draws}</td>
                      <td className="px-2 py-3 text-center">{row.losses}</td>
                      <td className="px-2 py-3 text-center">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                      <td className="px-2 py-3 text-center font-semibold">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Friend leaderboard</h2>
            <div className="space-y-4">
              {leaderboard.map((person, index) => (
                <div key={person.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-slate-500">#{index + 1}</div>
                      <div className="text-lg font-semibold">{person.username}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-900 px-3 py-2 text-lg font-bold text-white">{person.score} pts</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2 py-1">Wildcard: {person.picks.wildcardTeam} {person.picks.wildcardPosition}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">Cards: {person.picks.mostCards}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">Sacked: {person.picks.managerSacked}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">GD 0: {person.picks.zeroGoalDiff}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    {person.breakdown.length ? person.breakdown.map((item) => <div key={item}>• {item}</div>) : <div>No live points right now.</div>}
                  </div>
                  <button
                    onClick={() => removeParticipant(person.id)}
                    className="mt-4 rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Submit a participant's season picks</h2>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="mb-2 block text-sm font-medium">Username</label>
              <input
                value={entry.username}
                onChange={(e) => setEntry((current) => ({ ...current, username: e.target.value }))}
                className="w-full max-w-md rounded-2xl border border-slate-300 px-4 py-2 outline-none ring-0 focus:border-slate-500"
                placeholder="Enter username"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <h3 className="mb-4 text-lg font-semibold">Top 5 picks</h3>
                <div className="space-y-3">
                  {entry.top5.map((value, index) => {
                    const exclude = entry.top5.filter((team, i) => i !== index && team).concat(entry.bottom5.filter(Boolean), [entry.wildcardTeam, entry.mostCards, entry.managerSacked, entry.zeroGoalDiff].filter(Boolean));
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
                <h3 className="mb-4 text-lg font-semibold">Bottom 5 picks</h3>
                <div className="space-y-3">
                  {entry.bottom5.map((value, index) => {
                    const exclude = entry.bottom5.filter((team, i) => i !== index && team).concat(entry.top5.filter(Boolean), [entry.wildcardTeam, entry.mostCards, entry.managerSacked, entry.zeroGoalDiff].filter(Boolean));
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
                <h3 className="mb-4 text-lg font-semibold">Wildcard pick</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Team</label>
                    <select
                      value={entry.wildcardTeam}
                      onChange={(e) => setEntry((current) => ({ ...current, wildcardTeam: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                    >
                      <option value="">Select team</option>
                      {selectOptions(entry.top5.filter(Boolean).concat(entry.bottom5.filter(Boolean), [entry.mostCards, entry.managerSacked, entry.zeroGoalDiff].filter(Boolean)), entry.wildcardTeam).map((team) => (
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
                        <option key={pos} value={String(pos)}>{pos}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <h3 className="mb-4 text-lg font-semibold">Special picks</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Most cards</label>
                    <select
                      value={entry.mostCards}
                      onChange={(e) => setEntry((current) => ({ ...current, mostCards: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                    >
                      <option value="">Select team</option>
                      {selectOptions(entry.top5.filter(Boolean).concat(entry.bottom5.filter(Boolean), [entry.wildcardTeam, entry.managerSacked, entry.zeroGoalDiff].filter(Boolean)), entry.mostCards).map((team) => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Manager sacked</label>
                    <select
                      value={entry.managerSacked}
                      onChange={(e) => setEntry((current) => ({ ...current, managerSacked: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                    >
                      <option value="">Select team</option>
                      {selectOptions(entry.top5.filter(Boolean).concat(entry.bottom5.filter(Boolean), [entry.wildcardTeam, entry.mostCards, entry.zeroGoalDiff].filter(Boolean)), entry.managerSacked).map((team) => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Zero goal differential</label>
                    <select
                      value={entry.zeroGoalDiff}
                      onChange={(e) => setEntry((current) => ({ ...current, zeroGoalDiff: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                    >
                      <option value="">Select team</option>
                      {selectOptions(entry.top5.filter(Boolean).concat(entry.bottom5.filter(Boolean), [entry.wildcardTeam, entry.mostCards, entry.managerSacked].filter(Boolean)), entry.zeroGoalDiff).map((team) => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800">
              Add participant
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">League admin</h2>
          <p className="mb-4 text-sm text-slate-600">
            Edit the raw table values below. Position, points, and goal difference update automatically.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-2 py-3">Team</th>
                  <th className="px-2 py-3">P</th>
                  <th className="px-2 py-3">W</th>
                  <th className="px-2 py-3">D</th>
                  <th className="px-2 py-3">L</th>
                  <th className="px-2 py-3">GF</th>
                  <th className="px-2 py-3">GA</th>
                  <th className="px-2 py-3">Most cards</th>
                  <th className="px-2 py-3">Manager sacked</th>
                </tr>
              </thead>
              <tbody>
                {leagueTable.map((row) => (
                  <tr key={row.team} className="border-b last:border-0">
                    <td className="px-2 py-3 font-medium">{row.team}</td>
                    {(["played", "wins", "draws", "losses", "gf", "ga"] as const).map((field) => (
                      <td key={field} className="px-2 py-3">
                        <input
                          type="number"
                          min="0"
                          value={row[field]}
                          onChange={(e) => updateRow(row.team, field, e.target.value)}
                          className="w-20 rounded-xl border border-slate-300 px-2 py-1.5"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.mostCardsLeader}
                          onChange={() => setExclusiveFlag(row.team, "mostCardsLeader")}
                        />
                        Leader
                      </label>
                    </td>
                    <td className="px-2 py-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.managerSacked}
                          onChange={() => setExclusiveFlag(row.team, "managerSacked")}
                        />
                        Sacked
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
