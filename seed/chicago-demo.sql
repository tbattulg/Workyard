INSERT OR IGNORE INTO `users` (`id`, `clerk_user_id`, `name`, `email`, `phone`, `platform_role`, `status`, `created_at`, `updated_at`) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_buyer', 'Jordan Lee', 'buyer@example.com', '312-555-0144', 'buyer', 'active', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'demo_contractor', 'Alex Rivera', 'contractor@example.com', '773-555-0182', 'buyer', 'active', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'demo_admin', 'Morgan Chen', 'admin@example.com', NULL, 'platform_admin', 'active', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z');

INSERT OR IGNORE INTO `service_categories` (`id`, `name`, `slug`, `description`, `active`, `sort_order`, `created_at`, `updated_at`) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Electrical', 'electrical', 'Electrical repairs, upgrades, panels, wiring, and lighting.', 1, 10, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('10000000-0000-4000-8000-000000000002', 'Remodeling', 'remodeling', 'Residential and commercial renovation projects.', 1, 20, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('10000000-0000-4000-8000-000000000003', 'Carpentry', 'carpentry', 'Framing, trim, cabinetry, and finish carpentry.', 1, 30, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('10000000-0000-4000-8000-000000000004', 'HVAC', 'hvac', 'Heating, cooling, ventilation, and maintenance.', 1, 40, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('10000000-0000-4000-8000-000000000005', 'Plumbing', 'plumbing', 'Plumbing repair, installation, and replacement.', 1, 50, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('10000000-0000-4000-8000-000000000006', 'Roofing', 'roofing', 'Roof inspection, repair, replacement, and drainage.', 1, 60, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z');

INSERT OR IGNORE INTO `companies` (`id`, `name`, `slug`, `description`, `license_number`, `website`, `phone`, `email`, `address_line_1`, `city`, `state`, `zip`, `service_radius_miles`, `status`, `verified_at`, `created_at`, `updated_at`) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Lakefront Electric Co.', 'lakefront-electric', 'Licensed residential and light-commercial electrical work across Chicago.', 'ECC-10482', 'https://example.com/lakefront-electric', '312-555-0118', 'hello@lakefrontelectric.example', '221 W Hubbard St', 'Chicago', 'IL', '60654', 28, 'verified', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('22222222-2222-4222-8222-222222222222', 'Prairie & Stone Builders', 'prairie-stone-builders', 'Remodeling, carpentry, and finish work for homes and neighborhood businesses.', 'GC-22391', 'https://example.com/prairie-stone', '708-555-0168', 'hello@prairiestone.example', '1100 Lake St', 'Oak Park', 'IL', '60301', 35, 'verified', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('33333333-3333-4333-8333-333333333333', 'North Loop Mechanical', 'north-loop-mechanical', 'HVAC service, replacement, and preventative maintenance for Chicago properties.', 'HVAC-55307', 'https://example.com/north-loop', '847-555-0191', 'service@northloopmechanical.example', '1717 Maple Ave', 'Evanston', 'IL', '60201', 40, 'verified', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z');

INSERT OR IGNORE INTO `company_members` (`company_id`, `user_id`, `role`, `status`, `created_at`, `updated_at`) VALUES
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'company_admin', 'active', '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z');

INSERT OR IGNORE INTO `company_service_areas` (`id`, `company_id`, `city`, `state`, `zip`, `radius_miles`, `created_at`) VALUES
  ('30000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Chicago', 'IL', '60654', 28, '2026-06-15T00:00:00.000Z'),
  ('30000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Oak Park', 'IL', '60301', 35, '2026-06-15T00:00:00.000Z'),
  ('30000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'Evanston', 'IL', '60201', 40, '2026-06-15T00:00:00.000Z');

INSERT OR IGNORE INTO `services` (`id`, `company_id`, `category_id`, `title`, `slug`, `description`, `pricing_type`, `starting_price_cents`, `active`, `created_at`, `updated_at`) VALUES
  ('20000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001', 'Electrical repair and upgrades', 'electrical-repair-upgrades', 'Troubleshooting, service upgrades, panel work, rewiring, and code corrections.', 'quote', NULL, 1, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('20000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '10000000-0000-4000-8000-000000000002', 'Kitchen and bath remodeling', 'kitchen-bath-remodeling', 'Planning and construction for kitchens, baths, and interior renovations.', 'quote', NULL, 1, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('20000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', '10000000-0000-4000-8000-000000000003', 'Finish carpentry', 'finish-carpentry', 'Custom trim, built-ins, doors, cabinetry, and finish installation.', 'quote', NULL, 1, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z'),
  ('20000000-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333333', '10000000-0000-4000-8000-000000000004', 'HVAC service and replacement', 'hvac-service-replacement', 'Diagnostics, preventative maintenance, repairs, and equipment replacement.', 'quote', NULL, 1, '2026-06-15T00:00:00.000Z', '2026-06-15T00:00:00.000Z');
