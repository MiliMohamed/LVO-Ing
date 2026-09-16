/** Vérification optionnelle PostgreSQL via Prisma (monorepo root). */

export async function checkDatabase(): Promise<{ ok: boolean; provider: string; detail: string }> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return { ok: false, provider: "postgresql", detail: "DATABASE_URL non configuré (mode mémoire actif)" };
  }
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return { ok: true, provider: "postgresql", detail: "Connexion Prisma OK" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, provider: "postgresql", detail: msg };
  }
}
