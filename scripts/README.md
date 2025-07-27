# Tenant Sync Validation Scripts

This directory contains scripts for validating the sync process between Supabase and GoHighLevel (GHL).

## Overview

The validation process consists of two main scripts:

1. `fetch100.ts` - Fetches contact data from GoHighLevel for 100 sample tenants
2. `compare100.ts` - Compares the tenant data with the GHL contact data

These scripts are run in sequence by the `validate-sync.sh` shell script.

## Prerequisites

Before running the validation scripts, ensure you have the following:

1. Deno installed (for running TypeScript files)
2. GoHighLevel API v2 Private Integration Token (PIT)
3. GoHighLevel Location ID
4. Custom Field IDs for rent fields

## Environment Variables

The scripts require the following environment variables:

- `GHL_API_V2_KEY` - GoHighLevel API v2 Private Integration Token
- `LOCATION_ID` - GoHighLevel Location ID
- `CF_TOTAL_LIFETIME_RENT` - Custom Field ID for total lifetime rent

## Running the Validation

To run the validation, simply execute the `validate-sync.sh` script:

```bash
./scripts/validate-sync.sh
```

This will:
1. Fetch contact data from GoHighLevel for 100 sample tenants
2. Compare the tenant data with the GHL contact data
3. Generate a validation report

## Validation Report

The validation script generates the following files:

- `ghl_contacts_100.json` - Raw contact data from GHL
- `tenant_supabase_examples.json` - Tenant data from Supabase
- `sync_validation_report.json` - Detailed report of the validation results

The validation report contains the following buckets:

- `missing` - Contacts that couldn't be found in GHL
- `phoneMismatch` - Contacts with mismatched phone numbers
- `rentMissing` - Contacts missing rent fields
- `oppMissing` - Contacts missing opportunities

## Interpreting the Results

### Missing Contacts

If contacts are missing, it could be due to:
- Lookup failed (email or phone not found)
- POST 409 conflict error

**Fix**: Add phone-fallback lookup and PATCH-on-409 in upsertContactV2 function

### Phone Mismatches

If phone numbers are mismatched, it could be due to:
- Incorrect formatting
- Missing country code
- Extra digits

**Fix**: Ensure cleanPhone() function returns phone numbers in the format `+1XXXXXXXXXX`

### Missing Rent Fields

If rent fields are missing, it could be due to:
- Wrong custom field IDs
- Mapper bug

**Fix**: Verify custom field IDs in Supabase secrets and log body.customFields

### Missing Opportunities

If opportunities are missing, it could be due to:
- Opportunity 404 error
- Bad pipeline/stage IDs

**Fix**: Test the v2 endpoint with current pipelineId & stageId using cURL

## Troubleshooting

### Authentication Issues

If you encounter 403 Forbidden errors, check:
- The PIT token is valid and has access to the location
- The location ID is correct

### API Endpoint Structure

The correct endpoint format is `/contacts?query=searchterm&locationId=locationId`. The API doesn't accept `email=` parameter directly, only `query=`.

### Phone Number Formatting

GHL expects phone numbers in the format `+1XXXXXXXXXX`. Ensure your phone numbers are properly formatted before sending them to the API.