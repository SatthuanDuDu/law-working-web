import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD,
  DEMO_ADMIN_USERNAME,
  deriveUsernameFromEmail,
} from "../src/lib/username";
import { buildClientCode } from "../src/lib/client-code";

const prisma = new PrismaClient();

async function main() {
  const demoPassword = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  const password = await bcrypt.hash("password123", 10);

  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: "Hình sự" },
      update: {},
      create: { name: "Hình sự" },
    }),
    prisma.department.upsert({
      where: { name: "Dân sự" },
      update: {},
      create: { name: "Dân sự" },
    }),
    prisma.department.upsert({
      where: { name: "Doanh nghiệp" },
      update: {},
      create: { name: "Doanh nghiệp" },
    }),
    prisma.department.upsert({
      where: { name: "Hành chính" },
      update: {},
      create: { name: "Hành chính" },
    }),
  ]);

  await Promise.all(
    [
      "Soạn thảo",
      "Họp khách",
      "Nghiên cứu",
      "Tòa án",
      "Hành chính",
      "Tư vấn",
    ].map((name) =>
      prisma.workType.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {
      username: DEMO_ADMIN_USERNAME,
      password: demoPassword,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      username: DEMO_ADMIN_USERNAME,
      email: DEMO_ADMIN_EMAIL,
      password: demoPassword,
      name: "Quản trị viên",
      role: "ADMIN",
      departmentId: departments[3].id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "quanly@luat.vn" },
    update: { username: "quanly" },
    create: {
      username: "quanly",
      email: "quanly@luat.vn",
      password,
      name: "Trần Thị Quản Lý",
      role: "MANAGER",
      departmentId: departments[0].id,
    },
  });

  const lawyer1 = await prisma.user.upsert({
    where: { email: "luatsu1@luat.vn" },
    update: { username: "luatsu1" },
    create: {
      username: "luatsu1",
      email: "luatsu1@luat.vn",
      password,
      name: "Lê Văn Luật Sư",
      role: "LAWYER",
      departmentId: departments[0].id,
    },
  });

  const lawyer2 = await prisma.user.upsert({
    where: { email: "luatsu2@luat.vn" },
    update: { username: "luatsu2" },
    create: {
      username: "luatsu2",
      email: "luatsu2@luat.vn",
      password,
      name: "Phạm Thị Luật Sư",
      role: "LAWYER",
      departmentId: departments[1].id,
    },
  });

  const support = await prisma.user.upsert({
    where: { email: "hotro@luat.vn" },
    update: { username: "hotro" },
    create: {
      username: "hotro",
      email: "hotro@luat.vn",
      password,
      name: "Hoàng Văn Hỗ Trợ",
      role: "SUPPORT",
      departmentId: departments[3].id,
    },
  });

  // Backfill usernames for any other users still on cuid defaults / missing nice names
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, username: true } });
  const used = new Set(allUsers.map((u) => u.username));
  for (const u of allUsers) {
    const looksGenerated = u.username.length >= 20 && !u.username.includes("_") && !/^[a-z]+\d*$/.test(u.username);
    if (!looksGenerated && used.has(u.username)) continue;
    let base = deriveUsernameFromEmail(u.email);
    let candidate = base;
    let n = 1;
    while (used.has(candidate) && candidate !== u.username) {
      candidate = `${base}${n}`.slice(0, 32);
      n += 1;
    }
    if (candidate !== u.username) {
      await prisma.user.update({ where: { id: u.id }, data: { username: candidate } });
      used.delete(u.username);
      used.add(candidate);
    }
  }

  const client1 = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: { code: "KH-2026-0001" },
    create: {
      id: "seed-client-1",
      code: "KH-2026-0001",
      name: "Công ty TNHH ABC",
      email: "contact@abc.vn",
      phone: "0901234567",
      address: "Hà Nội",
      notes: "Khách hàng doanh nghiệp lâu năm",
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: "seed-client-2" },
    update: { code: "KH-2026-0002" },
    create: {
      id: "seed-client-2",
      code: "KH-2026-0002",
      name: "Nguyễn Văn B",
      email: "nguyenvanb@gmail.com",
      phone: "0912345678",
      address: "TP. Hồ Chí Minh",
    },
  });

  // Backfill client codes that still look like cuid
  const clients = await prisma.client.findMany({ select: { id: true, code: true } });
  let seq = 3;
  for (const c of clients) {
    if (/^KH-\d{4}-\d{4}$/.test(c.code)) continue;
    let code = buildClientCode("2026", seq);
    while (await prisma.client.findFirst({ where: { code, NOT: { id: c.id } } })) {
      seq += 1;
      code = buildClientCode("2026", seq);
    }
    await prisma.client.update({ where: { id: c.id }, data: { code } });
    seq += 1;
  }

  const matter1 = await prisma.matter.upsert({
    where: { code: "HS-2026-001" },
    update: {},
    create: {
      code: "HS-2026-001",
      title: "Tranh chấp hợp đồng mua bán",
      description: "Tranh chấp hợp đồng mua bán giữa ABC và đối tác",
      type: "CIVIL",
      status: "IN_PROGRESS",
      clientId: client1.id,
      leadLawyerId: lawyer1.id,
    },
  });

  const matter2 = await prisma.matter.upsert({
    where: { code: "HS-2026-002" },
    update: {},
    create: {
      code: "HS-2026-002",
      title: "Tư vấn thành lập công ty",
      type: "CORPORATE",
      status: "NEW",
      clientId: client2.id,
      leadLawyerId: lawyer2.id,
    },
  });

  await prisma.matterMember.deleteMany({
    where: {
      OR: [{ matterId: matter1.id }, { matterId: matter2.id }],
    },
  });

  await prisma.matterMember.createMany({
    data: [
      { matterId: matter1.id, userId: lawyer1.id },
      { matterId: matter1.id, userId: support.id },
      { matterId: matter2.id, userId: lawyer2.id },
      { matterId: matter2.id, userId: support.id },
    ],
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.task.deleteMany({
    where: {
      OR: [{ matterId: matter1.id }, { matterId: matter2.id }],
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Hoàn thiện đơn khởi kiện",
        description: "Soạn thảo và hoàn thiện đơn khởi kiện",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: tomorrow,
        assigneeId: lawyer1.id,
        createdById: manager.id,
        matterId: matter1.id,
      },
      {
        title: "Chuẩn bị hồ sơ thành lập",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: tomorrow,
        assigneeId: lawyer2.id,
        createdById: manager.id,
        matterId: matter2.id,
      },
    ],
  });

  console.log("Seed OK", {
    admin: admin.username,
    manager: manager.username,
    lawyer1: lawyer1.username,
    lawyer2: lawyer2.username,
    support: support.username,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
