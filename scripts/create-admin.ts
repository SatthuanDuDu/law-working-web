import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@luat.vn").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "password123";
  const name = process.env.ADMIN_NAME ?? "Quản trị viên";

  if (password.length < 6) {
    throw new Error("ADMIN_PASSWORD phải có ít nhất 6 ký tự");
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

  console.log(`Admin ready: ${user.email} (${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
