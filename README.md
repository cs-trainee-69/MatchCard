# Cat Card Game

เกมจับคู่ไพ่ตัวละครแมวแบบจับเวลา ผู้เล่นจะเปิดไพ่เพื่อหา Match สะสม Score และผ่าน Round ที่ยากขึ้นเรื่อย ๆ ก่อนหมดเวลา

## Game Center

บน production เกมเชื่อมรายการเดิม `cat-card` ด้วย SDK ส่วนกลาง ต้องเข้าสู่ระบบผ่าน Game Center ก่อนเริ่มเล่น
หนึ่ง Game Session นับหนึ่ง playable session; เมื่อหมดเวลาส่ง Score สุดท้าย และอ่าน Top 5 ออนไลน์แยกจาก High Score ในอุปกรณ์
ตรวจซ้ำวันที่ 15 ตุลาคม 2026: ค่าหลักของ Game API เปิดแล้ว และเว็บจริงมี integration
ยังต้องยืนยันนโยบาย Guest ที่ API/เอกสารขัดกัน และทดสอบยอดเล่น/ผลจริงเมื่อได้รับอนุญาต
ดู [ขั้นตอนส่งต่อและสถานะล่าสุด](docs/game-center-handoff.md)

ชุด E2E จำลอง Game Center และใช้เฉพาะเกมบน localhost/127.0.0.1 ไม่สร้างรอบบน production
เมื่อใช้ `npm run dev` บน localhost/127.0.0.1 จะใช้ Game Center จำลอง เล่นได้ทันทีโดยไม่ล็อกอิน
ไม่ส่งรอบหรือคะแนนจริง และไม่โหลดอันดับจริง มีป้ายโหมดพัฒนากำกับบนหน้าจอ
โหมดจำลองไม่รวมอยู่ใน production build; `npm run preview` ยังใช้การเข้าสู่ระบบจริง

หากติดตั้ง dependencies แล้ว เริ่มเล่นในเครื่องได้ด้วย:

```powershell
npm run dev
```

เปิด URL ที่ terminal แสดง (ปกติ http://localhost:5173) แล้วกดแตะเพื่อเริ่ม
ทดสอบโหมดนี้อัตโนมัติด้วย `npm run e2e:local`
ส่วน `npm run e2e` ใช้ Vite mode test เพื่อทดสอบ SDK จริงกับ API จำลอง แยกจากโหมดเล่นในเครื่อง

## สิ่งที่ต้องมี

- Node.js 22 ขึ้นไป
- pnpm 11 ขึ้นไป
- Docker Desktop หากต้องการรันผ่าน Docker
- Python และ Pillow หากต้องการสร้างรูป optimized ใหม่

ตรวจสอบเครื่องมือก่อนเริ่ม:

```sh
node --version
pnpm --version
```

ควรใช้ Node.js 22 ขึ้นไปและ pnpm 11 ขึ้นไป หากจะรัน E2E ต้องติดตั้ง Chromium ของ Playwright เพิ่มด้วย

## เริ่มรันในเครื่อง

หลัง clone repository แล้ว ให้คัดลอกไฟล์ตัวอย่าง environment และติดตั้ง dependencies จาก lockfile:

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

เปิด [http://127.0.0.1:5173](http://127.0.0.1:5173) หรือใช้พอร์ตที่กำหนดใน `.env` ใน PowerShell ใช้คำสั่งนี้แทน:

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

ตรวจสอบ production build ในเครื่อง:

```sh
pnpm build
pnpm preview
```

ถ้าติดตั้ง dependencies สำเร็จแล้ว จะไม่ต้องติดตั้งซ้ำทุกครั้งที่เปิดโปรเจค ให้รันเฉพาะ `pnpm dev` ได้เลย การเปลี่ยนค่าในไฟล์ `.env` ต้องหยุดแล้วเปิด server ใหม่เพื่อให้ค่าใหม่มีผล

## Environment

ไฟล์ environment ใช้รูปแบบ `ชื่อ ตัวแปร=ค่า` โดยไม่ต้องใส่คำว่า `export`:

```dotenv
PORT=5173
E2E_PORT=4173
E2E_BASE_URL=http://127.0.0.1:5173
```

ใช้ตัวพิมพ์ใหญ่และไม่มีช่องว่างรอบเครื่องหมาย `=` หากค่ามีช่องว่างให้ครอบด้วยเครื่องหมายคำพูด เช่น `NAME="Cat Card"` บรรทัดที่ขึ้นต้นด้วย `#` เป็น comment และไม่ถูกนำไปใช้

ไฟล์ที่รองรับ:

| ไฟล์ | ใช้เมื่อ | เก็บใน Git |
| --- | --- | --- |
| `.env.example` | template สำหรับเริ่มต้น | ได้ |
| `.env` | ค่า local ทั่วไป | ไม่ได้ |
| `.env.local` | ค่าเฉพาะเครื่องที่ใช้ทุก mode | ไม่ได้ |
| `.env.test` | ค่าเฉพาะตอนรัน Playwright | ไม่ได้ |
| `.env.test.local` | ค่า test เฉพาะเครื่อง | ไม่ได้ |

ลำดับ precedence คือค่า environment ที่ส่งเข้ามาจาก process สูงสุด ตามด้วยไฟล์ mode-specific ที่เฉพาะกว่า และไฟล์ทั่วไปท้ายสุด โดย Vite จะโหลด `.env`, `.env.local`, `.env.[mode]` และ `.env.[mode].local` ตาม mode ที่กำลังรัน [ดูรายละเอียดจาก Vite](https://vite.dev/guide/env-and-mode) ค่าในไฟล์ mode-specific จึงเหมาะกับการแยก `development`, `test` หรือ `production`

สำหรับโปรเจคนี้ `PORT` และ `E2E_PORT` เป็นค่าของ tooling/server จึงไม่ใช้ prefix `VITE_` และไม่ควรใส่ secret ใด ๆ ลงใน `.env` ที่ใช้กับ frontend

ค่าจาก environment ของ process ที่ว่างจะใช้ค่าเริ่มต้น พอร์ตต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 65535 และ server จะหยุดทันทีเมื่อพอร์ตถูกใช้งานอยู่แล้ว

| ตัวแปร | ค่าเริ่มต้น | ใช้สำหรับ |
| --- | ---: | --- |
| `PORT` | `5173` | พอร์ตของ Vite dev/preview และพอร์ตฝั่งเครื่องเมื่อใช้ Docker |
| `E2E_PORT` | `4173` | พอร์ต server ที่ Playwright เปิดเพื่อรัน E2E ในเครื่อง |
| `E2E_BASE_URL` | ว่าง | URL ของ server ในเครื่องที่รันอยู่แล้วสำหรับ Playwright (localhost/127.0.0.1) |
| `PERF_URL` | `http://127.0.0.1:${PORT}` | URL เป้าหมายของ performance measurement |
| `PERF_SCREENSHOT` | ว่าง | path สำหรับบันทึก screenshot ระหว่างวัด performance |

ตัวอย่างการตั้งค่าที่พบบ่อย:

```dotenv
# ใช้พอร์ต 5180 สำหรับ Vite และ Docker
PORT=5180

# ให้ Playwright ใช้พอร์ตแยกจาก Vite dev server
E2E_PORT=5181

# ใช้เมื่อมี server ในเครื่องรันอยู่แล้ว และไม่ต้องการให้ Playwright เปิด Vite ใหม่
E2E_BASE_URL=http://127.0.0.1:5180

# ใช้เมื่อวัด server คนละตัวกับ PORT
PERF_URL=http://127.0.0.1:5180
PERF_SCREENSHOT=docs/performance.png
```

หลังแก้ `.env` ให้ restart คำสั่งที่กำลังรันอยู่เสมอ สำหรับ Docker ค่า `PORT` ใช้ map พอร์ตฝั่งเครื่องไปยัง Nginx ภายใน container ที่พอร์ต 80 จึงต้อง recreate container เมื่อเปลี่ยนค่า

## คำสั่งที่ใช้บ่อย

```sh
pnpm dev              # เปิด Vite development server
pnpm build            # typecheck และสร้าง dist
pnpm preview          # เปิด production build ในเครื่อง
pnpm typecheck        # ตรวจ TypeScript
pnpm test             # รัน unit และ component tests
pnpm e2e              # รัน Playwright tests
pnpm perf:measure     # วัด performance จาก server ที่กำหนด
pnpm assets:optimize  # สร้างรูป optimized ใหม่ (ต้องมี Python/Pillow)
```

Playwright จะเปิด Vite server ที่ `E2E_PORT` ให้อัตโนมัติ หากต้องการทดสอบ server ที่รันอยู่แล้ว เช่น Docker ให้กำหนด `E2E_BASE_URL` ก่อนรัน:

```sh
E2E_BASE_URL=http://127.0.0.1:5173 pnpm e2e
```

ใน PowerShell:

```powershell
$env:E2E_BASE_URL = "http://127.0.0.1:5173"
pnpm e2e
Remove-Item Env:E2E_BASE_URL
```

## รันด้วย Docker

ตรวจสอบว่า Docker Desktop กำลังทำงาน แล้วเริ่ม production container:

```sh
cp .env.example .env
docker compose up --build -d
```

ใน PowerShell ใช้ `Copy-Item .env.example .env` แทนคำสั่ง `cp` จากนั้นเปิดเว็บที่ `http://127.0.0.1:5173` หรือพอร์ตที่ตั้งใน `.env`

คำสั่งจัดการ container:

```sh
docker compose logs -f
docker compose ps
docker compose down
```

เมื่อเปลี่ยน `PORT` ใน `.env` ให้สร้าง container ใหม่โดยไม่ต้อง build image ใหม่:

```sh
docker compose up -d --force-recreate
```

Compose map พอร์ตฝั่งเครื่องไปยัง Nginx ภายใน container ที่พอร์ต 80 ดังนั้นการเปลี่ยน `PORT` จะเปลี่ยนเฉพาะพอร์ตที่เปิดให้เข้าจากเครื่อง

## Performance measurement

เริ่ม preview server ก่อน แล้ววัดผลในอีก terminal:

```sh
pnpm preview
pnpm perf:measure docs/performance.json
```

ใช้ `PERF_URL` เพื่อวัด deployment อื่น หรือใช้ `PERF_SCREENSHOT` เพื่อบันทึกภาพหน้าจอ เช่น:

```sh
PERF_URL=http://127.0.0.1:5183 PERF_SCREENSHOT=docs/performance.png pnpm perf:measure
```

## โครงสร้างหลัก

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| `src/domain/` | กฎของ Game Session, Board, Match และ Score |
| `src/runtime/` | clock, sound preference และการเชื่อม state กับหน้าจอ |
| `src/presentation/` | React components ของเกมและ HUD |
| `src/styles/` | CSS ของ game surface และ responsive layout |
| `e2e/` | การทดสอบการเล่นผ่าน browser จริง |
| `config/` | การตรวจสอบค่าพอร์ตที่ใช้ร่วมกันใน tooling |
| `assets/` | รูปภาพและเสียงที่ใช้ในเกม |

## แก้ปัญหาเบื้องต้น

- ถ้าเจอ `Port ... is already in use` ให้เปลี่ยน `PORT` หรือ `E2E_PORT` ให้ไม่ชนกับ process อื่น
- ถ้า E2E พยายามเปิด server ใหม่ ให้ตรวจว่าไม่ได้ตั้ง `E2E_BASE_URL` ค้างไว้
- ถ้า Docker ใช้งานไม่ได้ ให้เปิด Docker Desktop แล้วตรวจด้วย `docker compose config`
