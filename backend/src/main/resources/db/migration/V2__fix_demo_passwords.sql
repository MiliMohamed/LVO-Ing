-- Demo accounts (dev only). Plain password: LvoDemo2026!
UPDATE users
SET password_hash = '$2a$10$5qfYIlTOqO57/j4uq96hbeMgSV4IEXEGMwN6pl3ta4PxUUTJpQUyu'
WHERE email IN ('admin@lvo-ing.fr', 'consultant@lvo-ing.fr');
