INSERT INTO "roles" ("key", "name", "desc") VALUES
  ('CUSTOMER', 'Customer', 'Default role assigned at signup'),
  ('ADMIN', 'Admin', 'Administrative role with full access')
ON CONFLICT ("key") DO NOTHING;
