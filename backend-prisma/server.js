// =====================================================================
//  Library API (เวอร์ชัน Prisma + SQLite) — Express + Multer
//  API หน้าตาเหมือน backend/server.js (เวอร์ชัน data.json) ทุกอย่าง
//  => frontend (Next.js / html-version) ใช้ต่อได้เลย ไม่ต้องแก้
//
//  สิ่งที่ต่างจากเวอร์ชัน JSON มีแค่ "วิธีอ่าน/เขียนข้อมูล":
//     เดิม  readDb()/writeDb() แล้ว filter/find เอง
//     ใหม่  prisma.book.findMany() / create() / update() / delete()
//
//  ใช้ในห้องสอบเมื่อ: โจทย์ให้ใช้ฐานข้อมูลจริง (SQLite/MySQL) หรือให้ schema มา
//  ลำดับทำ: 1) แก้ prisma/schema.prisma  2) npx prisma db push  3) แก้ส่วน
//          "validate" กับ "toData" ด้านล่างให้ตรง field ของโจทย์  4) ที่เหลือแทบไม่ต้องแก้
// =====================================================================

// ---------- 1) นำเข้า library ----------
const express = require("express");           // ตัวทำ REST API
const cors = require("cors");                 // อนุญาต frontend ต่าง port เรียก API
const multer = require("multer");             // รับไฟล์อัปโหลด (multipart/form-data)
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client"); // ตัวคุยกับฐานข้อมูล (สร้างจาก schema.prisma)

const prisma = new PrismaClient(); // สร้างครั้งเดียว ใช้ทั้งโปรแกรม (อย่าสร้างใหม่ในทุก request)
const app = express();
const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = path.join(__dirname, "uploads"); // โฟลเดอร์เก็บรูปปก

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR); // ไม่มีโฟลเดอร์ก็สร้าง กัน error ตอนรันครั้งแรก

// ---------- 2) middleware (ทำงานก่อนถึง route ทุกตัว) ----------
app.use(cors());                                  // เปิด CORS
app.use(express.json());                          // อ่าน body แบบ JSON -> req.body (ใช้กับ catalogs)
app.use(express.urlencoded({ extended: true }));  // อ่าน body แบบฟอร์มธรรมดา
app.use("/uploads", express.static(UPLOAD_DIR));  // เปิดรูปได้ที่ /uploads/ชื่อไฟล์
app.use("/web", express.static(path.join(__dirname, "..", "html-version"))); // เว็บ HTML ธรรมดาที่ /web/

// ---------- 3) ฟังก์ชันช่วย (helper) ----------

// ห่อ route แบบ async: ถ้าข้างในเกิด error (เช่น DB พัง) ให้โยนไป error handler ท้ายไฟล์
// ถ้าไม่ห่อ Express 4 จะไม่จับ error ของ async function => server ค้าง/ตายเงียบๆ
// วิธีใช้: app.get("/x", wrap(async (req, res) => { ... }))
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// แปลง :id ใน URL (เป็น string) เป็นตัวเลข / ถ้าไม่ใช่ตัวเลขคืน null
// (ถ้าส่ง NaN ให้ Prisma จะ error จึงต้องกันก่อน)
const toId = (v) => (Number.isInteger(Number(v)) && v !== "" ? Number(v) : null);

// ลบไฟล์รูปในโฟลเดอร์ uploads (รับได้ทั้ง "/uploads/x.jpg" และ "x.jpg")
const removeFile = (url) => {
  if (!url) return;
  const p = path.join(UPLOAD_DIR, path.basename(url)); // basename กัน path แปลกๆ เช่น ../../
  if (fs.existsSync(p)) fs.unlinkSync(p);
};

// แปลงผลจาก Prisma ให้หน้าตาเหมือนเวอร์ชัน JSON: แปะ catalogName และเอา object catalog ซ้อนออก
// (include: { catalog: true } ทำให้ได้ book.catalog = {id,name,...} มาด้วย — เหมือน JOIN ใน SQL)
const toBookDto = ({ catalog, ...book }) => ({ ...book, catalogName: catalog ? catalog.name : null });

// ---------- 4) ตั้งค่าอัปโหลดไฟล์ (multer) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // ชื่อไฟล์ใหม่ = เวลา + เลขสุ่ม + นามสกุลเดิม (กันชื่อซ้ำ / ภาษาไทยเพี้ยน)
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e6) + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // จำกัด 5MB
  fileFilter: (req, file, cb) =>
    // รับเฉพาะรูป: cb(null,true)=ผ่าน / cb(new Error)=ปฏิเสธ (ไปตกที่ error handler ท้ายไฟล์)
    /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error("อนุญาตเฉพาะไฟล์รูปภาพ (jpg, png, gif, webp)")),
});
// วิธีใช้: ใส่ upload.single("cover") เป็นตัวกลางใน route
//   -> ไฟล์อยู่ที่ req.file / ช่องข้อความอื่นอยู่ที่ req.body
//   -> "cover" ต้องตรงกับ frontend: fd.append("cover", file)

app.get("/", (req, res) => res.json({ message: "Library API (Prisma) is running" })); // ไว้เช็คว่า server ทำงาน

// =====================================================================
//  CATALOGS (ตารางแม่) — รับส่งเป็น JSON ไม่มีไฟล์
// =====================================================================

// READ ทั้งหมด + นับจำนวนหนังสือในแต่ละ catalog
app.get("/api/catalogs", wrap(async (req, res) => {
  const rows = await prisma.catalog.findMany({
    orderBy: { id: "asc" },                    // เรียงตาม id น้อย->มาก
    include: { _count: { select: { books: true } } }, // _count = ให้ DB นับจำนวนลูกให้ (เหมือน COUNT(*))
  });
  // แปลง _count.books เป็น bookCount ให้ frontend ใช้ง่าย
  res.json(rows.map(({ _count, ...c }) => ({ ...c, bookCount: _count.books })));
}));

// READ ตาม id
app.get("/api/catalogs/:id", wrap(async (req, res) => {
  const id = toId(req.params.id);
  const item = id === null ? null : await prisma.catalog.findUnique({ where: { id } }); // findUnique = หาด้วยคีย์ที่ไม่ซ้ำ
  if (!item) return res.status(404).json({ message: "ไม่พบ catalog" }); // 404 = ไม่พบ
  res.json(item);
}));

// CREATE
app.post("/api/catalogs", wrap(async (req, res) => {
  const { name, description = "" } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "กรุณากรอกชื่อ catalog" }); // 400 = ข้อมูลไม่ถูกต้อง
  // เช็คชื่อซ้ำเอง เพื่อตอบข้อความไทยสวยๆ (ถ้าไม่เช็ค Prisma จะโยน error P2002 จาก @unique)
  const dup = await prisma.catalog.findUnique({ where: { name: name.trim() } });
  if (dup) return res.status(409).json({ message: "ชื่อ catalog ซ้ำ" }); // 409 = ขัดแย้งกับข้อมูลเดิม
  const item = await prisma.catalog.create({ data: { name: name.trim(), description } }); // INSERT
  res.status(201).json(item); // 201 = สร้างสำเร็จ
}));

// UPDATE
app.put("/api/catalogs/:id", wrap(async (req, res) => {
  const id = toId(req.params.id);
  const old = id === null ? null : await prisma.catalog.findUnique({ where: { id } });
  if (!old) return res.status(404).json({ message: "ไม่พบ catalog" });
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "กรุณากรอกชื่อ catalog" });
  // ชื่อซ้ำกับ "อันอื่น" หรือไม่ (ถ้าซ้ำกับตัวเองคือไม่เปลี่ยนชื่อ ถือว่าผ่าน)
  const dup = await prisma.catalog.findUnique({ where: { name: name.trim() } });
  if (dup && dup.id !== id) return res.status(409).json({ message: "ชื่อ catalog ซ้ำ" });
  const item = await prisma.catalog.update({
    where: { id },                                           // แก้แถวไหน
    data: { name: name.trim(), description: description ?? old.description }, // แก้เป็นอะไร (ไม่ส่งมา=ใช้ค่าเดิม)
  });
  res.json(item);
}));

// DELETE — ห้ามลบ catalog ที่ยังมีหนังสืออยู่ (ความสัมพันธ์ 1-N)
app.delete("/api/catalogs/:id", wrap(async (req, res) => {
  const id = toId(req.params.id);
  const old = id === null ? null : await prisma.catalog.findUnique({ where: { id } });
  if (!old) return res.status(404).json({ message: "ไม่พบ catalog" });
  const used = await prisma.book.count({ where: { catalogId: id } }); // นับหนังสือที่ใช้ catalog นี้
  if (used > 0) return res.status(409).json({ message: "ลบไม่ได้ เพราะยังมีหนังสืออยู่ใน catalog นี้" });
  await prisma.catalog.delete({ where: { id } }); // DELETE
  res.json({ message: "ลบ catalog เรียบร้อย", id });
}));

// =====================================================================
//  BOOKS (ตารางลูก) — รับส่งเป็น multipart/form-data เพราะมีไฟล์ปก
// =====================================================================

// READ ทั้งหมด รองรับ ?q=คำค้น และ ?catalogId=1
app.get("/api/books", wrap(async (req, res) => {
  const { q = "", catalogId = "" } = req.query;
  const where = {}; // เงื่อนไขค้นหา (เหมือน WHERE) ค่อยๆ ใส่ตามที่ส่งมา
  if (q) {
    // OR = ตรงอย่างใดอย่างหนึ่ง / contains = มีคำนี้อยู่ข้างใน (LIKE '%q%')
    // หมายเหตุ: SQLite เทียบ contains แบบไม่สนตัวพิมพ์เล็กใหญ่เฉพาะภาษาอังกฤษ ภาษาไทยไม่มีปัญหา
    where.OR = [{ title: { contains: q } }, { author: { contains: q } }];
  }
  if (toId(catalogId) !== null) where.catalogId = toId(catalogId); // กรองตาม catalog
  const rows = await prisma.book.findMany({
    where,
    include: { catalog: true },   // JOIN เอาข้อมูล catalog มาด้วย
    orderBy: { id: "desc" },      // ใหม่สุดขึ้นก่อน
  });
  res.json(rows.map(toBookDto));
}));

// READ ตาม id
app.get("/api/books/:id", wrap(async (req, res) => {
  const id = toId(req.params.id);
  const item = id === null ? null : await prisma.book.findUnique({ where: { id }, include: { catalog: true } });
  if (!item) return res.status(404).json({ message: "ไม่พบหนังสือ" });
  res.json(toBookDto(item));
}));

// ---------- validate: ตรวจข้อมูลก่อนบันทึก (ใช้ทั้งเพิ่มและแก้) ----------
// คืนข้อความ error ถ้าไม่ผ่าน / คืน null ถ้าผ่าน
// *** ถ้าโจทย์เพิ่ม/ลด field ให้แก้ตรงนี้ ***
// (เป็น async เพราะต้องถาม DB ว่า catalogId มีจริงไหม)
const validateBook = async (body) => {
  if (!body.title || !body.title.trim()) return "กรุณากรอกชื่อหนังสือ";
  if (!body.author || !body.author.trim()) return "กรุณากรอกชื่อผู้แต่ง";
  if (body.price === undefined || body.price === "" || isNaN(Number(body.price)) || Number(body.price) < 0)
    return "ราคาไม่ถูกต้อง";
  // เช็ค foreign key: catalogId ต้องมีอยู่จริงในตาราง Catalog
  const cid = toId(body.catalogId);
  if (cid === null || !(await prisma.catalog.findUnique({ where: { id: cid } }))) return "ไม่พบ catalog ที่เลือก";
  return null;
};

// ---------- toData: แปลงข้อมูลฟอร์ม -> object ที่จะส่งให้ Prisma ----------
// multipart ส่งทุกอย่างมาเป็น string จึงต้อง Number() ตัวเลข
// *** ถ้าโจทย์เพิ่ม/ลด field ให้แก้ตรงนี้ด้วย (ชื่อต้องตรงกับ schema.prisma) ***
const toData = (body) => ({
  title: body.title.trim(),
  author: body.author.trim(),
  price: Number(body.price),
  stock: Number(body.stock || 0),
  description: body.description ?? "",
  catalogId: Number(body.catalogId),
});

// CREATE + อัปโหลดปก
app.post("/api/books", upload.single("cover"), wrap(async (req, res) => {
  const err = await validateBook(req.body);
  if (err) {
    if (req.file) removeFile(req.file.filename); // ข้อมูลไม่ผ่าน -> ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง ไม่ให้ค้าง
    return res.status(400).json({ message: err });
  }
  const item = await prisma.book.create({
    data: { ...toData(req.body), cover: req.file ? `/uploads/${req.file.filename}` : null }, // เก็บ "path" ไม่ใช่ตัวไฟล์
    include: { catalog: true },
  });
  res.status(201).json(toBookDto(item));
}));

// UPDATE + เปลี่ยนปกได้ (ไม่ส่งไฟล์มา = ใช้ปกเดิม)
app.put("/api/books/:id", upload.single("cover"), wrap(async (req, res) => {
  const id = toId(req.params.id);
  const old = id === null ? null : await prisma.book.findUnique({ where: { id } });
  if (!old) {
    if (req.file) removeFile(req.file.filename); // ไม่พบข้อมูล -> ลบไฟล์ใหม่ที่เพิ่งอัปโหลด
    return res.status(404).json({ message: "ไม่พบหนังสือ" });
  }
  const err = await validateBook(req.body);
  if (err) {
    if (req.file) removeFile(req.file.filename);
    return res.status(400).json({ message: err });
  }
  const data = toData(req.body);
  if (req.file) data.cover = `/uploads/${req.file.filename}`; // มีไฟล์ใหม่ -> ใช้ปกใหม่ (ไม่ใส่ cover = Prisma ไม่แตะค่าเดิม)
  const item = await prisma.book.update({ where: { id }, data, include: { catalog: true } }); // updatedAt อัปเดตเอง
  if (req.file) removeFile(old.cover); // บันทึกสำเร็จแล้วค่อยลบปกเก่า (กันกรณี DB พังแล้วปกเก่าหายไปด้วย)
  res.json(toBookDto(item));
}));

// DELETE — ลบข้อมูล + ลบไฟล์ปกด้วย
app.delete("/api/books/:id", wrap(async (req, res) => {
  const id = toId(req.params.id);
  const old = id === null ? null : await prisma.book.findUnique({ where: { id } });
  if (!old) return res.status(404).json({ message: "ไม่พบหนังสือ" });
  await prisma.book.delete({ where: { id } });
  removeFile(old.cover);
  res.json({ message: "ลบหนังสือเรียบร้อย", id });
}));

// ---------- ตัวจัดการ error สุดท้าย (ต้องอยู่ท้ายสุด ต่อจาก route ทั้งหมด) ----------
// error จาก multer (ไฟล์ผิดประเภท/ใหญ่เกิน) และจาก wrap() จะมาตกที่นี่ -> ตอบเป็น JSON ให้ frontend โชว์ได้
// มี 4 พารามิเตอร์ (err, req, res, next) Express ถึงจะรู้ว่านี่คือ error handler
app.use((err, req, res, next) => {
  console.error(err); // log ไว้ดูใน terminal
  // Prisma P2002 = ชนค่า unique, P2003 = ชน foreign key (เช่นลบแม่ที่ยังมีลูก)
  if (err.code === "P2002") return res.status(409).json({ message: "ข้อมูลซ้ำ" });
  if (err.code === "P2003") return res.status(409).json({ message: "ข้อมูลถูกอ้างอิงอยู่ จึงลบ/แก้ไม่ได้" });
  if (err.code === "P2025") return res.status(404).json({ message: "ไม่พบข้อมูล" });
  const fromUpload = err instanceof multer.MulterError || /รูปภาพ/.test(err.message);
  res.status(fromUpload ? 400 : 500).json({ message: err.message });
});

// ปิดการเชื่อมต่อ DB ให้เรียบร้อยเมื่อกด Ctrl+C
process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });

app.listen(PORT, () => console.log(`Library API (Prisma) -> http://localhost:${PORT}`));
