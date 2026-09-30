# Cat Card Game

เกมจับคู่ไพ่ตัวละครแมวแบบจับเวลา ซึ่งผู้เล่นทำคะแนนผ่านกระดานที่ยากขึ้นเรื่อย ๆ ภายในหนึ่งเกม

## Language

**Cat Character**:
อัตลักษณ์ภาพของแมวหนึ่งแบบซึ่งใช้สร้างไพ่หนึ่งคู่ใน Board ปัจจุบัน ชุดปัจจุบันมี Cat Character ที่แตกต่างกันสิบแบบ (`cat-1` ถึง `cat-10`)
_Avoid_: Card Type, Skin

**Game Session**:
การเล่นหนึ่งครั้งที่เริ่มด้วยนาฬิกาต่อเนื่อง 120 วินาที ครอบคลุมหลาย Round และสิ้นสุดเมื่อเวลาหมด โดย Golden Card Event อาจเพิ่มเวลาให้ Game Session เกินค่าเริ่มต้นได้
_Avoid_: Run, Playthrough

**Round**:
ช่วงหนึ่งของ Game Session ที่ใช้ Board หนึ่งชุด เมื่อจับคู่ครบทุกคู่จะเข้าสู่ Round ถัดไปซึ่งมีจำนวนไพ่ตามลำดับ 4, 6, 8, 12, 16 และ 20 ใบ หลังจากนั้น Round ใหม่จะใช้ 20 ใบต่อไปจนหมดเวลา
_Avoid_: Level, Stage

**Board**:
ชุดไพ่ที่คว่ำอยู่ทั้งหมดใน Round ปัจจุบัน โดยไพ่แต่ละตัวละครปรากฏสองใบเป็นหนึ่งคู่
_Avoid_: Grid, Deck

**Match**:
ผลจากการเปิดไพ่ตัวละครเดียวกันสองใบ Match เพิ่ม Score 10 คะแนน และไพ่คู่นั้นจะหงายอยู่แต่ไม่สามารถเลือกได้อีก
_Avoid_: Correct Pair, Hit

**Mismatch**:
ผลจากการเปิดไพ่ต่างตัวละครกันสองใบ Mismatch ลด Score 1 คะแนนแต่ไม่ต่ำกว่าศูนย์ ก่อนคว่ำไพ่ทั้งคู่กลับ
_Avoid_: Miss, Wrong Match

**Score**:
คะแนนสะสมภายใน Game Session ซึ่งได้จาก Match และเสียจาก Mismatch โดยไม่มีโบนัสจากการจบ Round และไม่มีระบบ combo
_Avoid_: Points

**High Score**:
คะแนน Game Session ที่ดีที่สุดซึ่งบันทึกไว้ในอุปกรณ์ของผู้เล่น
_Avoid_: Best Score, Record

**Game Result**:
สรุปผลเมื่อ Game Session สิ้นสุด ประกอบด้วย Score, High Score และ Round สูงสุดที่ผู้เล่นไปถึง
_Avoid_: End Screen, Summary

**HUD**:
แผงข้อมูลด้านบนระหว่าง Game Session ที่แสดง Round, Score และ Time ส่วนปุ่มตั้งค่าเสียงเป็น control แยกอยู่บริเวณ Footer ด้านขวาล่าง
_Avoid_: Hub, Status Bar

**Start Prompt**:
ข้อความเชิญให้ผู้เล่นเริ่ม Game Session ซึ่งแสดงก่อน Countdown โดยไม่มีข้อมูลประกอบที่ไม่จำเป็น
_Avoid_: Start Screen, Intro Card

**First-Turn Hint**:
ข้อความแนะนำให้จับคู่ไพ่ซึ่งแสดงครั้งเดียวก่อนการเลือกไพ่ครั้งแรกของ Game Session
_Avoid_: Tutorial, Round Hint

**Golden Card Event**:
เหตุการณ์หนึ่งครั้งใน Game Session ที่ไปถึง Round 3 ซึ่งผู้เล่นต้องเปิด Golden Card และ Match คู่ของมันก่อน Golden Timer หมด
_Avoid_: Golden Round, Bonus Round

**Golden Card**:
Card ที่ยังคว่ำและได้รับ Golden Cover ชั่วคราว โดยยังคง Cat Character เดิมไว้ข้างใต้
_Avoid_: Golden Cat Character, Bonus Card

**Golden Timer**:
เวลาห้าวินาทีสำหรับทำ Golden Match ซึ่งแยกจากนาฬิกาหลักของ Game Session
_Avoid_: Game Timer, Bonus Time
