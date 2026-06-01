-- S3: rate-limit попыток входа в админку по IP
create table if not exists admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists admin_login_attempts_ip_idx
  on admin_login_attempts(ip, created_at desc);
