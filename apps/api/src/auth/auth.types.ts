import { RoleCode } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  roles: RoleCode[];
  activeRole: RoleCode;
  sessionId: string;
  athleteId?: string;
  coachId?: string;
  judgeId?: string;
};
