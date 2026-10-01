"""Build delivery assets from untouched PNG originals. Requires Pillow with WebP."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUTPUT = ASSETS / "optimized"


def export(source: Path, widths: tuple[int, ...], *, quality: int = 92):
    relative = source.relative_to(ASSETS)
    with Image.open(source) as original:
        original = original.convert("RGBA")
        for width in widths:
            height = round(original.height * width / original.width)
            image = original.resize((width, height), Image.Resampling.LANCZOS)
            target = OUTPUT / relative.parent / f"{source.stem}-{width}.webp"
            target.parent.mkdir(parents=True, exist_ok=True)
            image.save(target, "WEBP", quality=quality, method=6, exact=True)


if __name__ == "__main__":
    for name in [f"cat-{index}" for index in range(1, 11)] + ["golden-cat", "cat-celebration"]:
        export(ASSETS / "card" / "cat" / f"{name}.png", (256, 384, 512, 768))
    export(ASSETS / "card" / "cat-close.png", (256, 384, 512, 768))
    # Keep the full background resolution; the game can fill a high-density screen.
    export(ASSETS / "background.png", (941,), quality=94)
    for name in ["hud-round", "hud-score", "hud-time", "sound-button"]:
        source = ASSETS / f"{name}.png"
        with Image.open(source) as image:
            export(source, (image.width,))
    for name in ["golden-alert-panel", "result-panel"]:
        export(ASSETS / "ui" / f"{name}.png", (512, 1024, 1254))
    files = list(OUTPUT.rglob("*.webp"))
    print(f"Generated {len(files)} images, {sum(file.stat().st_size for file in files):,} bytes")
