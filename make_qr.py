"""Create printable QR PNGs for Zone A/B after your website is hosted.

Run once on your computer:
  python -m pip install qrcode[pil]
  python make_qr.py

The QR encodes ONLY the website URL with ?start=a or ?start=b.
No server, location tracking, or recurring fee is required to encode it.
"""
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

try:
    import qrcode
except ImportError:
    raise SystemExit("ต้องติดตั้งแพ็กเกจก่อน: python -m pip install qrcode[pil]")

print("สร้าง QR Code สำหรับ TU SC1 Navigator")
print("ตัวอย่าง URL ที่เผยแพร่จริง: https://username.github.io/tu-sc1/")
url = input("วาง URL หน้าเว็บไซต์ของคุณ: ").strip()
parts = urlsplit(url)
if parts.scheme not in ("http", "https") or not parts.netloc:
    raise SystemExit("โปรดใช้ URL ของเว็บไซต์ที่เปิดได้ เช่น https://username.github.io/tu-sc1/")
if parts.scheme != "https":
    print("คำเตือน: สำหรับเว็บไซต์สาธารณะควรใช้ HTTPS")

out = Path(__file__).resolve().parent / "qr-output"
out.mkdir(exist_ok=True)
for code, label in (("a", "Zone A"), ("b", "Zone B")):
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.pop("room", None)
    query["start"] = code
    link = urlunsplit((parts.scheme, parts.netloc, parts.path or "/", urlencode(query), ""))
    picture = qrcode.make(link)
    target = out / f"QR_Zone_{code.upper()}.png"
    picture.save(target)
    print(f"{label}: {target.name} -> {link}")

print("เสร็จแล้ว: เปิดโฟลเดอร์ qr-output แล้วใช้โทรศัพท์สแกนทดสอบ")
print("ก่อนนำ QR ไปติดจริง ควรขออนุญาตอาคารและตรวจตำแหน่งติดตั้ง")
