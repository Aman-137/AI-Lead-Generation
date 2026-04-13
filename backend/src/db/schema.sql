-- =============================================
-- AI Lead Gen SaaS — Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- =============================================
-- Table: lead_sources
-- =============================================
create table if not exists lead_sources (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  niche text not null,
  location text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed')),
  created_at timestamp with time zone default now()
);

-- =============================================
-- Table: leads
-- =============================================
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  campaign_id uuid,
  source_id uuid references lead_sources(id) on delete set null,
  name text not null default '',
  email text not null default '',
  company text not null default '',
  website text default '',
  phone text default '',
  industry text default '',
  contact_method text not null default 'email' check (contact_method in ('email', 'call')),
  source_type text not null default 'auto_find' check (source_type in ('auto_find', 'csv', 'csv_queued')),
  enriched_data jsonb,
  score integer default 0,
  contacted boolean default false,
  contacted_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Prevent duplicate leads per user (same website = same business)
create unique index if not exists idx_leads_user_website
  on leads (user_id, website)
  where website is not null and website != '';

-- Prevent duplicate leads per user (same company+phone = same business)
create unique index if not exists idx_leads_user_company_phone
  on leads (user_id, company, phone)
  where company is not null and company != ''
    and phone is not null and phone != '';

-- =============================================
-- Table: campaigns
-- =============================================

-- Campaign status: draft, running, completed
create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'running', 'completed')),
  total_leads integer default 0,
  enable_followups boolean default false,
  send_timezone text not null default 'US_EAST' check (send_timezone in ('US_EAST', 'US_CENTRAL', 'US_MOUNTAIN', 'US_WEST', 'US_ALASKA', 'US_HAWAII', 'UK', 'EU_CENTRAL', 'EU_EAST')),
  created_at timestamp with time zone default now()
);

-- Add foreign key from leads to campaigns
alter table leads
  add constraint fk_leads_campaign
  foreign key (campaign_id) references campaigns(id) on delete cascade;

-- =============================================
-- Table: gmail_accounts (multi-inbox rotation)
-- =============================================
-- Each user can connect multiple Gmail accounts (1-4 depending on plan).
-- The first connected account is marked is_primary = true.
-- Emails are distributed round-robin across accounts.
create table if not exists gmail_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamp with time zone not null,
  is_primary boolean default false,
  warmup_started_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, email)
);

-- =============================================
-- Table: emails
-- =============================================

-- Email status: pending, sent, failed
-- sequence_step: 1 = initial, 2 = follow-up 1, 3 = follow-up 2
create table if not exists emails (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  campaign_id uuid references campaigns(id) on delete cascade not null,
  lead_id uuid references leads(id) on delete cascade not null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  sequence_step integer default 1,
  tone_variant text default 'friendly',
  replied boolean default false,
  replied_at timestamp with time zone,
  retry_count integer default 0,
  error_log text,
  sent_at timestamp with time zone,
  scheduled_at timestamp with time zone,
  gmail_account_id uuid references gmail_accounts(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- =============================================
-- Table: user_plans (subscription tier + warmup tracking)
-- =============================================
create table if not exists user_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'agency')),
  gmail_connected_at timestamp with time zone,
  is_active boolean default true,
  leads_found_this_month integer default 0,
  leads_found_reset_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =============================================
-- Row Level Security
-- =============================================

-- Lead Sources RLS
alter table lead_sources enable row level security;

create policy "Users can view their own lead sources"
  on lead_sources for select using (auth.uid() = user_id);

create policy "Users can insert their own lead sources"
  on lead_sources for insert with check (auth.uid() = user_id);

create policy "Users can update their own lead sources"
  on lead_sources for update using (auth.uid() = user_id);

create policy "Users can delete their own lead sources"
  on lead_sources for delete using (auth.uid() = user_id);

-- Leads RLS
alter table leads enable row level security;

create policy "Users can view their own leads"
  on leads for select using (auth.uid() = user_id);

create policy "Users can insert their own leads"
  on leads for insert with check (auth.uid() = user_id);

create policy "Users can update their own leads"
  on leads for update using (auth.uid() = user_id);

create policy "Users can delete their own leads"
  on leads for delete using (auth.uid() = user_id);

-- Campaigns RLS
alter table campaigns enable row level security;

create policy "Users can view their own campaigns"
  on campaigns for select using (auth.uid() = user_id);

create policy "Users can insert their own campaigns"
  on campaigns for insert with check (auth.uid() = user_id);

create policy "Users can update their own campaigns"
  on campaigns for update using (auth.uid() = user_id);

create policy "Users can delete their own campaigns"
  on campaigns for delete using (auth.uid() = user_id);

-- Emails RLS
alter table emails enable row level security;

create policy "Users can view their own emails"
  on emails for select using (auth.uid() = user_id);

create policy "Users can insert their own emails"
  on emails for insert with check (auth.uid() = user_id);

create policy "Users can update their own emails"
  on emails for update using (auth.uid() = user_id);

create policy "Users can delete their own emails"
  on emails for delete using (auth.uid() = user_id);

-- Gmail Accounts RLS
alter table gmail_accounts enable row level security;

create policy "Users can view their own gmail accounts"
  on gmail_accounts for select using (auth.uid() = user_id);

create policy "Users can insert their own gmail accounts"
  on gmail_accounts for insert with check (auth.uid() = user_id);

create policy "Users can update their own gmail accounts"
  on gmail_accounts for update using (auth.uid() = user_id);

create policy "Users can delete their own gmail accounts"
  on gmail_accounts for delete using (auth.uid() = user_id);

-- User Plans RLS
alter table user_plans enable row level security;

create policy "Users can view their own plan"
  on user_plans for select using (auth.uid() = user_id);

create policy "Users can insert their own plan"
  on user_plans for insert with check (auth.uid() = user_id);

create policy "Users can update their own plan"
  on user_plans for update using (auth.uid() = user_id);

create policy "Users can delete their own plan"
  on user_plans for delete using (auth.uid() = user_id);

-- =============================================
-- Indexes for query performance
-- =============================================
create index if not exists idx_lead_sources_user_id on lead_sources(user_id);
create index if not exists idx_lead_sources_status on lead_sources(status);
create index if not exists idx_leads_user_id on leads(user_id);
create index if not exists idx_leads_campaign_id on leads(campaign_id);
create index if not exists idx_leads_source_id on leads(source_id);
create index if not exists idx_leads_score on leads(score);
create index if not exists idx_campaigns_user_id on campaigns(user_id);
create index if not exists idx_campaigns_status on campaigns(status);
create index if not exists idx_emails_campaign_id on emails(campaign_id);
create index if not exists idx_emails_user_id on emails(user_id);
create index if not exists idx_emails_status on emails(status);
create index if not exists idx_emails_scheduled_at on emails(scheduled_at);
create index if not exists idx_gmail_accounts_user_id on gmail_accounts(user_id);
create index if not exists idx_emails_gmail_account_id on emails(gmail_account_id);
create index if not exists idx_user_plans_user_id on user_plans(user_id);

-- =============================================
-- Function: Atomic increment for leads_found_this_month
-- Prevents race conditions when multiple requests update simultaneously
-- =============================================
create or replace function increment_leads_found(p_user_id uuid, p_count integer)
returns void as $$
  update user_plans
  set leads_found_this_month = leads_found_this_month + p_count,
      updated_at = now()
  where user_id = p_user_id;
$$ language sql volatile;

-- =============================================
-- Table: smtp_accounts (SMTP email sending)
-- =============================================
-- Users can connect SMTP accounts (Outlook, Zoho, custom domain, etc.)
-- alongside Gmail accounts for inbox rotation.
create table if not exists smtp_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  display_name text default '',
  host text not null,
  port integer not null default 587,
  username text not null,
  password_encrypted text not null,
  use_tls boolean default true,
  is_primary boolean default false,
  warmup_started_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, email)
);

-- SMTP Accounts RLS
alter table smtp_accounts enable row level security;

create policy "Users can view their own smtp accounts"
  on smtp_accounts for select using (auth.uid() = user_id);

create policy "Users can insert their own smtp accounts"
  on smtp_accounts for insert with check (auth.uid() = user_id);

create policy "Users can update their own smtp accounts"
  on smtp_accounts for update using (auth.uid() = user_id);

create policy "Users can delete their own smtp accounts"
  on smtp_accounts for delete using (auth.uid() = user_id);

create index if not exists idx_smtp_accounts_user_id on smtp_accounts(user_id);

-- Add smtp_account_id to emails table (nullable, alongside gmail_account_id)
alter table emails add column if not exists smtp_account_id uuid references smtp_accounts(id) on delete set null;
create index if not exists idx_emails_smtp_account_id on emails(smtp_account_id);
