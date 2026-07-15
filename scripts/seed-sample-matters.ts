import { PrismaClient } from "@prisma/client";
import { generateMatterCode } from "../src/lib/matter-code";

const prisma = new PrismaClient();

async function createSampleMatter(input: {
  title: string;
  description: string;
  type: "CIVIL" | "CORPORATE";
  clientName: string;
  phone: string;
  city: string;
  address: string;
  leadLawyerId: string;
  memberIds: string[];
}) {
  const client = await prisma.client.create({
    data: {
      name: input.clientName,
      phone: input.phone,
      city: input.city,
      address: input.address,
    },
  });

  const code = await generateMatterCode(prisma, input.type);

  const matter = await prisma.matter.create({
    data: {
      code,
      title: input.title,
      description: input.description,
      type: input.type,
      status: "NEW",
      clientId: client.id,
      leadLawyerId: input.leadLawyerId,
      members: {
        create: Array.from(new Set([input.leadLawyerId, ...input.memberIds])).map(
          (userId) => ({ userId }),
        ),
      },
    },
  });

  return { matter, client };
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: "admin@luat.vn", isActive: true },
  });
  const lawyer =
    (await prisma.user.findFirst({
      where: { email: "luatsu1@luat.vn", isActive: true },
    })) ??
    (await prisma.user.findFirst({
      where: { role: { in: ["LAWYER", "MANAGER", "ADMIN"] }, isActive: true },
    }));

  if (!admin || !lawyer) {
    throw new Error(
      "Không tìm thấy user demo. Chạy `npm run db:setup` rồi đăng nhập lại.",
    );
  }

  const first = await createSampleMatter({
    title: "Tranh chấp hợp đồng thuê mặt bằng",
    description: "Khách hàng yêu cầu tư vấn và soạn thảo đơn khởi kiện về hợp đồng thuê.",
    type: "CIVIL",
    clientName: "Nguyễn Minh Anh",
    phone: "0903123456, 0912987654",
    city: "Hà Nội",
    address: "12 Láng Hạ, Đống Đa",
    leadLawyerId: lawyer.id,
    memberIds: [admin.id],
  });

  const second = await createSampleMatter({
    title: "Tư vấn thành lập công ty TNHH",
    description: "Hỗ trợ đăng ký kinh doanh, soạn điều lệ và hồ sơ góp vốn.",
    type: "CORPORATE",
    clientName: "Công ty TNHH An Phát",
    phone: "02838765432",
    city: "TP. Hồ Chí Minh",
    address: "88 Nguyễn Huệ, Quận 1",
    leadLawyerId: admin.id,
    memberIds: [lawyer.id],
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        matters: [
          { id: first.matter.id, code: first.matter.code, title: first.matter.title },
          { id: second.matter.id, code: second.matter.code, title: second.matter.title },
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
