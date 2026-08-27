// End-to-end smoke test for PostgresNoteRepository against the live MariaDB.
// Exercises the JSON round-trip helpers (parseJsonStringArray /
// stringifyJsonStringArray) and the $queryRaw JSON_CONTAINS paths.

import { PostgresNoteRepository } from "../src/repositories/postgres-note.repository";
import { prisma } from "../src/lib/db";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    throw new Error(msg);
  }
  console.log("  ✓", msg);
}

async function main(): Promise<void> {
  const repo = new PostgresNoteRepository();

  console.log("\n=== 1. insert() — arrays in, JSON in DB, arrays out ===");
  const created = await repo.insert({
    publicId: `repo-smoke-${Date.now()}`,
    content: "repo smoke note",
    linkedNoteIds: ["target-a", "target-b"],
    tags: ["alpha", "beta"],
    createdAt: new Date(),
  });
  assert(Array.isArray(created.linkedNoteIds), "linkedNoteIds is string[]");
  assert(
    created.linkedNoteIds.join(",") === "target-a,target-b",
    `linkedNoteIds round-tripped (got ${JSON.stringify(created.linkedNoteIds)})`,
  );
  assert(created.tags.join(",") === "alpha,beta", "tags round-tripped");
  assert(created.status === "inbox", "default status applied");

  console.log("\n=== 2. findActiveById() ===");
  const refetched = await repo.findActiveById(created.id);
  assert(refetched !== null, "refetched by id");
  assert(
    refetched?.linkedNoteIds.join(",") === "target-a,target-b",
    "arrays preserved on refetch",
  );

  console.log("\n=== 3. listWithFilters({ tag }) — $queryRaw JSON_CONTAINS ===");
  const byTag = await repo.listWithFilters({
    tag: "alpha",
    limit: 10,
  });
  assert(
    byTag.some((n) => n.id === created.id),
    "tag filter returns the note via JSON_CONTAINS",
  );

  console.log("\n=== 4. findBacklinks() — $queryRaw JSON_CONTAINS ===");
  const targetPublicId = `target-${Date.now()}`;
  const source = await repo.insert({
    publicId: `source-${Date.now()}`,
    content: "source note",
    linkedNoteIds: [targetPublicId],
    tags: [],
    createdAt: new Date(),
  });
  const target = await repo.insert({
    publicId: targetPublicId,
    content: "target note",
    linkedNoteIds: [],
    tags: [],
    createdAt: new Date(),
  });
  void target;
  const backlinks = await repo.findBacklinks(targetPublicId, 10);
  assert(
    backlinks.some((n) => n.id === source.id),
    "backlinks returns the source via JSON_CONTAINS",
  );

  console.log("\n=== 5. patchNote() — array update ===");
  const patched = await repo.patchNote(
    created.id,
    { tags: ["alpha", "gamma"] },
    new Date(),
  );
  assert(patched !== null, "patched");
  assert(
    patched?.tags.join(",") === "alpha,gamma",
    `tags updated (got ${JSON.stringify(patched?.tags)})`,
  );

  console.log("\n=== 6. softDelete() ===");
  const ok = await repo.softDelete(created.id, new Date());
  assert(ok === true, "softDelete returned true");

  console.log("\n=== 7. Cleanup ===");
  await prisma.note.deleteMany({});
  const remaining = await prisma.note.count();
  assert(remaining === 0, `notes table empty (had ${remaining})`);

  console.log("\nPostgresNoteRepository smoke test passed.\n");
}

main()
  .catch((err) => {
    console.error("REPO SMOKE TEST FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
