import { mockDeep } from "jest-mock-extended";
import type { PrismaClient, Prisma } from "../generated/prisma/client";
import { anonymizeMembers } from "./anonymize-members";

describe("anonymizeMembers", () => {
  const prisma = mockDeep<PrismaClient>();
  const transaction = mockDeep<Prisma.TransactionClient>();

  beforeEach(() => {
    jest.resetAllMocks();
    const runTransaction = async <Result>(
      callback: (client: Prisma.TransactionClient) => Promise<Result>,
    ): Promise<Result> => await callback(transaction);
    prisma.$transaction.mockImplementation(
      runTransaction as PrismaClient["$transaction"],
    );
  });

  it("hashes identities and leaves all other member data unchanged", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "member-1",
        email: "anna@example.org",
        firstName: "Anna",
        lastName: "Müller",
      },
      {
        id: "member-2",
        email: "other@example.org",
        firstName: "Anna",
        lastName: "Müller",
      },
    ]);
    expect(await anonymizeMembers(prisma)).toBe(2);
    expect(transaction.member.update).toHaveBeenCalledTimes(2);
    const first = transaction.member.update.mock.calls[0][0];
    const second = transaction.member.update.mock.calls[1][0];
    expect(first).toEqual({
      where: { id: "member-1" },
      data: {
        email:
          "a3bf86238a1c59bd2f0a648af9293620f90d18dad133d8fe2341cf9664a5d6d0",
        firstName:
          "94666c8824a80401cc53f85069615b39616d05058ffb1e36beb7093e1bbaf409",
        lastName:
          "94666c8824a80401cc53f85069615b39616d05058ffb1e36beb7093e1bbaf409",
      },
    });
    expect(second.data.firstName).toBe(first.data.firstName);
    expect(second.data.email).not.toBe(first.data.email);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 120_000,
    });
  });

  it("handles an empty table", async () => {
    transaction.$queryRaw.mockResolvedValue([]);
    expect(await anonymizeMembers(prisma)).toBe(0);
    expect(transaction.member.update).not.toHaveBeenCalled();
  });

  it("propagates update failure so the database rolls back the transaction", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "member-1",
        email: "anna@example.org",
        firstName: "Anna",
        lastName: "Müller",
      },
      {
        id: "member-2",
        email: "other@example.org",
        firstName: "Other",
        lastName: "Member",
      },
    ]);
    transaction.member.update.mockRejectedValueOnce(new Error("Update failed"));
    await expect(anonymizeMembers(prisma)).rejects.toThrow("Update failed");
    expect(transaction.member.update).toHaveBeenCalledTimes(1);
  });
});
