-- Author.goodReadsId and Author.openLibraryId are not unique either.
--
-- Same cardinality argument as Author_hardcoverId_key, dropped earlier today in
-- 20260916183000_author_hardcover_id_is_not_unique: an Author row is one author
-- *name string*, not one person -- Author_name_key makes the name the identity.
-- R. R. McCammon owns 17 rows. Any external id is therefore n:1 against this
-- table, and a unique index on it asserts 1:1.
--
-- These two indexes never actually caught a duplicate, because neither column
-- has ever held a value: 0 of 1,006,224 Author rows, verified immediately
-- before writing this. Goodreads and OpenLibrary ids are unpopulated across
-- Book and Edition too. The columns exist for an integration that has not
-- landed.
--
-- What they did do was constrain merging. /api/admin/duplicates/merge deletes
-- the losing author rows, so any external id only a loser held is dropped
-- unless it is first moved onto the survivor -- and while these indexes stood,
-- that move had to be sequenced after the delete or it would raise P2002.
-- Dropping them makes the donation order-independent. Book's three equivalents
-- went for the related reason in 20250914040401_remove_uniqueness_for_external_ids.
--
-- Edition.openLibraryId, Edition.goodReadsId and Edition.hardcoverId keep their
-- unique indexes: isbn13 is unique there and genuinely identifies one edition.
--
-- No replacement indexes. Nothing filters or joins on either column -- every
-- author lookup goes by id or name -- so an index over a million rows would
-- cost a build lock here and a write penalty forever while serving no read.

-- DropIndex
DROP INDEX IF EXISTS "Author_goodReadsId_key";

-- DropIndex
DROP INDEX IF EXISTS "Author_openLibraryId_key";
