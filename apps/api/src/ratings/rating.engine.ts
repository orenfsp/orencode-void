import { STABILITY_COEFFICIENT, STABILITY_MIN_PRIZE_EVENTS } from "@fsp/shared";

export type RatingInputResult = {
  competitionId: string;
  resultId: string;
  place: number;
  band: string;
};

export type RatingRuleInput = {
  band: string;
  place: number;
  points: number;
};

export type RatingComputation = {
  excluded: boolean;
  prizeCount: number;
  stabilityApplied: boolean;
  totalPoints: number;
  entries: Array<{
    competitionId: string;
    resultId: string;
    basePoints: number;
    coefficient: number;
    finalPoints: number;
  }>;
};

export function computeSeasonRating(
  results: RatingInputResult[],
  rules: RatingRuleInput[],
  disqualified: boolean,
): RatingComputation {
  if (disqualified) {
    return {
      excluded: true,
      prizeCount: 0,
      stabilityApplied: false,
      totalPoints: 0,
      entries: [],
    };
  }

  const prizeCount = results.filter(
    (item) => item.place >= 1 && item.place <= 3,
  ).length;
  const stabilityApplied = prizeCount >= STABILITY_MIN_PRIZE_EVENTS;
  const coefficient = stabilityApplied ? STABILITY_COEFFICIENT : 1;

  const entries = results.map((item) => {
    const rule = rules.find(
      (ruleItem) =>
        ruleItem.band === item.band && ruleItem.place === item.place,
    );
    const basePoints = rule?.points ?? 0;
    return {
      competitionId: item.competitionId,
      resultId: item.resultId,
      basePoints,
      coefficient,
      finalPoints: Number((basePoints * coefficient).toFixed(3)),
    };
  });

  const totalPoints = Number(
    entries.reduce((sum, item) => sum + item.finalPoints, 0).toFixed(3),
  );
  return {
    excluded: false,
    prizeCount,
    stabilityApplied,
    totalPoints,
    entries,
  };
}

export function assignPlaces(scores: Array<{ id: string; score: number }>) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const places = new Map<string, number>();
  let index = 0;
  while (index < sorted.length) {
    const score = sorted[index].score;
    let run = 1;
    while (index + run < sorted.length && sorted[index + run].score === score) {
      run += 1;
    }
    const place = index + 1;
    for (let offset = 0; offset < run; offset += 1) {
      places.set(sorted[index + offset].id, place);
    }
    index += run;
  }
  return places;
}

export function ageOnDate(birthDate: Date, on: Date) {
  let age = on.getFullYear() - birthDate.getFullYear();
  const month = on.getMonth() - birthDate.getMonth();
  if (month < 0 || (month === 0 && on.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}
