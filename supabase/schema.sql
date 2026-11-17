create table public.app_state (
  id integer primary key check (id = 1),
  locked boolean not null default false,
  review boolean not null default false
);

insert into public.app_state (id) values (1)
on conflict (id) do nothing;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('others', 'self')),
  text varchar(60) not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
alter table public.submissions enable row level security;

grant all on public.app_state to service_role;
grant all on public.submissions to service_role;
