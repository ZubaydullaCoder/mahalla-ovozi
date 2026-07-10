# Mahalla Ovozi Web

Frontend dashboard for Mahalla Ovozi.

## Stack

- React 18
- Vite
- TypeScript
- Ant Design
- React Query
- React Router

## Main routes

- `/login`
- `/`
- `/ops`

## Important rules

- User-facing dashboard strings must be Uzbek Cyrillic unless explicitly exempted.
- Keep strings centralized.
- Do not expose filtering-mode controls in the hokim/staff dashboard.
- Hokim lane is not a signal category.
- API types must not import from `apps/server` directly.

## Local commands

- `pnpm --filter mahalla-ovozi-web dev`
- `pnpm --filter mahalla-ovozi-web build`

## Testing

Use root test command:

- `pnpm test`
