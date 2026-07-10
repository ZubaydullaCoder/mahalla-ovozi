// apps/server/src/mahallas/mapper.ts

export function mapMahallaRow(row: { id: number; district_id: number; name: string }) {
  return {
    id: row.id,
    districtId: row.district_id,
    name: row.name,
  }
}
