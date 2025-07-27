# Test Contacts for Supabase SQL

Below are SQL statements to insert 10 test contacts into the tenants table. Each statement is designed to work with the sync_leases-ts Edge Function.

## SQL Statements

```sql
-- Contact 1
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'John',
  'Smith',
  'john.smith@example.com',
  '["5551234567"]'::jsonb,
  '123 Beach Avenue',
  '101',
  'Ocean Properties LLC',
  '["5559876543"]'::jsonb,
  '2025-08-01',
  2500,
  'dc7b6ab0-632a-401a-8f00-a47c0a179b48',
  NOW(),
  NOW()
);

-- Contact 2
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'Emily',
  'Johnson',
  'emily.johnson@example.com',
  '["5552345678"]'::jsonb,
  '456 Ocean Drive',
  '202',
  'Beachfront Rentals Inc',
  '["5558765432"]'::jsonb,
  '2025-07-15',
  3000,
  'dc7b6ab0-632a-401a-8f00-a47c0a179b48',
  NOW(),
  NOW()
);

-- Contact 3
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'Michael',
  'Williams',
  'michael.williams@example.com',
  '["5553456789"]'::jsonb,
  '789 Sunset Blvd',
  '303',
  'Coastal Investments LLC',
  '["5557654321"]'::jsonb,
  '2025-06-20',
  3500,
  'b03ae341-1866-41f1-932b-1dd2d729c8da',
  NOW(),
  NOW()
);

-- Contact 4
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'Sarah',
  'Brown',
  'sarah.brown@example.com',
  '["5554567890"]'::jsonb,
  '101 Boardwalk',
  '404',
  'Seaside Properties',
  '["5556543210"]'::jsonb,
  '2025-09-05',
  2800,
  'dc7b6ab0-632a-401a-8f00-a47c0a179b48',
  NOW(),
  NOW()
);

-- Contact 5
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'David',
  'Jones',
  'david.jones@example.com',
  '["5555678901"]'::jsonb,
  '222 Harbor View',
  '505',
  'Bay Investments',
  '["5555432109"]'::jsonb,
  '2025-07-30',
  3200,
  'b03ae341-1866-41f1-932b-1dd2d729c8da',
  NOW(),
  NOW()
);

-- Contact 6
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'Jennifer',
  'Miller',
  'jennifer.miller@example.com',
  '["5556789012"]'::jsonb,
  '333 Bayview Ave',
  '606',
  'Oceanfront LLC',
  '["5554321098"]'::jsonb,
  '2026-01-15',
  2700,
  'dc7b6ab0-632a-401a-8f00-a47c0a179b48',
  NOW(),
  NOW()
);

-- Contact 7
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'Robert',
  'Davis',
  'robert.davis@example.com',
  '["5557890123"]'::jsonb,
  '444 Shoreline Dr',
  '707',
  'Beach Rentals Inc',
  '["5553210987"]'::jsonb,
  '2026-02-10',
  3100,
  'b03ae341-1866-41f1-932b-1dd2d729c8da',
  NOW(),
  NOW()
);

-- Contact 8
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'Lisa',
  'Garcia',
  'lisa.garcia@example.com',
  '["5558901234"]'::jsonb,
  '555 Coastal Hwy',
  '808',
  'Shoreline Properties',
  '["5552109876"]'::jsonb,
  '2025-08-20',
  2900,
  'dc7b6ab0-632a-401a-8f00-a47c0a179b48',
  NOW(),
  NOW()
);

-- Contact 9
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'James',
  'Rodriguez',
  'james.rodriguez@example.com',
  '["5559012345"]'::jsonb,
  '666 Beachside Ln',
  '909',
  'Coastal Rentals LLC',
  '["5551098765"]'::jsonb,
  '2026-03-05',
  3300,
  'b03ae341-1866-41f1-932b-1dd2d729c8da',
  NOW(),
  NOW()
);

-- Contact 10
INSERT INTO tenants (
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  check_in_date,
  rent,
  user_id,
  created_at,
  last_scraped_at
) VALUES (
  'Mary',
  'Martinez',
  'mary.martinez@example.com',
  '["5550123456"]'::jsonb,
  '777 Oceanview Dr',
  '1010',
  'Beachfront Investments',
  '["5550987654"]'::jsonb,
  '2025-10-10',
  2600,
  'dc7b6ab0-632a-401a-8f00-a47c0a179b48',
  NOW(),
  NOW()
);
```

## Update Existing Tenant

If you prefer to update an existing tenant instead of creating new ones, you can use:

```sql
-- Update an existing tenant to trigger the sync
UPDATE tenants
SET last_scraped_at = NOW()
WHERE id = 4576;  -- Replace with an actual tenant ID
```

## Running the Function

After inserting or updating tenants, run the function with:

```bash
curl -X POST "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{}'