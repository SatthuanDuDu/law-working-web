import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const workflowSeeds = [
  {
    name: "Dân sự — tranh chấp hợp đồng",
    description: "Lộ trình xử lý tranh chấp hợp đồng dân sự thông dụng",
    steps: [
      {
        title: "Tiếp nhận & phân tích hồ sơ",
        description: "Thu thập hợp đồng, chứng từ, trao đổi sơ bộ với khách hàng",
      },
      {
        title: "Nghiên cứu pháp lý",
        description: "Rà soát căn cứ, rủi ro và phương án xử lý",
      },
      {
        title: "Soạn thảo văn bản",
        description: "Đơn khởi kiện / thương lượng / thông báo theo hướng xử lý",
      },
      {
        title: "Nộp hồ sơ / làm việc cơ quan",
        description: "Nộp tại Tòa án hoặc cơ quan có thẩm quyền, theo dõi tiến độ",
      },
      {
        title: "Phiên họp / phiên tòa",
        description: "Chuẩn bị và tham gia phiên họp, phiên tòa theo lịch",
      },
      {
        title: "Kết thúc & bàn giao",
        description: "Tổng kết kết quả, bàn giao hồ sơ và hướng dẫn sau xử lý",
      },
    ],
  },
  {
    name: "Doanh nghiệp — thành lập công ty",
    description: "Quy trình tư vấn và thực hiện thành lập doanh nghiệp",
    steps: [
      {
        title: "Tư vấn sơ bộ",
        description: "Xác định loại hình, ngành nghề, cơ cấu và yêu cầu khách hàng",
      },
      {
        title: "Chuẩn bị hồ sơ đăng ký",
        description: "Soạn điều lệ, danh sách thành viên/cổ đông, giấy tờ liên quan",
      },
      {
        title: "Nộp hồ sơ & theo dõi",
        description: "Nộp Sở KH&ĐT, bổ sung nếu có yêu cầu",
      },
      {
        title: "Nhận kết quả & bàn giao",
        description: "Nhận GCNĐKKD, con dấu, tư vấn bước tiếp theo (nếu có)",
      },
    ],
  },
  {
    name: "Hình sự — bào chữa cơ bản",
    description: "Các bước bào chữa/bảo vệ quyền lợi người bị buộc tộm từ giai đoạn đầu",
    steps: [
      {
        title: "Tiếp nhận vụ việc",
        description: "Ký hợp đồng, thu thập thông tin và tài liệu ban đầu",
      },
      {
        title: "Gặp thân chủ & làm việc cơ quan",
        description: "Gặp thân chủ, làm việc với CQĐT/Tòa án theo quy định",
      },
      {
        title: "Nghiên cứu hồ sơ vụ án",
        description: "Đọc hồ sơ, xác định tình tiết và hướng bào chữa",
      },
      {
        title: "Chuẩn bị văn bản & đề xuất",
        description: "Soạn đơn đề nghị, kháng cáo, kiến nghị theo từng giai đoạn",
      },
      {
        title: "Tham gia phiên họp / xét xử",
        description: "Bào chữa tại phiên họp, phiên tòa theo lịch",
      },
    ],
  },
];

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!admin) {
    throw new Error("Không tìm thấy user ADMIN/MANAGER để gán createdById");
  }

  for (const template of workflowSeeds) {
    const existing = await prisma.workflowTemplate.findFirst({
      where: { name: template.name },
      select: { id: true },
    });

    if (existing) {
      await prisma.workflowTemplateStep.deleteMany({
        where: { templateId: existing.id },
      });
      await prisma.workflowTemplate.update({
        where: { id: existing.id },
        data: {
          description: template.description,
          isActive: true,
          steps: {
            create: template.steps.map((step, index) => ({
              title: step.title,
              description: step.description,
              sortOrder: index + 1,
            })),
          },
        },
      });
      continue;
    }

    await prisma.workflowTemplate.create({
      data: {
        name: template.name,
        description: template.description,
        isActive: true,
        createdById: admin.id,
        steps: {
          create: template.steps.map((step, index) => ({
            title: step.title,
            description: step.description,
            sortOrder: index + 1,
          })),
        },
      },
    });
  }

  const rows = await prisma.workflowTemplate.findMany({
    include: { _count: { select: { steps: true } } },
    orderBy: { name: "asc" },
  });
  console.log(
    "Workflows seeded:",
    rows.map((row) => `${row.name} (${row._count.steps} bước)`).join("\n"),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
