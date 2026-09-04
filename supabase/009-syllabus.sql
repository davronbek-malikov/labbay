-- A syllabus any teacher can shape, and student fields any teacher can invent.
-- Run once in the Supabase SQL editor, after 008. Safe to re-run.
--
-- syllabus is a list of levels; each level holds lessons; each lesson holds
-- its topics and its homework:
--   [{ "id": "...", "name": "A1", "lessons":
--       [{ "id": "...", "title": "Lesson 1", "topics": [], "homework": [] }] }]
--
-- It is JSON rather than tables because no two teachers structure a course the
-- same way, and a rename must never need a migration.
alter table public.groups
  add column if not exists syllabus jsonb not null default '[]'::jsonb;

-- Whatever this teacher wants to track: parent's phone, school, target band.
alter table public.students
  add column if not exists fields jsonb not null default '{}'::jsonb;

-- Which level of the course syllabus this student is working through.
alter table public.students
  add column if not exists level_id text;

-- Carry the old flat lists into a first level so nothing is lost.
do $$
declare
  g record;
begin
  for g in
    select id, topics, homework from public.groups
    where syllabus = '[]'::jsonb
      and (coalesce(array_length(topics, 1), 0) > 0
        or coalesce(array_length(homework, 1), 0) > 0)
  loop
    update public.groups
       set syllabus = jsonb_build_array(
             jsonb_build_object(
               'id', 'lvl_' || substr(md5(random()::text), 1, 8),
               'name', 'Level 1',
               'lessons', jsonb_build_array(
                 jsonb_build_object(
                   'id', 'les_' || substr(md5(random()::text), 1, 8),
                   'title', 'Lesson 1',
                   'topics', to_jsonb(coalesce(g.topics, '{}')),
                   'homework', to_jsonb(coalesce(g.homework, '{}'))
                 )
               )
             )
           )
     where id = g.id;
  end loop;
end $$;
