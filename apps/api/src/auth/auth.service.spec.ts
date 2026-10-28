import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";
import { PrismaService } from "../common/prisma.service";
import { AuthUser } from "./auth.types";

const user: AuthUser = {
  id: "u",
  email: "demo@example.test",
  firstName: "Тест",
  lastName: "Тестов",
  middleName: null,
  roles: ["ATHLETE"],
  activeRole: "ATHLETE",
  sessionId: "s",
};
describe("server sessions", () => {
  it("stores a one-way token hash", () => {
    const service = new AuthService({} as PrismaService);
    expect(service.hashToken("secret")).not.toBe("secret");
    expect(service.hashToken("secret")).toHaveLength(64);
  });
  it("cannot switch into an unassigned role", async () => {
    const update = vi.fn();
    const service = new AuthService({
      session: { update },
    } as unknown as PrismaService);
    await expect(service.switchRole(user, "FEDERATION")).rejects.toThrow(
      "недоступна",
    );
    expect(update).not.toHaveBeenCalled();
  });
  it("revokes the current session on logout", async () => {
    const update = vi.fn().mockResolvedValue({});
    const service = new AuthService({
      session: { update },
    } as unknown as PrismaService);
    await service.logout(user);
    expect(update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
  });
  for (const reason of [
    "expired",
    "revoked",
    "inactive",
    "removed-role",
  ] as const) {
    it(`rejects ${reason} sessions`, async () => {
      const session = {
        id: "s",
        expiresAt: new Date(Date.now() + 10000),
        revokedAt: null as Date | null,
        activeRoleCode: "ATHLETE",
        user: {
          ...user,
          isActive: true,
          roles: [{ role: { code: "ATHLETE" } }],
        },
      };
      if (reason === "expired") session.expiresAt = new Date(0);
      if (reason === "revoked") session.revokedAt = new Date();
      if (reason === "inactive") session.user.isActive = false;
      if (reason === "removed-role") session.user.roles = [];
      const service = new AuthService({
        session: { findUnique: vi.fn().mockResolvedValue(session) },
      } as unknown as PrismaService);
      expect(await service.resolveSession("token")).toBeNull();
    });
  }
});
