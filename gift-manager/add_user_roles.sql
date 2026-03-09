-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';

-- Create index for faster lookups
CREATE INDEX idx_users_role ON users(role);

