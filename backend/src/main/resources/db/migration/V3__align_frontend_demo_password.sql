-- Match Next.js login defaults (see frontend/app/login/page.tsx). Plain password: lvo123
UPDATE users
SET password_hash = '$2a$10$ZfErN/GbpX.JboeGkLeaFOyd1s1CShtEC.Cw1C/iJ912tw.WFbYSa'
WHERE email IN ('admin@lvo-ing.fr', 'consultant@lvo-ing.fr');
