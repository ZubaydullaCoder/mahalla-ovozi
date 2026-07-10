// apps/server/src/mahallas/query.ts
import { prisma } from '../shared/db.js'

export async function queryMahallasForDistrict(districtId: number) {
  return prisma.mahalla.findMany({
    where: { district_id: districtId },
    select: { id: true, district_id: true, name: true },
  })
}
