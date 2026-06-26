import { Prisma } from '../generated/prisma/client.js'

export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return isPrismaKnownRequestError(err, 'P2002')
}

export function isPrismaRecordNotFoundError(err: unknown): boolean {
  return isPrismaKnownRequestError(err, 'P2025')
}

function isPrismaKnownRequestError(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code
}
