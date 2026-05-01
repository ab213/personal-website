create extension if not exists pgcrypto;

create table if not exists public.questions_worth_asking (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default timezone('utc', now()),
    approved_at timestamptz,
    display_name text,
    publish_name boolean not null default false,
    topic text not null check (
        topic in ('purpose', 'engineering', 'books', 'career', 'focus', 'health', 'life', 'other')
    ),
    question_text text not null check (char_length(question_text) between 20 and 280),
    status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
    response_url text
);

alter table public.questions_worth_asking
    alter column status set default 'approved';

create index if not exists questions_worth_asking_status_created_idx
    on public.questions_worth_asking (status, created_at desc);

alter table public.questions_worth_asking enable row level security;

drop policy if exists "Anyone can submit a question" on public.questions_worth_asking;
create policy "Anyone can submit a question"
on public.questions_worth_asking
for insert
to anon, authenticated
with check (
    status = 'approved'
    and (display_name is null or char_length(display_name) <= 40)
    and char_length(question_text) between 20 and 280
    and topic in ('purpose', 'engineering', 'books', 'career', 'focus', 'health', 'life', 'other')
);

drop policy if exists "Anyone can read approved questions" on public.questions_worth_asking;
create policy "Anyone can read approved questions"
on public.questions_worth_asking
for select
to anon, authenticated
using (status = 'approved');

create or replace function public.set_question_approved_at()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' and new.status = 'approved' then
        new.approved_at = timezone('utc', now());
    elsif new.status = 'approved' and old.status is distinct from 'approved' then
        new.approved_at = timezone('utc', now());
    elsif new.status <> 'approved' then
        new.approved_at = null;
    end if;

    return new;
end;
$$;

drop trigger if exists questions_worth_asking_set_approved_at on public.questions_worth_asking;
create trigger questions_worth_asking_set_approved_at
before insert or update on public.questions_worth_asking
for each row
execute function public.set_question_approved_at();

update public.questions_worth_asking
set status = 'approved'
where status = 'pending';
