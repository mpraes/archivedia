// Smoke test for the MariaDB migration of archivedia.
// Runs against the live Hostinger DB to confirm the PostgresNoteRepository
// round-trips JSON columns correctly and that the $queryRaw JSON_CONTAINS
// paths work end-to-end.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    throw new Error(msg);
  }
  console.log("  ✓", msg);
}

async function main(): Promise<void> {
  console.log("\n=== 1. Connect + introspect ===");
  const dbInfo = await prisma.$queryRaw<
    Array<{ version: string; db: string }>
  >`SELECT VERSION() AS version, DATABASE() AS db`;
  console.log("  Connected:", dbInfo[0]);

  console.log("\n=== 2. Note insert (String[] -> JSON) ===");
  const note = await prisma.note.create({
    data: {
      publicId: `smoke-${Date.now()}`,
      content: "first smoke note",
      tags: ["work", "urgent"] as unknown as object,
      linkedNoteIds: [] as unknown as object,
    },
  });
  assert(note.id.length === 36, `UUID generated (got ${note.id.length} chars)`);
  assert(Array.isArray(note.tags), "tags comes back as array");
  assert((note.tags as unknown[]).length === 2, "tags has 2 entries");
  console.log("  tags round-tripped as:", note.tags);

  console.log("\n=== 3. Note read (JSON -> String[]) ===");
  const fetched = await prisma.note.findUnique({ where: { id: note.id } });
  assert(fetched !== null, "fetched by id");
  assert(Array.isArray(fetched?.tags), "tags is array on read");
  assert(
    JSON.stringify(fetched?.tags) === JSON.stringify(["work", "urgent"]),
    `tags match inserted (got ${JSON.stringify(fetched?.tags)})`,
  );

  console.log("\n=== 4. JSON_CONTAINS — tag filter ($queryRaw path) ===");
  const taggedRows = await prisma.$queryRaw<
    Array<{ id: string; tags: unknown }>
  >`SELECT id, tags FROM notes WHERE JSON_CONTAINS(tags, ${JSON.stringify(["work"])}) AND deleted_at IS NULL`;
  assert(
    taggedRows.some((r) => r.id === note.id),
    "row is returned by tag=work JSON_CONTAINS query",
  );
  console.log("  matched rows:", taggedRows.length);

  console.log("\n=== 5. JSON_CONTAINS — backlinks ($queryRaw path) ===");
  const targetId = "smoke-target-001";
  const backlinkSource = await prisma.note.create({
    data: {
      publicId: `${targetId}`,
      content: "source note that links to target",
      tags: [] as unknown as object,
      linkedNoteIds: [targetId] as unknown as object,
    },
  });
  const backlinkRows = await prisma.$queryRaw<
    Array<{ id: string; linked_note_ids: unknown }>
  >`SELECT id, linked_note_ids FROM notes WHERE JSON_CONTAINS(linked_note_ids, ${JSON.stringify([targetId])}) AND deleted_at IS NULL`;
  assert(
    backlinkRows.some((r) => r.id === backlinkSource.id),
    "source is returned by JSON_CONTAINS backlinks query",
  );
  console.log("  matched rows:", backlinkRows.length);

  console.log("\n=== 6. Update with arrays ===");
  const updated = await prisma.note.update({
    where: { id: note.id },
    data: {
      tags: ["work", "done"] as unknown as object,
      status: "permanent",
    },
  });
  assert(
    JSON.stringify(updated.tags) === JSON.stringify(["work", "done"]),
    `tags updated correctly (got ${JSON.stringify(updated.tags)})`,
  );
  assert(updated.status === "permanent", "status updated");

  console.log("\n=== 7. Cleanup ===");
  await prisma.note.deleteMany({});
  const remaining = await prisma.note.count();
  assert(remaining === 0, `notes table empty (had ${remaining})`);

  console.log("\nAll smoke tests passed.\n");
}

main()
  .catch((err) => {
    console.error("SMOKE TEST FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
