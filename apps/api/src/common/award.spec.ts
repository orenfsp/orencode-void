import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { awardDates } from "./award";
import { AthletesService } from "../athletes/athletes.service";
import { PrismaService } from "./prisma.service";
describe("award validity", () => {
  it("does not invent award dates or an order", () => {
    expect(() => awardDates()).toThrow();
    expect(() =>
      awardDates({ assignedAt: "2026-01-01", expiresAt: "2027-01-01" }),
    ).toThrow();
  });
  it("rejects reversed and invalid dates", () => {
    for (const expiresAt of ["2025-01-01", "bad-date", "2026-01-01"])
      expect(() =>
        awardDates({ assignedAt: "2026-01-01", expiresAt, orderNumber: "1" }),
      ).toThrow();
  });
  it("uses the explicit dates from the issuing order", () => {
    expect(
      awardDates({
        assignedAt: "2026-01-01",
        expiresAt: "2026-06-01",
        orderNumber: " 1 ",
      }).orderNumber,
    ).toBe("1");
  });
  it("does not show expired or future ranks as current", () => {
    const service = new AthletesService({} as PrismaService);
    const now = new Date("2026-10-27");
    expect(
      service.currentRank(
        [
          {
            rankType: "Истёкший",
            assignedAt: new Date("2024-01-01"),
            expiresAt: new Date("2026-01-01"),
          },
          {
            rankType: "Будущий",
            assignedAt: new Date("2027-01-01"),
            expiresAt: new Date("2028-01-01"),
          },
        ],
        now,
      ),
    ).toBeNull();
  });
});
