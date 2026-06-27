-- Lightning Fleet Market Intelligence schema draft
-- Designed for Supabase/Postgres.

create table if not exists vehicles (
  id text primary key,
  make text not null,
  model text not null,
  year int not null,
  trim text,
  license_plate text,
  status text not null default 'inactive',
  listing_complete boolean not null default false,
  segment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vehicle_costs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id text not null references vehicles(id) on delete cascade,
  cost_type text not null,
  amount numeric(12,2) not null,
  frequency text not null check (frequency in ('one_time', 'daily', 'weekly', 'monthly', 'annual', 'per_trip')),
  starts_on date,
  ends_on date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id text primary key,
  vehicle_id text not null references vehicles(id) on delete cascade,
  guest_name text,
  booked_at timestamptz,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  gross_revenue numeric(12,2),
  platform_fee numeric(12,2),
  reimbursements numeric(12,2) default 0,
  net_revenue numeric(12,2),
  status text not null,
  pickup_location text,
  created_at timestamptz not null default now()
);

create table if not exists market_segments (
  id text primary key,
  label text not null,
  location text not null,
  radius_miles numeric(6,2),
  make text,
  model text,
  min_year int,
  max_year int,
  vehicle_type text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists competitor_listings (
  id uuid primary key default gen_random_uuid(),
  segment_id text not null references market_segments(id) on delete cascade,
  external_listing_id text,
  listing_url text,
  host_name text,
  host_trips int,
  make text,
  model text,
  year int,
  trim text,
  rating numeric(3,2),
  review_count int,
  trip_count int,
  all_star boolean default false,
  turo_go boolean default false,
  delivery_available boolean,
  airport_delivery boolean,
  created_at timestamptz not null default now(),
  unique(segment_id, external_listing_id)
);

create table if not exists competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  competitor_listing_id uuid not null references competitor_listings(id) on delete cascade,
  observed_at timestamptz not null default now(),
  current_price numeric(12,2),
  weekday_price numeric(12,2),
  weekend_price numeric(12,2),
  availability_today text,
  booked_days_next_30 int,
  total_days_next_30 int,
  utilization_next_30 numeric(5,2),
  raw jsonb,
  source_type text not null default 'manual_or_authorized_public_research'
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  location text,
  expected_attendance int,
  demand_score int check (demand_score between 1 and 10),
  vehicle_segments text[],
  source_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists pricing_recommendations (
  id uuid primary key default gen_random_uuid(),
  vehicle_id text not null references vehicles(id) on delete cascade,
  generated_at timestamptz not null default now(),
  valid_from date,
  valid_to date,
  current_weekday_price numeric(12,2),
  current_weekend_price numeric(12,2),
  suggested_weekday_price numeric(12,2),
  suggested_weekend_price numeric(12,2),
  suggested_event_price numeric(12,2),
  confidence text check (confidence in ('low', 'medium', 'high')),
  reason text,
  raw jsonb
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  title text not null,
  body text not null,
  vehicle_id text references vehicles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'sent', 'dismissed', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_competitor_snapshots_listing_time
  on competitor_snapshots (competitor_listing_id, observed_at desc);

create index if not exists idx_bookings_vehicle_dates
  on bookings (vehicle_id, starts_at, ends_at);

create index if not exists idx_events_dates
  on events (starts_on, ends_on);
