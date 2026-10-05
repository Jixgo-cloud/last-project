# SmartCareer database access

SmartCareer authenticates users in NestJS and accesses Postgres through Prisma.
It does not use Supabase Auth identities or browser-side Supabase table access.
The `anon` and `authenticated` database roles must therefore have no access to
application tables. Enabling RLS without policies is intentional for this model;
it is not an invitation to add public or universal authenticated policies.

## Before applying the access migration

1. Create a private `pg_dump --format=custom --schema=public` backup of the
   confirmed production project. Include schema, data, owners and ACLs.
2. Check its checksum, archive contents and restore into an isolated local
   database. Never restore over production to test a backup.
3. Verify the actual API connection retains owner or BYPASSRLS access. Do not
   grant new privileges or create an RLS bypass account to make this pass.
4. Apply the migration atomically, then verify all existing application tables
   have RLS enabled and neither client role has table or sequence privileges.
5. Check the API health and real QA candidate, company and administrator flows.
   Do not declare a rollout complete from the SQL response alone.

The migration also removes implicit client grants for future tables and sequences
created by its executing owner. Any new owner or schema must be reviewed
separately. New tables in an exposed schema still need explicit RLS enablement.
It does not force RLS on table owners, change users' roles, alter scores or delete
application records. Supabase-managed schemas and Storage objects are outside the
application backup scope and require separate backups if the app uses them later.

`npm run test:regression` applies the same migration to its disposable local
database before running the full browser/API suite. It checks client-role denial,
server access and future-table grants. The harness refuses non-local source hosts.

Never put database dumps, connection strings or production passwords in Git,
UAT PDFs, screenshots or chat messages.

## Private repeatable backup

Run `node scripts/backup-application-database.cjs --project-ref PROJECT_REF --out ABSOLUTE_PRIVATE_DIRECTORY`.
It reads an existing ignored connection file, checks the project identity, creates
a new restricted directory outside the checkout, preserves the application ACLs,
and validates the archive and checksum. Each run keeps the earlier archives.
It requires `pg_dump` and `pg_restore` on PATH (or `PG_DUMP_BIN` / `PG_RESTORE_BIN`).
A failed dump never receives a success manifest. Periodically verify restoration
against an isolated database; archive validation alone is not a restore test.
