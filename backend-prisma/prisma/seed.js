// =====================================================================
//  seed.js — ใส่ข้อมูลตัวอย่างเริ่มต้น (ไม่จำเป็นต้องมีในห้องสอบ แต่ช่วยให้ทดสอบเร็ว)
//  รันด้วย: npm run seed   (ต้อง db push ก่อน)
// =====================================================================
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // upsert = ถ้ามีแล้วไม่ทำซ้ำ / ถ้ายังไม่มีก็สร้าง  (รันซ้ำได้ไม่พัง)
  const novel = await prisma.catalog.upsert({
    where: { name: "นิยาย" }, update: {},
    create: { name: "นิยาย", description: "นวนิยายและเรื่องสั้น" },
  });
  const computer = await prisma.catalog.upsert({
    where: { name: "คอมพิวเตอร์" }, update: {},
    create: { name: "คอมพิวเตอร์", description: "หนังสือด้านการเขียนโปรแกรมและไอที" },
  });
  // createMany = เพิ่มหลายแถวทีเดียว
  if ((await prisma.book.count()) === 0) {
    await prisma.book.createMany({
      data: [
        { title: "Clean Code", author: "Robert C. Martin", price: 890, stock: 5, catalogId: computer.id },
        { title: "ปีศาจ", author: "เสนีย์ เสาวพงศ์", price: 250, stock: 12, catalogId: novel.id },
      ],
    });
  }
  console.log("seed เสร็จแล้ว");
}
main().finally(() => prisma.$disconnect()); // ปิดการเชื่อมต่อเมื่อจบ
