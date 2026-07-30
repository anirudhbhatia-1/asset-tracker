-- Migration: Create locations table

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert defaults
INSERT INTO locations (name) VALUES 
('Bangalore'),
('Mumbai'),
('Delhi'),
('Hyderabad')
ON CONFLICT (name) DO NOTHING;
