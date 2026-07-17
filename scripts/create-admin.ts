import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const DEMO_ADMIN_EMAIL = "admin@admin.com";
const DEMO_ADMIN_PASSWORD = "admin";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? DEMO_ADMIN_EMAIL).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? DEMO_ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Quản trị viên";

  if (password.length < 5) {
    throw new Error("ADMIN_PASSWORD phải có ít nhất 5 ký tự");
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashed,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      email,
      name,
      password: hashed,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Admin ready: login "admin" hoặc ${user.email} / ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
