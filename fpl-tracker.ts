import React, { useEffect, useMemo, useState } from "react";
import { Trophy, Users, Shield, Save, Plus, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

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

const STORAGE_KEY = "friends-fantasy-prem-table-v1";

const defaultLeagueTable = [
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

const defaultParticipants = [
  {
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
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

function computeDerivedTable(table) {
  const withStats = table.map((row) => {
    const gd = row.gf - row.ga;
    const points = row.wins * 3 + row.draws;
    return { ...row, gd, points };
  });

  return [...withStats]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    })
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function scoreParticipant(participant, table) {
  let score = 0;
  const breakdown = [];
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

  const wildcardCurrentPosition = positionMap[participant.picks.wildcardTeam];
  if (wildcardCurrentPosition === Number(participant.picks.wildcardPosition)) {
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

  const zeroGdHit = table.find((row) => row.team === participant.picks.zeroGoalDiff && row.gd === 0);
  if (zeroGdHit) {
    score += 3;
    breakdown.push(`${participant.picks.zeroGoalDiff}: zero goal difference (+3)`);
  }

  return {
    ...participant,
    score,
    breakdown,
  };
}

function SelectTeam({ value, onChange, exclude = [] }) {
  const options = TEAM_NAMES.filter((team) => !exclude.includes(team) || team === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select team" />
      </SelectTrigger>
      <SelectContent>
        {options.map((team) => (
          <SelectItem key={team} value={team}>
            {team}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function FantasyPremierLeagueTracker() {
  const [leagueTable, setLeagueTable] = useState(defaultLeagueTable);
  const [participants, setParticipants] = useState(defaultParticipants);
  const [saved, setSaved] = useState(false);
  const [newEntry, setNewEntry] = useState({
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
    if (raw) {
      const parsed = JSON.parse(raw);
      setLeagueTable(parsed.leagueTable || defaultLeagueTable);
      setParticipants(parsed.participants || defaultParticipants);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leagueTable, participants }));
  }, [leagueTable, participants]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(timer);
  }, [saved]);

  const sortedTable = useMemo(() => computeDerivedTable(leagueTable), [leagueTable]);

  const scoredParticipants = useMemo(() => {
    return participants
      .map((participant) => scoreParticipant(participant, sortedTable))
      .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  }, [participants, sortedTable]);

  const cardsLeader = sortedTable.find((row) => row.mostCardsLeader)?.team || "—";
  const sackedTeam = sortedTable.find((row) => row.managerSacked)?.team || "—";
  const zeroGdTeams = sortedTable.filter((row) => row.gd === 0).map((row) => row.team);

  function updateLeagueRow(team, key, value) {
    setLeagueTable((current) =>
      current.map((row) => {
        if (row.team !== team) return row;

        if (key === "mostCardsLeader") {
          return { ...row, mostCardsLeader: value };
        }

        if (key === "managerSacked") {
          return { ...row, managerSacked: value };
        }

        return { ...row, [key]: Number(value) };
      })
    );
  }

  function setExclusiveFlag(team, key) {
    setLeagueTable((current) =>
      current.map((row) => ({
        ...row,
        [key]: row.team === team,
      }))
    );
  }

  function handleSubmit(e) {
    e.preventDefault();

    const allSelectedTeams = [
      ...newEntry.top5,
      ...newEntry.bottom5,
      newEntry.wildcardTeam,
      newEntry.mostCards,
      newEntry.managerSacked,
      newEntry.zeroGoalDiff,
    ].filter(Boolean);

    if (!newEntry.username.trim()) {
      alert("Please enter a username.");
      return;
    }

    if (newEntry.top5.some((v) => !v) || newEntry.bottom5.some((v) => !v)) {
      alert("Please complete all top 5 and bottom 5 picks.");
      return;
    }

    if (!newEntry.wildcardTeam || !newEntry.wildcardPosition || !newEntry.mostCards || !newEntry.managerSacked || !newEntry.zeroGoalDiff) {
      alert("Please complete all special picks.");
      return;
    }

    if (new Set(allSelectedTeams).size !== allSelectedTeams.length) {
      alert("Each pick must be a different team. Remove duplicates before submitting.");
      return;
    }

    setParticipants((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        username: newEntry.username.trim(),
        picks: {
          top5: newEntry.top5,
          bottom5: newEntry.bottom5,
          wildcardTeam: newEntry.wildcardTeam,
          wildcardPosition: newEntry.wildcardPosition,
          mostCards: newEntry.mostCards,
          managerSacked: newEntry.managerSacked,
          zeroGoalDiff: newEntry.zeroGoalDiff,
        },
      },
    ]);

    setNewEntry({
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

  function removeParticipant(id) {
    setParticipants((current) => current.filter((participant) => participant.id !== id));
  }

  function resetDemoData() {
    setLeagueTable(defaultLeagueTable);
    setParticipants(defaultParticipants);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leagueTable, participants }));
    setSaved(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              <Shield className="h-4 w-4" /> Friends Fantasy Premier League Tracker
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Season picks, live table, and friend leaderboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
              Manually update the league table, then let the app automatically score everyone based on your custom rules.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveState} className="rounded-2xl">
              <Save className="mr-2 h-4 w-4" /> {saved ? "Saved" : "Save"}
            </Button>
            <Button variant="outline" onClick={resetDemoData} className="rounded-2xl">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset demo data
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm text-slate-500">Participants</div>
              <div className="mt-2 flex items-center gap-2 text-3xl font-bold text-slate-900">
                <Users className="h-7 w-7" /> {participants.length}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm text-slate-500">Most cards leader</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{cardsLeader}</div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm text-slate-500">Manager sacked</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{sackedTeam}</div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="text-sm text-slate-500">Zero goal difference</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{zeroGdTeams.length ? zeroGdTeams.join(", ") : "No team right now"}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-white p-1 shadow-sm">
            <TabsTrigger value="overview" className="rounded-2xl">Overview</TabsTrigger>
            <TabsTrigger value="picks" className="rounded-2xl">Submit Picks</TabsTrigger>
            <TabsTrigger value="admin" className="rounded-2xl">League Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Trophy className="h-5 w-5" /> Premier League table
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                        {sortedTable.map((row) => (
                          <tr key={row.team} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="px-2 py-3 font-medium text-slate-700">{row.position}</td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">{row.team}</span>
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
                            <td className="px-2 py-3 text-center font-semibold text-slate-900">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Users className="h-5 w-5" /> Friend leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {scoredParticipants.map((person, index) => (
                      <div key={person.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm text-slate-500">#{index + 1}</div>
                            <div className="text-lg font-semibold text-slate-900">{person.username}</div>
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
                          {person.breakdown.length ? (
                            person.breakdown.map((item) => <div key={item}>• {item}</div>)
                          ) : (
                            <div>No live points right now.</div>
                          )}
                        </div>
                        <div className="mt-4">
                          <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => removeParticipant(person.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="picks">
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Plus className="h-5 w-5" /> Submit a friend's season picks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      placeholder="Enter username"
                      value={newEntry.username}
                      onChange={(e) => setNewEntry((current) => ({ ...current, username: e.target.value }))}
                      className="max-w-md rounded-2xl"
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4 rounded-3xl bg-slate-50 p-4">
                      <h3 className="text-lg font-semibold text-slate-900">Top 5 picks</h3>
                      {newEntry.top5.map((value, index) => {
                        const exclude = newEntry.top5.filter((team, i) => i !== index && team)
                          .concat(newEntry.bottom5.filter(Boolean), [newEntry.wildcardTeam, newEntry.mostCards, newEntry.managerSacked, newEntry.zeroGoalDiff].filter(Boolean));
                        return (
                          <div key={`top-${index}`} className="space-y-2">
                            <Label>{index + 1}st/nd/rd/th place</Label>
                            <SelectTeam
                              value={value}
                              exclude={exclude}
                              onChange={(team) => {
                                const next = [...newEntry.top5];
                                next[index] = team;
                                setNewEntry((current) => ({ ...current, top5: next }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-4 rounded-3xl bg-slate-50 p-4">
                      <h3 className="text-lg font-semibold text-slate-900">Bottom 5 picks</h3>
                      {newEntry.bottom5.map((value, index) => {
                        const exclude = newEntry.bottom5.filter((team, i) => i !== index && team)
                          .concat(newEntry.top5.filter(Boolean), [newEntry.wildcardTeam, newEntry.mostCards, newEntry.managerSacked, newEntry.zeroGoalDiff].filter(Boolean));
                        return (
                          <div key={`bottom-${index}`} className="space-y-2">
                            <Label>{index + 16}th place</Label>
                            <SelectTeam
                              value={value}
                              exclude={exclude}
                              onChange={(team) => {
                                const next = [...newEntry.bottom5];
                                next[index] = team;
                                setNewEntry((current) => ({ ...current, bottom5: next }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl bg-slate-50 p-4 space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900">Wildcard pick</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Team</Label>
                          <SelectTeam
                            value={newEntry.wildcardTeam}
                            exclude={newEntry.top5.filter(Boolean).concat(newEntry.bottom5.filter(Boolean), [newEntry.mostCards, newEntry.managerSacked, newEntry.zeroGoalDiff].filter(Boolean))}
                            onChange={(team) => setNewEntry((current) => ({ ...current, wildcardTeam: team }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Position</Label>
                          <Select value={newEntry.wildcardPosition} onValueChange={(value) => setNewEntry((current) => ({ ...current, wildcardPosition: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 20 }, (_, i) => i + 1).map((pos) => (
                                <SelectItem key={pos} value={String(pos)}>{pos}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-50 p-4 space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900">Special picks</h3>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Most cards</Label>
                          <SelectTeam value={newEntry.mostCards} exclude={newEntry.top5.filter(Boolean).concat(newEntry.bottom5.filter(Boolean), [newEntry.wildcardTeam, newEntry.managerSacked, newEntry.zeroGoalDiff].filter(Boolean))} onChange={(team) => setNewEntry((current) => ({ ...current, mostCards: team }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Manager sacked</Label>
                          <SelectTeam value={newEntry.managerSacked} exclude={newEntry.top5.filter(Boolean).concat(newEntry.bottom5.filter(Boolean), [newEntry.wildcardTeam, newEntry.mostCards, newEntry.zeroGoalDiff].filter(Boolean))} onChange={(team) => setNewEntry((current) => ({ ...current, managerSacked: team }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Zero goal differential</Label>
                          <SelectTeam value={newEntry.zeroGoalDiff} exclude={newEntry.top5.filter(Boolean).concat(newEntry.bottom5.filter(Boolean), [newEntry.wildcardTeam, newEntry.mostCards, newEntry.managerSacked].filter(Boolean))} onChange={(team) => setNewEntry((current) => ({ ...current, zeroGoalDiff: team }))} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="rounded-2xl">Add participant</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin">
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Update league table and special flags</CardTitle>
              </CardHeader>
              <CardContent>
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
                          <td className="px-2 py-3 font-medium text-slate-900">{row.team}</td>
                          {[
                            ["played", row.played],
                            ["wins", row.wins],
                            ["draws", row.draws],
                            ["losses", row.losses],
                            ["gf", row.gf],
                            ["ga", row.ga],
                          ].map(([key, value]) => (
                            <td key={key} className="px-2 py-3">
                              <Input
                                type="number"
                                min="0"
                                value={value}
                                onChange={(e) => updateLeagueRow(row.team, key, e.target.value)}
                                className="w-20 rounded-xl"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2">
                              <Checkbox checked={row.mostCardsLeader} onCheckedChange={() => setExclusiveFlag(row.team, "mostCardsLeader")} />
                              <span>Leader</span>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2">
                              <Checkbox checked={row.managerSacked} onCheckedChange={() => setExclusiveFlag(row.team, "managerSacked")} />
                              <span>Sacked</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm text-slate-500">
                  Goal difference and points are calculated automatically from GF, GA, wins, and draws. Zero goal difference is also automatic.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
