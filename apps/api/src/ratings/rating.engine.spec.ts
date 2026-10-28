import { describe, expect, it } from "vitest";
import { ageOnDate, assignPlaces, computeSeasonRating } from "./rating.engine";

describe("computeSeasonRating", () => {
  const rules = [
    { band: "REGIONAL", place: 1, points: 40 },
    { band: "REGIONAL", place: 2, points: 30 },
    { band: "REGIONAL", place: 3, points: 20 },
  ];

  it("sums base points without stability for a single prize", () => {
    const result = computeSeasonRating(
      [{ competitionId: "c1", resultId: "r1", place: 1, band: "REGIONAL" }],
      rules,
      false,
    );
    expect(result.stabilityApplied).toBe(false);
    expect(result.totalPoints).toBe(40);
  });

  it("applies stability coefficient once for two prize finishes", () => {
    const result = computeSeasonRating(
      [
        { competitionId: "c1", resultId: "r1", place: 1, band: "REGIONAL" },
        { competitionId: "c2", resultId: "r2", place: 2, band: "REGIONAL" },
      ],
      rules,
      false,
    );
    expect(result.stabilityApplied).toBe(true);
    expect(result.totalPoints).toBe(84);
    const again = computeSeasonRating(
      [
        { competitionId: "c1", resultId: "r1", place: 1, band: "REGIONAL" },
        { competitionId: "c2", resultId: "r2", place: 2, band: "REGIONAL" },
      ],
      rules,
      false,
    );
    expect(again.totalPoints).toBe(result.totalPoints);
  });

  it("excludes disqualified athletes", () => {
    const result = computeSeasonRating(
      [{ competitionId: "c1", resultId: "r1", place: 1, band: "REGIONAL" }],
      rules,
      true,
    );
    expect(result.excluded).toBe(true);
    expect(result.totalPoints).toBe(0);
    expect(result.entries).toHaveLength(0);
  });
});

describe("assignPlaces", () => {
  it("keeps equal scores as ties without inventing a tie-break", () => {
    const places = assignPlaces([
      { id: "a", score: 100 },
      { id: "b", score: 100 },
      { id: "c", score: 80 },
    ]);
    expect(places.get("a")).toBe(1);
    expect(places.get("b")).toBe(1);
    expect(places.get("c")).toBe(3);
  });
});

describe("ageOnDate", () => {
  it("computes age on competition date", () => {
    expect(ageOnDate(new Date("2010-05-10"), new Date("2024-05-09"))).toBe(13);
    expect(ageOnDate(new Date("2010-05-10"), new Date("2024-05-10"))).toBe(14);
  });
});
