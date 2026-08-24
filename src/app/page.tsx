import { listDailyNotes } from "@/services/list-daily-notes.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import { todayDateString } from "@/lib/format";
import { noteDto } from "@/lib/note-dto";
import { TodayScreen } from "@/components/TodayScreen";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    date?: string;
    q?: string;
    status?: string;
    tag?: string;
  }>;
}

const STATUS_VALUES = ["inbox", "permanent"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

function parseStatus(raw: string | undefined): StatusFilter | undefined {
  if (!raw) return undefined;
  return (STATUS_VALUES as readonly string[]).includes(raw) ? (raw as StatusFilter) : undefined;
}

export default async function TodayPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = todayDateString();
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const status = parseStatus(params.status);
  const q = typeof params.q === "string" && params.q.trim().length > 0 ? params.q.trim() : undefined;
  const tag = typeof params.tag === "string" && params.tag.trim().length > 0 ? params.tag.trim() : undefined;

  const deps = getNoteServiceDeps();
  const result = await listDailyNotes(deps, { date, status, q, tag });
  const notes = result.notes.map(noteDto);
  const timezone = result.timezone;

  return (
    <TodayScreen
      date={date}
      today={today}
      timezone={timezone}
      initialNotes={notes}
      activeFilters={{ q, status, tag }}
    />
  );
}
