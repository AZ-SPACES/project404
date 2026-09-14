-- Defense scoring schema. Loaded automatically on first `docker compose up`.

create table if not exists rooms (
  id     text primary key,          -- 'rm-1'
  code   text not null,             -- 'RM 1', as printed in the allocation
  label  text not null,             -- 'Room 1'
  venue  text not null,             -- 'FF12'
  day    text not null,
  sort   int  not null
);

create table if not exists examiners (
  id      text primary key,         -- 'rm-1-prof-najim'
  room_id text not null references rooms(id) on delete cascade,
  name    text not null,
  sort    int  not null
);

create table if not exists groups (
  number  int primary key,
  room_id text not null references rooms(id) on delete cascade
);

create table if not exists students (
  id           text primary key,    -- 'g6-3364522'
  group_number int  not null references groups(number) on delete cascade,
  name         text not null,
  index_no     text not null,
  student_id   text,                -- absent for 216 of 501 in the source
  supervisor   text,                -- joined from CS4 allocation where available
  sort         int  not null
);

-- One ballot per student per examiner. A NULL criterion means "not scored yet",
-- which is deliberately different from a scored 0.
create table if not exists scores (
  student_id   text not null references students(id)  on delete cascade,
  examiner_id  text not null references examiners(id) on delete cascade,
  appearance   smallint check (appearance   between 0 and 10),
  usability    smallint check (usability    between 0 and 10),
  technical    smallint check (technical    between 0 and 10),
  innovation   smallint check (innovation   between 0 and 10),
  presentation smallint check (presentation between 0 and 10),
  notes        text        not null default '',
  updated_at   timestamptz not null default now(),
  primary key (student_id, examiner_id)
);

create index if not exists students_group_idx  on students(group_number);
create index if not exists groups_room_idx     on groups(room_id);
create index if not exists examiners_room_idx  on examiners(room_id);
create index if not exists scores_examiner_idx on scores(examiner_id);

-- ---------------------------------------------------------------------------
-- Supervisor component, added after defense day.
--
-- The panel rubric above was originally the whole mark. It is now 40% of it;
-- the student's own supervisor contributes the other 60% as a single mark. The
-- two halves are kept in separate tables because they are filled in by different
-- people, at different times, and a student can legitimately have one without
-- the other — a supervisee who never sat the defense has no panel score, and a
-- student whose supervisor has not reported yet has no supervisor mark.
-- ---------------------------------------------------------------------------

create table if not exists supervisors (
  id   text primary key,          -- 'dr-kate-takyi'
  name text not null,
  sort int  not null
);

-- Supervisees who never sat the defense are on the roster for their supervisor's
-- 60% and nothing else, so they belong to no group and no room.
alter table students alter column group_number drop not null;
alter table students add column if not exists supervisor_id text references supervisors(id);

-- One mark per student. A student has exactly one supervisor, so unlike `scores`
-- this is keyed on the student alone — supervisor_id records who filed it and
-- guards against a second supervisor overwriting the first.
create table if not exists supervisor_scores (
  student_id    text not null references students(id) on delete cascade,
  supervisor_id text not null references supervisors(id) on delete cascade,
  mark          numeric(4,1) check (mark between 0 and 60),
  notes         text        not null default '',
  updated_at    timestamptz not null default now(),
  primary key (student_id)
);

create index if not exists students_supervisor_idx    on students(supervisor_id);
create index if not exists supervisor_scores_sup_idx  on supervisor_scores(supervisor_id);
