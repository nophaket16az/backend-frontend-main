# backend-prisma — เวอร์ชัน Prisma + SQLite

API เหมือน `../backend` (data.json) ทุก endpoint → frontend ใช้ต่อได้เลย

## รัน
```bash
npm install
npx prisma db push     # สร้างไฟล์ prisma/dev.db + ตาราง + Prisma Client
npm run seed           # (ไม่บังคับ) ใส่ข้อมูลตัวอย่าง
npm start              # http://localhost:4000
npm run studio         # เปิดหน้าดู/แก้ข้อมูลใน DB (Prisma Studio)
```

## ไฟล์ไหนทำอะไร
| ไฟล์ | หน้าที่ | ในห้องสอบต้องแก้อะไร |
|---|---|---|
| `prisma/schema.prisma` | นิยามตาราง/คอลัมน์/ความสัมพันธ์ | เปลี่ยนชื่อ model + field ให้ตรงโจทย์ |
| `server.js` | REST API ทั้งหมด | แก้ `validateBook` + `toData` ให้ตรง field |
| `prisma/seed.js` | ข้อมูลตัวอย่าง | ไม่ต้องก็ได้ |
| `.env` | ที่อยู่ไฟล์ DB | ปกติไม่ต้องแก้ |

## เปลี่ยนโจทย์ (เช่น books/catalogs -> products/categories)
1. แก้ชื่อ model/field ใน `schema.prisma` → `npx prisma db push`
2. Find & Replace ใน `server.js`: `prisma.book` → `prisma.product`, `prisma.catalog` → `prisma.category`, `/api/books` → `/api/products` ฯลฯ
3. แก้ `validateBook` และ `toData` ตาม field ใหม่
4. เพิ่ม/ลด field แล้ว db push ฟ้อง data loss ให้ใช้ `npx prisma db push --force-reset` (ล้างข้อมูลเดิม)

## ตารางคำสั่ง Prisma ที่ใช้บ่อย (เทียบ SQL)
| Prisma | SQL |
|---|---|
| `findMany({ where, orderBy, include })` | SELECT ... WHERE ... ORDER BY ... JOIN |
| `findUnique({ where: { id } })` | SELECT ... WHERE id = ? (ได้ 1 แถว/null) |
| `create({ data })` | INSERT |
| `update({ where, data })` | UPDATE (ไม่พบแถวจะ throw P2025) |
| `delete({ where })` | DELETE |
| `count({ where })` | SELECT COUNT(*) |
| `include: { catalog: true }` | JOIN เอาตารางแม่มาแนบ |
| `include: { _count: { select: { books: true } } }` | นับลูก |

## ถ้าข้อสอบให้ many-to-many (เช่น หนังสือหลายหมวด)
```prisma
model Book    { id Int @id @default(autoincrement())  tags Tag[] }
model Tag     { id Int @id @default(autoincrement())  books Book[] }  // Prisma สร้างตารางกลางให้เอง
// เพิ่ม: prisma.book.create({ data: { ..., tags: { connect: [{ id: 1 }, { id: 2 }] } } })
// อ่าน : prisma.book.findMany({ include: { tags: true } })
```
