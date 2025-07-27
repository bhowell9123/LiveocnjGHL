-- Query to find information about Kathy Berman and Dan Bernstein
SELECT 
  id,
  first_name,
  last_name,
  tenant_email,
  tenant_phone,
  rental_address,
  unit_number,
  unit_owner,
  owner_phone,
  created_at,
  last_scraped_at,
  status,
  confirmation_number,
  check_in_date,
  rent
FROM 
  tenants
WHERE 
  (last_name ILIKE 'Berman' AND (first_name ILIKE 'Kathy' OR first_name ILIKE 'Caty' OR first_name ILIKE 'Gail'))
  OR
  (last_name ILIKE 'Bernstein' AND first_name ILIKE 'Dan%')
ORDER BY 
  last_name, first_name;