"""
Hard Negative Image Downloader for mySunog Fire/Smoke Detection
---------------------------------------------------------------
Automatically downloads images of things that look like fire/smoke
but aren't. This version uses Google Images.

Usage:
    pip install icrawler
    python download_hard_negatives.py
"""

from icrawler.builtin import GoogleImageCrawler
from pathlib import Path
import time

# Output folder
OUTPUT_DIR = Path("models/hard_negatives")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Categories to download ──────────────────────────────────────────
CATEGORIES = [
    ("sunset_sky",        "orange sunset sky outdoor",              80),
    ("sunrise_sky",       "sunrise golden hour sky",                80),
    ("brake_lights",      "car brake lights night traffic red",      80),
    ("street_lamps",      "orange sodium street lamp night",         60),
    ("neon_signs",        "orange red neon sign light",              60),
    ("steam_pipes",       "steam coming out of pipe outdoor",        60),
    ("fog_mist",          "fog mist street outdoor",                 60),
    ("white_clouds",      "white gray clouds blue sky",              60),
    ("autumn_leaves",     "orange red autumn leaves fall",           60),
    ("ceiling_lights",    "indoor ceiling light bright room",        60),
    ("welding_sparks",    "welding sparks industrial",               50),
    ("fireworks",         "fireworks explosion night sky",           50),
]

def download_category(folder_name: str, query: str, count: int):
    save_dir = OUTPUT_DIR / folder_name
    save_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[>>] Downloading '{query}' -> {save_dir} ({count} images)")

    crawler = GoogleImageCrawler(
        feeder_threads=2,
        parser_threads=2,
        downloader_threads=4,
        storage={"root_dir": str(save_dir)},
    )

    crawler.crawl(
        keyword=query,
        max_num=count,
        min_size=(200, 200),   # Skip tiny thumbnails
        overwrite=False,
    )

    downloaded = len(list(save_dir.glob("*")))
    print(f"    -> {downloaded} images saved to {save_dir}")
    return downloaded

def main():
    print("=" * 60)
    print("  Hard Negative Image Downloader (Google Version)")
    print("=" * 60)
    print(f"Saving to: {OUTPUT_DIR.resolve()}")
    
    total = 0
    failed = []

    for folder_name, query, count in CATEGORIES:
        try:
            n = download_category(folder_name, query, count)
            total += n
            time.sleep(2)  # Be polite to servers
        except Exception as e:
            print(f"    [ERROR] Failed to download '{query}': {e}")
            failed.append(folder_name)

    print("\n" + "=" * 60)
    print(f"  Done! Total images downloaded: {total}")
    print(f"  Saved to: {OUTPUT_DIR.resolve()}")

    if failed:
        print(f"\n  Failed categories (try again manually): {failed}")

    print("\n  Next step: Upload these images to Roboflow and mark them as 'Null'")
    print("=" * 60)

if __name__ == "__main__":
    main()
