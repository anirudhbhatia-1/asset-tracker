-- Migration: Add address column to existing tables

ALTER TABLE assets ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS address TEXT;
