-- Add missing columns to served_requests table
-- Run this SQL script on your database

ALTER TABLE served_requests 
ADD COLUMN status VARCHAR(32) NULL,
ADD COLUMN session_id VARCHAR(128) NULL,
ADD COLUMN user_msisdn VARCHAR(64) NULL;

-- Update existing served_requests with default status
UPDATE served_requests 
SET status = 'PAID' 
WHERE status IS NULL;

-- Verify changes
SELECT * FROM served_requests LIMIT 5;
