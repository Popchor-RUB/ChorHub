import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../generated/prisma/client';

export type MockPrisma = DeepMockProxy<PrismaClient>;

export async function createTestModule(
  providers: any[],
): Promise<{ module: TestingModule; prismaMock: MockPrisma }> {
  const prismaMock = mockDeep<PrismaClient>();
  const module = await Test.createTestingModule({ providers })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .compile();
  return { module, prismaMock };
}
