-- Data fix: the admin coach form used to map อาทิตย์ (Sunday) to dayOfWeek 7,
-- but the schema convention is JS Date.getDay(): 0 = Sunday … 6 = Saturday.
-- Rows saved as 7 could never match a real Sunday, so availability silently
-- failed. Normalize them to 0.
UPDATE "CoachAvailability" SET "dayOfWeek" = 0 WHERE "dayOfWeek" = 7;
