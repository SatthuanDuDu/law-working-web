import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

  const workTypes = await Promise.all(
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
    where: { email: "admin@luat.vn" },
    update: {},
    create: {
      email: "admin@luat.vn",
      password,
      name: "Nguyễn Văn Admin",
      role: "ADMIN",
      departmentId: departments[3].id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "quanly@luat.vn" },
    update: {},
    create: {
      email: "quanly@luat.vn",
      password,
      name: "Trần Thị Quản Lý",
      role: "MANAGER",
      departmentId: departments[0].id,
    },
  });

  const lawyer1 = await prisma.user.upsert({
    where: { email: "luatsu1@luat.vn" },
    update: {},
    create: {
      email: "luatsu1@luat.vn",
      password,
      name: "Lê Văn Luật Sư",
      role: "LAWYER",
      departmentId: departments[0].id,
    },
  });

  const lawyer2 = await prisma.user.upsert({
    where: { email: "luatsu2@luat.vn" },
    update: {},
    create: {
      email: "luatsu2@luat.vn",
      password,
      name: "Phạm Thị Luật Sư",
      role: "LAWYER",
      departmentId: departments[1].id,
    },
  });

  const support = await prisma.user.upsert({
    where: { email: "hotro@luat.vn" },
    update: {},
    create: {
      email: "hotro@luat.vn",
      password,
      name: "Hoàng Văn Hỗ Trợ",
      role: "SUPPORT",
      departmentId: departments[3].id,
    },
  });

  const client1 = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: {},
    create: {
      id: "seed-client-1",
      name: "Công ty TNHH ABC",
      email: "contact@abc.vn",
      phone: "0901234567",
      address: "Hà Nội",
      notes: "Khách hàng doanh nghiệp lâu năm",
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: "seed-client-2" },
    update: {},
    create: {
      id: "seed-client-2",
      name: "Nguyễn Văn B",
      email: "nguyenvanb@gmail.com",
      phone: "0912345678",
      address: "TP. Hồ Chí Minh",
    },
  });

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
        description: "Rà soát và gửi bản cuối cho luật sư phụ trách",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: tomorrow,
        assigneeId: support.id,
        createdById: lawyer1.id,
        matterId: matter1.id,
      },
      {
        title: "Chuẩn bị hồ sơ thành lập công ty",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: tomorrow,
        assigneeId: lawyer2.id,
        createdById: manager.id,
        matterId: matter2.id,
      },
    ],
  });

  await prisma.notification.deleteMany({
    where: {
      userId: { in: [support.id, lawyer2.id] },
      type: "TASK_ASSIGNED",
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: support.id,
        type: "TASK_ASSIGNED",
        title: "Được giao việc mới",
        message: "Bạn được giao: Hoàn thiện đơn khởi kiện",
        link: "/tasks",
      },
      {
        userId: lawyer2.id,
        type: "TASK_ASSIGNED",
        title: "Được giao việc mới",
        message: "Bạn được giao: Chuẩn bị hồ sơ thành lập công ty",
        link: "/tasks",
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "CREATE",
      entityType: "System",
      details: "Khởi tạo dữ liệu mẫu",
    },
  });

  console.log("Seed completed.");
  console.log("Demo accounts (password: password123):");
  console.log("- admin@luat.vn (Admin)");
  console.log("- quanly@luat.vn (Quản lý)");
  console.log("- luatsu1@luat.vn (Luật sư)");
  console.log("- luatsu2@luat.vn (Luật sư)");
  console.log("- hotro@luat.vn (Hỗ trợ)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
