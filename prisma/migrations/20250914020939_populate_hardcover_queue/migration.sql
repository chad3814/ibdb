INSERT INTO "HardcoverQueue" ("id", "bookId")
SELECT gen_random_uuid(), "bookId" FROM "Edition" WHERE "hardcoverId" IS NULL
ON CONFLICT DO NOTHING;
