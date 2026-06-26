import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../shared/db.js'

export async function getActiveDistrict() {
  return prisma.district.findFirst({ where: { is_active: true } })
}

export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export function parsePositiveIntegerQueryParam(value: unknown, fallback: number, max?: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback

  const integer = Math.trunc(parsed)
  if (integer < 1) return fallback

  return max === undefined ? integer : Math.min(integer, max)
}
