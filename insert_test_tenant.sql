-- Update an existing tenant to trigger the sync
UPDATE tenants
SET last_scraped_at = NOW()
WHERE id = 4576;