# archivedia

Frictionless daily capture for fleeting notes. One screen, keyboard-first,
PostgreSQL-backed. v0.1 ships the minimum useful product: capture, browse by day,
view, edit, delete, and a health endpoint.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 (PostCSS plugin)
- Prisma 6 + PostgreSQL
- Zod for request validation
- Vitest for tests

## Quick start (local dev against the homelab Postgres)

```bash
cp .env.example .env       # adjust DATABASE_URL to your Postgres
npm install
npx prisma migrate deploy   # creates the notes table
npm run dev                 # http://localhost:3000
```

The health endpoint at `GET /api/v1/health` reports whether Postgres is reachable.

## Architecture

```
src/
  app/                Next.js App Router pages + /api/v1 route handlers
  controllers/        HTTP concerns: parsing, validation glue, status codes
  services/           Business rules (create / list / update / delete)
  repositories/       Persistence interface + Postgres + in-memory fake
  schemas/            Zod request schemas
  domain/             Note entity + status enum
  errors/             AppError + canonical JSON error handler
  lib/                Cross-cutting helpers (db, public-note-id, day range)
  components/         React UI (CaptureForm, NoteEditor, DateNav, …)
```

Server components call services directly. The HTTP layer exists for external
consumers and the documented `/api/v1/*` contract.

## API

| Method | Path                              | Purpose                          |
|--------|-----------------------------------|----------------------------------|
| POST   | `/api/v1/notes`                   | Create a note                    |
| GET    | `/api/v1/notes?date=YYYY-MM-DD`   | List notes for a day             |
| GET    | `/api/v1/notes/:id`               | Fetch one note                   |
| PATCH  | `/api/v1/notes/:id`               | Update content                   |
| DELETE | `/api/v1/notes/:id`               | Soft-delete                      |
| GET    | `/api/v1/health`                  | Service + DB health              |

Errors return a consistent shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { ... } } }
```

## Tests

```bash
npm test
```

20 unit tests cover the public id generator, day-range math, Zod schemas, and
the full service stack against an in-memory fake repository.

## Deployment

```bash
docker compose build
docker compose up -d
```

The compose file reuses the homelab Postgres defined in `.env` and does not
spin up its own database.

### Backups

Daily `pg_dump`, retention, and quarterly restore drills are documented in
[`docs/backup.md`](docs/backup.md).
