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

const STORAGE_KEY = "fpl-friends-tracker-v2";

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

function toEditableRows(standings: ApiStandingRow[]): TeamRow[] {
  return standings.map((row) => {
    // We only know played/gf/ga/gd/points from the source page.
    // W/D/L are approximated only so your admin table still has values.
    return {
      team: row.team,
      played: row.played,
      wins: 0,
      draws: row.points,
      losses: Math.max(0, row.played - row.points),
      gf: row.gf,
      ga: row.ga,
      managerSacked: false,
      mostCardsLeader: false,
    };
  });
}

export default function Page() {
  const [leagueTable, setLeagueTable] = useState<TeamRow[]>([]);
  const [participants, setParticipants] = useState<Participant[]>(DEFAULT_PARTICIPANTS);
  const [saved, setSaved] = useState(false);
  const [loadingTable, setLoadingTable] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);

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
      if (parsed.participants) setParticipants(parsed.participants);
      if (parsed.specialFlags && Array.isArray(parsed.specialFlags)) {
        setLeagueTable((current) =>
          current.map((row) => {
            const found = parsed.specialFlags.find((x: any) => x.team === row.team);
            return found
              ? {
                  ...row,
                  managerSacked: !!found.managerSacked,
                  mostCardsLeader: !!found.mostCardsLeader,
                }
              : row;
          })
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    async function loadStandings() {
      try {
        setLoadingTable(true);
        setTableError(null);

        const res = await fetch("/api/standings", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load standings");
        }

        const savedRaw = localStorage.getItem(STORAGE_KEY);
        let specialFlags: { team: string; managerSacked: boolean; mostCardsLeader: boolean }[] = [];

        if (savedRaw) {
          try {
            const parsed = JSON.parse(savedRaw);
            specialFlags = parsed.specialFlags || [];
          } catch {}
        }

        const baseRows = toEditableRows(data.standings).map((row) => {
          const saved = specialFlags.find((x) => x.team === row.team);
          return {
            ...row,
            managerSacked: saved?.managerSacked ?? false,
            mostCardsLeader: saved?.mostCardsLeader ?? false,
          };
        });

        setLeagueTable(baseRows);
      } catch (err) {
        setTableError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoadingTable(false);
      }
    }

    loadStandings();
  }, []);

  useEffect(() => {
    if (!leagueTable.length) return;
    const specialFlags = leagueTable.map((row) => ({
      team: row.team,
      managerSacked: row.managerSacked,
      mostCardsLeader: row.mostCardsLeader,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ participants, specialFlags }));
  }, [participants, leagueTable]);

  const table = useMemo(() => {
    if (!leagueTable.length) return [];
    return leagueTable
      .map((row) => ({
        ...row,
        gd: row.gf - row.ga,
        points: row.gf === 0 && row.ga === 0 ? 0 : row.played ? row.draws : 0,
      }))
      .sort((a, b) => 0);
  }, [leagueTable]);

  const displayTable = useMemo(() => {
    return [...leagueTable]
      .map((row) => ({
        ...row,
        gd: row.gf - row.ga,
        points:
          row.wins === 0 && row.losses === Math.max(0, row.played - row.draws)
            ? row.draws
            : row.wins * 3 + row.draws,
      }))
      .sort((a, b) => {
        const ap = a.wins * 3 + a.draws;
        const bp = b.wins * 3 + b.draws;
        if (bp !== ap) return bp - ap;
        const agd = a.gf - a.ga;
        const bgd = b.gf - b.ga;
        if (bgd !== agd) return bgd - agd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.team.localeCompare(b.team);
      })
      .map((row, index) => ({
        ...row,
        gd: row.gf - row.ga,
        points: row.wins * 3 + row.draws,
        position: index + 1,
      }));
  }, [leagueTable]);

  const leaderboard = useMemo(() => {
    return participants
      .map((participant) => scoreParticipant(participant, displayTable))
      .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  }, [participants, displayTable]);

  const zeroGdTeams = displayTable.filter((team) => team.gd === 0).map((team) => team.team);
  const cardsLeader = displayTable.find((team) => team.mostCardsLeader)?.team ?? "—";
  const sackedTeam = displayTable.find((team) => team.managerSacked)?.team ?? "—";

  function saveNow() {
    const specialFlags = leagueTable.map((row) => ({
      team: row.team,
      managerSacked: row.managerSacked,
      mostCardsLeader: row.mostCardsLeader,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ participants, specialFlags }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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

    if (!entry.username.trim()) return alert("Please enter a username.");
    if (entry.top5.some((pick) => !pick) || entry.bottom5.some((pick) => !pick)) {
      return alert("Please complete all top 5 and bottom 5 picks.");
    }
    if (!entry.wildcardTeam || !entry.wildcardPosition || !entry.mostCards || !entry.managerSacked || !entry.zeroGoalDiff) {
      return alert("Please complete all special picks.");
    }
    if (new Set(allSelected).size !== allSelected.length) {
      return alert("Each pick must be a different team.");
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
            Live standings are pulled from Native Stats through your own Next.js API route.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={saveNow} className="rounded-2xl bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800">
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        {loadingTable && (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">Loading live table…</div>
        )}

        {tableError && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-red-700 shadow-sm">
            Could not load standings: {tableError}
          </div>
        )}

        {!!displayTable.length && (
          <>
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
                          <td className="px-2 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{row.team}</span>
                              {row.mostCardsLeader && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Cards</span>}
                              {row.managerSacked && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Sacked</span>}
                              {row.gd === 0 && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">GD 0</span>}
                            </div>
                          </td>
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
                <h2 className="mb-4 text-xl font-semibold">Friend leaderboard</h2>
                <div className="space-y-4">
                  {leaderboard.map((person, index) => (
                    <div key={person.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm text-slate-500">#{index + 1}</div>
                          <div className="text-lg font-semibold">{person.username}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-900 px-3 py-2 text-lg font-bold text-white">
                          {person.score} pts
                        </div>
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
          </>
        )}
      </div>
    </main>
  );
}