# ส่งต่อผู้ดูแล: เชื่อม Cat Card กับ Game Center

วันที่ตรวจข้อมูล: 15 ตุลาคม 2026 (Asia/Bangkok)

**สถานะล่าสุดจากการตรวจซ้ำ 15 ตุลาคม 2026:** ค่าหลักของ Game API พร้อมแล้ว และเว็บจริงมีโค้ด integration
การตรวจครั้งนี้อ่านข้อมูลสาธารณะเท่านั้น ไม่มีการบันทึก CMS หรือเริ่มรอบ/ส่งผลบน production
ข้อความและตาราง “ก่อนทำงาน” ด้านล่างเป็นประวัติการตรวจครั้งแรก ไม่ใช่สถานะปัจจุบัน

## ผลตรวจซ้ำและสิ่งที่ยังค้าง

หลักฐานอ่านกลับล่าสุด: [cat-card-game-center-verification.json](cat-card-game-center-verification.json)
ไฟล์นี้เป็นบันทึกการตรวจสอบ ไม่ใช่ request body หรือนำเข้า CMS

| ส่วน | สถานะที่ตรวจซ้ำได้ |
| --- | --- |
| เปิดรับรอบ/คะแนน | `enabled=true`, revision 2 |
| นโยบายผล | `reviewRequired=false`, `allowClientRanking=true` |
| รุ่น/โหมด/ทิศทาง | `1.0.0` / `default` / `desc` ตรงกับโค้ด |
| อันดับ | HTTP สำเร็จ, `data: []` ไม่ได้ตอบ board_not_found แล้ว |
| เว็บจริง | โหลด `/assets/index-D0qo3-QE.js` และพบ grant, beginRound และ leaderboard ใน bundle |
| Git ในเครื่อง | พบ commit `21623db` (add stats and leaderboard.) และยังมีงานแก้หน้าผลเกมที่ไม่ commit |

สิ่งที่ต้องดำเนินการต่อ:

1. **ยืนยันนโยบาย Guest กับทีม Game Center:** API ส่ง `meta.period.guestEligible=true`
   แต่ `/docs/ranking.md` ระบุ Guest ไม่ขึ้นอันดับ จึงยังสรุปนโยบายจริงไม่ได้
   แก้ข้อความเกมในเครื่องให้เป็นกลางแล้ว โดยยึด `status` และ `rankingEligible` จาก receipt ของแต่ละรอบ
   ไม่อนุมานสิทธิ์จากประเภท Guest/สมาชิก และไม่เปลี่ยน global period หรือทดสอบด้วยคะแนนปลอม
   ทีม Game Center ยังต้องยืนยันความต่างระหว่างเอกสารกับ API; การแก้ข้อความนี้ยังไม่ได้เผยแพร่ในงานนี้
2. **ตรวจความต่างของ JSON ก่อนใช้:** ค่าหลัก 3 ช่องใน `cat-card-scoring.patch.json` ตรงกับระบบแล้ว
   ส่วน `rankingOutcomes` ปัจจุบันยังเป็น `["win","lose","complete","quit"]`
   แต่ไฟล์เสนอ `["complete"]` การจำกัดให้เหลือ complete เป็นข้อเสนอให้ตรงกับเกม ไม่ใช่เงื่อนไขที่บล็อกผล complete ปัจจุบัน
   ไม่ต้องส่ง patch ซ้ำเพียงเพื่อเปิดระบบที่เปิดแล้ว
3. **ทดสอบ acceptance จริงเมื่อได้รับอนุญาตแยก:** ยังไม่มีหลักฐาน Start เพิ่มยอด CMS,
   ผลจริงได้รับ receipt หรือสมาชิกที่มีสิทธิ์ปรากฏในอันดับ การอ่านอันดับว่างยืนยันเฉพาะ endpoint ทำงาน
4. **แยกรุ่นที่ออนไลน์ออกจากงานในเครื่อง:** เว็บจริงมี integration รุ่นที่ตรวจพบแล้ว
   แต่ไม่ได้ยืนยันว่างานปรับหน้าผลเกมล่าสุดใน working tree ถูกเผยแพร่ และไม่ได้ระบุ commit ฝั่ง deployment จาก bundle เพียงอย่างเดียว

ไฟล์ JSON สำหรับส่งค่าคือ `cat-card-scoring.patch.json` ซึ่งมีเฉพาะ property ของ ScoringRules
จึงไม่ใส่ gameId หรือ URL ใน body; เป้าหมาย `cat-card` อยู่ใน path ของ endpoint ตามหัวข้อ 3

## 1. รายการเกมเดิมและหลักฐานที่ตรวจได้

| รายการ | ค่าที่ตรวจพบ |
| --- | --- |
| ชื่อสาธารณะ | Cat Card |
| Game ID จากแค็ตตาล็อกจริง | `cat-card` |
| Launch URL | `https://cat-card.game.gamification.in.th/` |
| API/SDK origin | `https://center.game.gamification.in.th` |
| โหมดใน API | `default` |
| รุ่นเกมสำหรับ integration นี้ | `1.0.0` (ตรงกับรุ่นที่ส่วนกลางอนุญาต และปรับ package.json ให้ตรงกัน) |
| หน่วยคะแนน | จำนวนเต็ม Score; มากดีกว่า (`desc`) |
| ผลเมื่อเวลาหมด | `complete` |
| stats ที่ส่ง | `{}` ไม่มีการเพิ่ม field ที่ไม่อยู่ใน schema |

แค็ตตาล็อกมีรายการและภาพปกสามขนาดแล้ว งานนี้ไม่สร้างรายการใหม่หรือแทนที่ภาพ
HTML ที่ตรวจพบชี้ไปที่ `/assets/index-rD8eUXyl.js` ซึ่งไม่มี `gc_grant`, `beginRound`
หรือ endpoint leaderboard แต่มี `cat-card.high-score` จึงยังไม่พบ integration นี้ใน bundle ที่ให้บริการขณะตรวจ
ไม่ได้ยืนยันว่า commit บน production ตรงกับ local HEAD ทุกไฟล์

`GET /api/v1/games/cat-card/play-config` ขณะตรวจ: revision 1, enabled=false,
reviewRequired=true, allowClientRanking=false ส่วน endpoint current leaderboard ตอบ 404 `board_not_found`
ข้อมูลนี้เป็นสถานะ ณ เวลาตรวจ ไม่ใช่หลักฐานหลังบันทึกค่า/เผยแพร่

Preflight จาก production origin ตอบ `Access-Control-Allow-Origin: https://cat-card.game.gamification.in.th`
และรองรับ Authorization, Content-Type, Idempotency-Key กับ GET/POST
ต้องตรวจซ้ำกับ endpoint เริ่มรอบ/ส่งผลเมื่อเตรียมเผยแพร่ รวมถึง launch origin/path ซึ่งเป็นข้อจำกัดคนละส่วนกับ CORS

## 2. ผู้ดูแลต้องเข้าเมนูไหน

1. เปิด CMS ที่องค์กรใช้งานจริง และเข้าสู่ระบบด้วยบัญชีที่มี `configureScoring`
   (ตาม OpenAPI: Admin/Owner หรือบัญชีที่ได้รับสิทธิ์นี้โดยเฉพาะ)
2. ไปที่ **ระบบและสิทธิ์ → เชื่อมต่อ Game API** แล้วเลือก **Cat Card / cat-card**
3. ตรวจและตั้งค่าตามตารางด้านล่าง บันทึก แล้วโหลดค่ากลับมาใหม่
4. ที่ **เกมทั้งหมด → Cat Card** ตรวจ Launch URL และการแสดงรายการเดิม ไม่ต้องสร้างเกมใหม่
5. สำหรับตรวจสถิติภายหลังเผยแพร่ ใช้ **ภาพรวมการเล่น** ตามเอกสาร analytics ปัจจุบัน
   (Skill รุ่นเดิมเรียกเมนูนี้ว่า “สถิติการเล่น”)

ชื่อเมนู Game API อ้างจาก Skill; ไม่ได้ยืนยันหน้าจอ CMS ด้วย session ผู้ดูแลในงานนี้
ต้องขอ URL ของ CMS จริงจากผู้ดูแล ไม่ใช้ URL `/cms` ซึ่งตรวจแล้วตอบ not_found
หากชื่อช่องใน UI แตกต่าง ให้เทียบชื่อ property ในตารางและ OpenAPI ปัจจุบัน

## 3. ค่าที่ต้องตั้งเฉพาะ Cat Card

| ช่อง/Property | ค่าที่อ่านได้ก่อนทำงาน | ค่าที่ต้องการ/การดำเนินการ |
| --- | --- | --- |
| เปิดรับคะแนน `enabled` | `false` | **`true`** เปิดรับ playable sessions และผล |
| รุ่นเกม `gameVersions` | `["1.0.0"]` | คง `["1.0.0"]` |
| โหมด `modes` | `["default"]` | คง `["default"]` |
| ทิศทาง `direction` | `desc` | คง `desc` |
| คะแนนขั้นต่ำ `minScore` | `"0"` | คง `"0"` รองรับเล่นแล้วไม่ได้คะแนน |
| คะแนนสูงสุด `maxScore` | `"1000000"` | คง `"1000000"` ในรอบนี้ ยังไม่ได้พิสูจน์เพดานที่เหมาะสมสำหรับตรวจโกง |
| ระยะเวลาขั้นต่ำ `minDurationMs` | `0` | คง `0` |
| ระยะเวลาสูงสุด `maxDurationMs` | `21600000` (6 ชั่วโมง) | คง `21600000` ก่อน ไม่ลดเหลือ 120000 |
| ตรวจผลก่อนขึ้นอันดับ `reviewRequired` | `true` | **`false`** ตามขอบเขตที่ผู้ใช้สั่ง |
| รับผลรายงานจาก client เข้าอันดับ `allowClientRanking` | `false` | **`true`** เพื่อให้ผลจากเว็บเกมนี้มีสิทธิ์จัดอันดับโดยตรง |
| ผลที่ร่วมอันดับ `rankingOutcomes` | `["win","lose","complete","quit"]` | แนะนำ **`["complete"]`** ให้ตรงกับผลที่เกมส่ง |
| `statsSchema` | `{}` | คง `{}` |
| `eventTypes` | `[]` | คง `[]` ไม่มี custom events |
| `modeRules` | `{}` | คง `{}` ไม่มี override ให้ default เป็น asc |
| `timezone` | `Asia/Bangkok` | คง `Asia/Bangkok` |
| `maxStars` / `starThresholds` | `3` / `[]` | คงค่าเดิม งานนี้ไม่เพิ่มรางวัลหรือส่ง starsClaimed |

`allowClientRanking=true` เป็นการยอมรับคะแนนที่รายงานจาก browser สำหรับอันดับทั่วไป
โค้ดนี้ยังไม่มีระบบตรวจคะแนน authoritative ฝั่งเซิร์ฟเวอร์ และการปิด review ไม่ได้เปิด client ranking แทนกัน
ให้ผู้ดูแลยืนยันการใช้นโยบายนี้เฉพาะ Cat Card ไม่คัดลอกไปเกมอื่น

เหตุผลเรื่องเวลา: เกมเริ่มเวลาเล่น 120 วินาที แต่ Golden Card Event เพิ่มเวลาได้ 5 วินาที
และยังมี Countdown, First-Turn Hint, Golden Alert และ pause/resume ซึ่งใช้เวลาจริงเพิ่มเติม
ขอบเขตฝั่งเซิร์ฟเวอร์ต้องอ้างนิยามระยะเวลาของ Game API ไม่ใช่อ่านนาฬิกา HUD อย่างเดียว
ค่า 6 ชั่วโมงที่คงไว้เป็นค่าเดิม ไม่ใช่ข้อสรุปว่าเกมควรเล่นนาน 6 ชั่วโมงหรือเป็นเพดานตรวจโกงที่ผ่านการรับรอง

หากผู้ดูแลใช้ authenticated API แทน UI ตามกระบวนการขององค์กร:
OpenAPI ระบุ `PATCH /api/v1/admin/games/cat-card/scoring` โดยใช้สิทธิ์ CMS เท่านั้น
ค่าที่ตั้งใจเปลี่ยนมีเพียงชุดนี้ (ตรวจ semantics ของ PATCH และสำรองค่าปัจจุบันก่อน):

ไฟล์พร้อมใช้: [cat-card-scoring.patch.json](cat-card-scoring.patch.json)
ใช้เนื้อหาไฟล์เป็น JSON request body ของ endpoint ข้างต้น โดยส่ง `Content-Type: application/json`
และยืนยันตัวตนด้วยสิทธิ์ CMS ตามขั้นตอนขององค์กร ไฟล์นี้มีเฉพาะค่าที่ต้องการเปลี่ยน
ไม่มี credentials และไม่ใช่ไฟล์นำเข้าแค็ตตาล็อกหรือไฟล์ที่เกมโหลดอัตโนมัติ

```json
{
  "enabled": true,
  "reviewRequired": false,
  "allowClientRanking": true,
  "rankingOutcomes": ["complete"]
}
```

อย่าส่ง `revision` ซึ่งเป็น readOnly และอย่านำ CMS/member credentials ลงในโค้ดเกมหรือส่งผ่านแชต
ไม่มีการเรียก PATCH นี้ในงานของ Codex

## 4. ตรวจหลังบันทึก โดยยังไม่เริ่มเล่นจริง

อ่าน public endpoint:

```text
https://center.game.gamification.in.th/api/v1/games/cat-card/play-config
```

ตรวจ `data.enabled=true`, `reviewRequired=false`, `allowClientRanking=true`,
รุ่น 1.0.0, mode default, direction desc, rankingOutcomes มี complete และ revision หลังบันทึก
แนบค่าที่อ่านกลับมาเป็นหลักฐาน อย่าใช้ภาพสวิตช์ที่ยังไม่ได้ Save เป็นหลักฐานสำเร็จ

อ่าน:

```text
https://center.game.gamification.in.th/api/v1/games/cat-card/leaderboards/current/entries?mode=default&limit=5
```

ควรได้ JSON ตามสัญญาปัจจุบัน ถ้าไม่มีผลควรเป็น `data: []` พร้อมข้อมูลที่ระบบรองรับ
หากยังตอบ `board_not_found` ให้ผู้ดูแลตรวจการจัดเตรียม leaderboard ของเกมนี้กับทีม Game Center
ยังไม่ทราบว่าระบบติดตั้งนี้สร้าง board อัตโนมัติหลังเปิด scoring หรือจำเป็นต้องตั้งค่าเพิ่ม
ห้ามแก้ด้วยการใส่ผู้เล่นสมมติหรือส่งคะแนนปลอม

## 5. สิ่งที่โค้ดเตรียมไว้

- ใช้ public SDK ที่ vendored ไว้ใน `src/integration/vendor/game-center.js` และ bundle ผ่าน Vite
  ไม่พึ่งไฟล์ `/vendor/...` ที่อาจไม่ถูก copy ขึ้น host
- มี GameCenterEntry หนึ่งตัวต่อ page lifecycle; ล้าง grant จาก fragment ทันที และใช้ SDK redirect/recovery
- หนึ่ง Game Session = หนึ่ง playable session; ปุ่ม Start รอการยืนยันก่อน Countdown
- เตรียม AudioContext จากการกด Start ก่อนรอเครือข่าย เพื่อรักษาสิทธิ์เล่นเสียงของ browser
- Round, Golden Card Event และ pause/resume ไม่เรียก beginRound เพิ่ม
- ผลสุดท้ายเป็น `{schemaVersion:1, gameVersion:"1.0.0", score:"...", outcome:"complete", clientEndedAt:"...", stats:{}}`
- เก็บ payload/client ของผลที่ส่งไม่สำเร็จในหน่วยความจำ เพื่อ retry ขณะเล่นใหม่ได้
  SDK รักษา Idempotency-Key ของผลเดิม; ไม่เก็บ token ใน localStorage
- หน้าจอแยก receipt status และ rankingEligible; High Score เดิมยังเป็นข้อมูลในอุปกรณ์
- Top 5 อ่านอันดับจาก API รักษาลำดับ/อันดับเสมอ ใช้ช่วงเวลาจาก meta.period
  มีสถานะโหลด ว่าง ล้มเหลว retry และ modal ที่รองรับ Escape/focus

ผลที่ยังส่งไม่สำเร็จเก็บได้เฉพาะ page lifecycle นี้ ปิด/รีโหลดหน้าจะไม่คง retry queue หรือ token
หน้าผลแสดง receipt ที่ได้รับครั้งล่าสุด; pending ไม่ได้หมายถึงอนุมัติแล้ว และยังไม่มี polling สถานะอนุมัติภายหลัง

## 6. ทดสอบในเครื่อง

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm e2e --workers=4
```

E2E ใช้ fixture intercept ทุก request ไป Game Center รวม grant, replay, result และ leaderboard
และอนุญาต baseURL เฉพาะ localhost/127.0.0.1 ไม่ใช้ production เป็นเป้าหมาย
ไม่มี bypass flag หรือคะแนนตัวอย่างอยู่ใน production code
เมื่อเปิด `pnpm dev` โดยไม่มี grant จริง เกมจะ redirect ตามขั้นตอนล็อกอินปกติ
หากต้องการตรวจ UI อย่างปลอดภัย ให้ใช้ชุด E2E พร้อม fixture แทนการสร้าง session จริง

ผลตรวจในเครื่องวันที่ 15 ตุลาคม 2026: TypeScript/production build ผ่าน,
unit/component tests ผ่าน 70 กรณี และ browser E2E ผ่าน 48 กรณี
ตรวจซ้ำรอบ audit หลังมีการปรับหน้าผลเกม: unit/component 70 กรณี, TypeScript/build
และ E2E เฉพาะ `e2e/game-center.spec.ts` 13 กรณีผ่าน ไม่ได้รัน E2E ทุกไฟล์ซ้ำในรอบ audit นี้
หลังแก้ข้อความนโยบาย Guest: TypeScript/build และ unit/component 70 กรณีผ่าน
E2E integration 15 กรณีผ่าน รวมกรณี Guest ได้สิทธิ์และสมาชิกไม่ได้สิทธิ์ตาม receipt จำลอง
ไม่ได้เปลี่ยนนโยบายส่วนกลาง ไม่ได้เผยแพร่การแก้ข้อความ และไม่ได้สร้างรอบ production
มีการตรวจภาพอันดับบนมือถือและหน้าผลที่ 320 × 480 ด้วยข้อมูลจำลองแยกจาก production
ผลทดสอบในเครื่องไม่ยืนยันค่าที่บันทึกใน CMS หรือการขึ้นอันดับของสมาชิกบน production

## 7. เผยแพร่และตรวจ acceptance — รอคำสั่งแยก

งานนี้ไม่อนุญาต deploy ผู้ดูแลต้องประสานผู้เผยแพร่หลังตรวจทานโค้ดและตั้งค่าเสร็จ
เมื่อได้รับอนุญาตแล้วจึงดำเนินการตามลำดับ:

1. บันทึกค่ากลางก่อน/หลังและยืนยันเกม `cat-card`; ตรวจ launch origin/path และ CORS โดยไม่ใช้ wildcard
2. เผยแพร่ build ที่ผ่านการตรวจทาน แล้วตรวจ commit ที่ใช้และ HTML/JS ที่เสิร์ฟจริง
   ตรวจ Content-Type ของ JS และเนื้อหา bundle ไม่ถือว่า HTTP 200 หรือ push สำเร็จคือ deploy สำเร็จ
3. ขออนุญาตสร้างรอบทดสอบจริงก่อนเริ่ม บันทึก baseline จาก CMS ภาพรวมการเล่น
   เลือก Cat Card, mode default และ channel web ในช่วงเวลาที่ถูกต้อง
4. เปิด lobby ผ่าน sign-in/Guest ที่ถูกต้อง → ยอดยังไม่เพิ่ม
5. กด Start → เริ่มควบคุม/จับเวลาได้หลังตอบรับ → รีเฟรช CMS ควรเพิ่มหนึ่งครั้ง
6. ผ่าน Round และ Golden Card Event รวมถึงพัก/กลับมาเล่น → ไม่เพิ่มรอบใหม่
7. เล่นจนหมดเวลา → Score ใน receipt ตรงหน้าจอ และ completed plays เพิ่มตามจริง
8. Play again → เริ่มใหม่เพิ่มอีกหนึ่งครั้ง ไม่พากลับ sign-in โดยไม่จำเป็น
9. ทดสอบสมาชิกที่สมัครก่อนเริ่มรอบ: accepted + rankingEligible=true และพบผลที่มีสิทธิ์ใน current leaderboard
10. ทดสอบ Guest แยกหลังยืนยันนโยบายกับผู้ดูแล: ตรวจ receipt `status`/`rankingEligible` และอันดับจริงให้สอดคล้องกัน
    อย่าอนุมานว่า Guest ขึ้นหรือไม่ขึ้นอันดับจากประเภทบัญชีเพียงอย่างเดียว และตรวจสิทธิ์รางวัลแยกจากอันดับ
11. บันทึกจำนวนรอบที่สร้างจริง บัญชีประเภทที่ใช้ และหลักฐาน ห้ามสร้างคะแนนเพื่อเติม Top 5

ไม่ต้องแก้รอบอันดับกลาง ไม่เพิ่ม Gold ไม่เปลี่ยนนโยบายรางวัลของเกมอื่น
ข้อมูลว่างในอันดับเป็นสถานะที่ถูกต้องได้ แม้ transport และ config ทำงานแล้ว

## 8. ข้อมูลที่ต้องขอจากผู้ดูแล

- URL CMS ที่ใช้งานจริง และผู้รับผิดชอบที่มี configureScoring (ไม่ต้องส่ง credentials ให้ Codex)
- ยืนยันนโยบายรับ client score สำหรับ Cat Card ตาม allowClientRanking=true
- หลักฐานค่าหลัง Save จาก play-config และสถานะ leaderboard หลังเปิด scoring
- ข้อจำกัด launch origin/path และรายการ CORS ปัจจุบัน หาก preflight ไม่ผ่าน
- หาก board ยังไม่พร้อม: ขั้นตอน provision board สำหรับ mode default ของระบบที่ติดตั้งจริง
- ผู้รับผิดชอบ deploy และคำสั่งอนุญาตแยก รวมถึงเวลาที่อนุญาตให้ทดสอบรอบจริง

## แหล่งข้อมูลและ provenance

- Skill `game-center-integration` และ browser-flow reference ที่ผู้ใช้ระบุ
- https://center.game.gamification.in.th/openapi.json
- https://center.game.gamification.in.th/docs
- https://center.game.gamification.in.th/docs/analytics.md
- https://center.game.gamification.in.th/docs/ranking.md
- https://center.game.gamification.in.th/sdk/game-center.js

SDK ดาวน์โหลด 2026-10-15 และเก็บโดยไม่แก้ source
SHA256: `82079FE6B2EE2C7C7047F00E2803C952361E73C80133C7A6C2EF0AA95E59F056`
OpenAPI คำอธิบาย endpoint leaderboard และ `meta.period.guestEligible=true` กล่าวถึงสิทธิ์ Guests
แต่เอกสาร ranking ระบุ Guest ไม่ขึ้นอันดับ โค้ดจึงใช้ receipt/server rank เป็นหลัก
และข้อความในเกมไม่ประกาศนโยบาย Guest แบบตายตัวจนกว่าทีมส่วนกลางจะยืนยัน
