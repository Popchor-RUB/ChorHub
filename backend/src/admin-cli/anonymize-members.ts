import { createHash } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client";

type MemberIdentity = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export async function anonymizeMembers(prisma: PrismaClient): Promise<number> {
  return prisma.$transaction(
    async (transaction) => {
      const members = await transaction.$queryRaw<MemberIdentity[]>`
        SELECT id, email, "firstName", "lastName" FROM members FOR UPDATE
      `;

      for (const member of members) {
        const nameHash = createHash("sha256")
          .update(`${member.firstName} ${member.lastName}`)
          .digest("hex");
        await transaction.member.update({
          where: { id: member.id },
          data: {
            email: createHash("sha256").update(member.email).digest("hex"),
            firstName: nameHash,
            lastName: nameHash,
          },
        });
      }

      return members.length;
    },
    { timeout: 120_000 },
  );
}
