# Library — CRUD 2 ตาราง (catalogs 1—N books) + อัปโหลดปก

โปรเจกต์ฝึกสอบ Web Contemporary: Next.js (App Router) + Express + Multer

## เลือก backend ไหนตอนสอบ (อ่านตรงนี้ก่อน)
| สถานการณ์ในโจทย์ | ใช้ |
|---|---|
| ไม่พูดถึง DB เลย / ให้เก็บอะไรก็ได้ / ให้ swagger มาโดยไม่บอกเรื่อง DB | `backend/` (data.json) — เร็ว เสี่ยงน้อย |
| บอกให้ใช้ SQLite/MySQL/Prisma หรือให้ schema/ER มา | `backend-prisma/` (ดู `backend-prisma/README.md`) |
| อาจารย์ให้ backend มาแล้ว ขาดแค่ frontend JS | ไม่ต้องใช้ทั้งสองอัน ใช้ของที่อาจารย์ให้ แล้วดู `html-version/` เป็นแนวทาง |

- API ของ `backend/` กับ `backend-prisma/` เหมือนกันทุก endpoint → `frontend/` และ `html-version/` ใช้ได้กับทั้งสอง
- Prisma ติดตั้งช้ากว่า (`db push` ต้องโหลด engine จากเน็ต) ใช้เมื่อโจทย์บังคับเท่านั้น
- `backend-prisma/` ยังไม่เคยรันทดสอบจริง ให้ลองรันให้ผ่านก่อนวันสอบ

## วิธี clone โปรเจกต์มาใช้ (เครื่องใหม่ / ห้องสอบ)
```bash
# 1) clone ลงโฟลเดอร์ปัจจุบัน  (แก้ <user>/<repo> เป็นของตัวเอง)
git clone https://github.com/<user>/<repo>.git

# 2) clone แล้วตั้งชื่อ/ไปไว้โฟลเดอร์ที่ต้องการ (ท้ายคำสั่งคือ path ปลายทาง)
git clone https://github.com/<user>/<repo>.git D:/exam/library-crud     # Windows
git clone https://github.com/<user>/<repo>.git ~/exam/library-crud      # macOS/Linux

# 3) เข้าโฟลเดอร์ แล้วติดตั้งเฉพาะส่วนที่จะใช้ (node_modules ไม่ได้อยู่ใน repo)
cd library-crud/backend && npm install && npm start            # แบบ data.json
# หรือ
cd library-crud/backend-prisma && npm install && npx prisma db push && npm start   # แบบ Prisma
```
- ต้องมี Node.js และ git ติดตั้งในเครื่อง ตรวจด้วย `node -v` และ `git --version`
- ถ้า repo เป็น private ต้อง login ก่อน (token หรือ GitHub CLI) — ที่ง่ายสุดคือตั้งเป็น public
- ถ้าไม่มี git ให้กด Code → Download ZIP บนหน้า GitHub แล้วแตกไฟล์แทน
- `backend-prisma/.env` อยู่ใน `.gitignore` ถ้า clone มาแล้วไม่มี ให้สร้างเองด้วยบรรทัด `DATABASE_URL="file:./dev.db"`

## วิธีรัน
```bash
# Backend -> http://localhost:4000
cd backend && npm install && npm start

# Frontend -> http://localhost:3000 (เปิดอีก terminal)
cd frontend && npm install && npm run dev
```
แก้ URL ของ API ได้ที่ `frontend/.env.local` (`NEXT_PUBLIC_API_URL`)

## API
| Method | Path | หมายเหตุ |
|---|---|---|
| GET/POST | `/api/catalogs` | JSON |
| GET/PUT/DELETE | `/api/catalogs/:id` | DELETE → 409 ถ้ายังมีหนังสือ |
| GET | `/api/books?q=&catalogId=` | ค้นหา + กรอง, แนบ `catalogName` |
| POST | `/api/books` | multipart/form-data, ไฟล์ field ชื่อ `cover` |
| GET/PUT/DELETE | `/api/books/:id` | PUT เปลี่ยนปกได้, DELETE ลบไฟล์ปกด้วย |

ข้อกำหนด validate: `title`, `author`, `price`, `catalogId` (ต้องมีอยู่จริง) — ผิดตอบ 400

## ฝึก gen code จาก OpenAPI
ไฟล์ `openapi.yaml` อธิบาย API ทั้งหมด

```bash
# Backend (Express)
npx @openapitools/openapi-generator-cli generate -i openapi.yaml -g nodejs-express-server -o gen/backend
# Frontend client (TypeScript types)
npx openapi-typescript openapi.yaml -o gen/api-types.ts
# Frontend client (ฟังก์ชันเรียก API)
npx orval --input openapi.yaml --output gen/client.ts
```
หรือ Import `openapi.yaml` เข้า Postman เพื่อสร้าง Collection

## จุดที่ควรเข้าใจสำหรับสอบ
- ฟอร์มอัปโหลดใช้ `FormData` และห้ามตั้ง `Content-Type` เอง (browser ใส่ boundary ให้)
- ชื่อ field ไฟล์ต้องตรงกัน: `fd.append("cover", file)` ↔ `upload.single("cover")`
- ลบ/เปลี่ยนปกต้องลบไฟล์เก่าด้วย, ข้อมูลไม่ผ่าน validate ต้องลบไฟล์ที่เพิ่งอัปโหลด
- Foreign key: เช็ค `catalogId` ก่อนบันทึก และกันลบ catalog ที่ยังมีหนังสือ (409)

## ลำดับทำในห้องสอบ (แนะนำ)
1. Backend: ตั้ง `express + cors + multer` และ helper อ่าน/เขียนข้อมูล (ส่วนบนของ `server.js`)
2. ทำ CRUD ตารางแม่ (catalogs) ก่อน → ทดสอบใน Postman/Swagger
3. ทำ CRUD ตารางลูก (books) + `validateBook` + อัปโหลดปก → ทดสอบส่งไฟล์
4. Frontend: `lib/api.js` → หน้า list (ค้นหา/กรอง/ลบ) → `BookForm` (เพิ่ม/แก้ไข + อัปโหลด) → หน้ารายละเอียด → หน้า catalogs
5. ไล่เช็ค: ลบ catalog ที่มีหนังสือ (409), ไฟล์ไม่ใช่รูป (400), เปลี่ยนปกแล้วไฟล์เก่าถูกลบ

> คอมเมนต์ในโค้ดทุกไฟล์เป็นภาษาไทย ไล่อ่านจาก `backend/server.js` ก่อนได้เลย

## เวอร์ชัน HTML + JavaScript ธรรมดา (`html-version/`)
สำหรับกรณีข้อสอบให้ HTML/CSS มาแล้วต้องเขียนแค่ JS — ใช้ backend ตัวเดิม ไม่ต้อง build

```bash
cd backend && npm install && npm start
# เปิด http://localhost:4000/web/  (หรือเปิดไฟล์ html-version/index.html ด้วย Live Server)
```
- `js/api.js` ฟังก์ชันเรียก API (โหลดก่อนไฟล์อื่น) → `js/books.js` (list/ค้นหา/ลบ) → `js/book-form.js` (เพิ่ม/แก้ไข + อัปโหลด) → `js/book.js` (รายละเอียด) → `js/catalogs.js`
- ถ้า backend ใช้ port อื่น แก้ `API_URL` ใน `js/api.js`

## ฝึกเขียนเอง
ดู `PRACTICE.md` (โจทย์จำลอง + เช็คลิสต์ + วิธีให้คะแนนตัวเอง)
