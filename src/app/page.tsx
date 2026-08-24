import { listDailyNotes } from "@/services/list-daily-notes.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import { formatLocalDate, todayDateString } from "@/lib/format";
import { noteDto } from "@/lib/note-dto";
import { TodayScreen } from "@/components/TodayScreen";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function TodayPage({ searchParams }: PageProps) {
  const { date: requested } = await searchParams;
  const today = todayDateString();
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;

  const deps = getNoteServiceDeps();
  const result = await listDailyNotes(deps, { date });
  const notes = result.notes.map(noteDto);
  const timezone = result.timezone;

  return (
    <TodayScreen
      date={date}
      today={today}
      timezone={timezone}
      initialNotes={notes}
    />
  );
}
