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
  source_type text not null default 'auto_find' check (source_type in ('auto_find', 'csv')),
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
  send_timezone text not null default 'US_EAST' check (send_timezone in ('US_EAST', 'US_CENTRAL', 'US_WEST', 'UK', 'EU_CENTRAL')),
  created_at timestamp with time zone default now()
);

-- Add foreign key from leads to campaigns
alter table leads
  add constraint fk_leads_campaign
  foreign key (campaign_id) references campaigns(id) on delete cascade;

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
  created_at timestamp with time zone default now()
);

-- =============================================
-- Table: gmail_tokens (store OAuth2 tokens securely)
-- =============================================
create table if not exists gmail_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamp with time zone not null,
  gmail_email text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
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

-- Gmail Tokens RLS
alter table gmail_tokens enable row level security;

create policy "Users can view their own gmail tokens"
  on gmail_tokens for select using (auth.uid() = user_id);

create policy "Users can insert their own gmail tokens"
  on gmail_tokens for insert with check (auth.uid() = user_id);

create policy "Users can update their own gmail tokens"
  on gmail_tokens for update using (auth.uid() = user_id);

create policy "Users can delete their own gmail tokens"
  on gmail_tokens for delete using (auth.uid() = user_id);

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
create index if not exists idx_gmail_tokens_user_id on gmail_tokens(user_id);
create index if not exists idx_user_plans_user_id on user_plans(user_id);
