#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""官网图片准备（可重复运行）。

1. 把 docs/sales/screenshots/*.png 转成 WebP（长边 1440），输出到 apps/website/public/images/screenshots/
2. 生成社交分享图 public/og-default.png（1200×630）

用法：
  python apps/website/scripts/prepare_images.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "docs" / "sales" / "screenshots"
OUT = ROOT / "apps" / "website" / "public" / "images" / "screenshots"
PUB = ROOT / "apps" / "website" / "public"
OUT.mkdir(parents=True, exist_ok=True)

MAX_W = 1440
QUALITY = 78

BLUE = (29, 78, 216)
BLUE_MID = (59, 130, 246)
BLUE_DEEP = (22, 37, 107)
AMBER = (251, 191, 36)
INK = (16, 23, 54)
MUTED = (103, 114, 141)
PAPER = (251, 250, 247)

FONT_REG = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def convert_screenshots() -> int:
    if not SRC.exists():
        print(f"找不到截图目录：{SRC}")
        return 0
    n = 0
    total_in = total_out = 0
    for png in sorted(SRC.glob("*.png")):
        name = png.stem.replace("_", "-")
        dst = OUT / f"{name}.webp"
        with Image.open(png) as im:
            im = im.convert("RGB")
            if im.width > MAX_W:
                im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
            im.save(dst, "WEBP", quality=QUALITY, method=6)
        total_in += png.stat().st_size
        total_out += dst.stat().st_size
        print(f"{png.name} -> {dst.name}  {dst.stat().st_size // 1024} KB")
        n += 1
    if n:
        print(f"截图 {n} 张：{total_in // 1024} KB PNG → {total_out // 1024} KB WebP")
    return n


def rr(d: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_og() -> None:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # 背景：右上蓝色晕 + 细网格
    for i in range(W):
        t = i / W
        d.line([(i, 0), (i, H)], fill=(int(251 - 8 * t), int(250 - 4 * t), int(247 + 6 * t)))
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W * 0.55, -H * 0.45, W * 1.35, H * 0.75), fill=110)
    gd.ellipse((-W * 0.25, H * 0.55, W * 0.35, H * 1.5), fill=60)
    blue = Image.new("RGB", (W, H), BLUE_MID)
    img.paste(blue, (0, 0), glow.filter(ImageFilter.GaussianBlur(90)))
    for x in range(0, W, 36):
        d.line([(x, 0), (x, H)], fill=(238, 242, 252), width=1)
    for y in range(0, H, 36):
        d.line([(0, y), (W, y)], fill=(238, 242, 252), width=1)

    # 左上角图标
    rr(d, (72, 64, 144, 136), 18, BLUE)
    d.rounded_rectangle((96, 84, 122, 116), 4, fill=(255, 255, 255))
    d.polygon([(120, 118), (128, 100), (136, 118)], fill=AMBER)

    d.text((164, 78), "点评笔记助手", font=font(30, True), fill=INK)
    d.text((164, 112), "DianPingNote · Windows 桌面软件", font=font(17), fill=MUTED)

    d.text((72, 210), "设定一次，", font=font(76, True), fill=INK)
    d.text((72, 300), "采集、二创、发布全自动", font=font(76, True), fill=BLUE)
    d.rectangle((74, 398, 74 + 8, 462), fill=AMBER)

    d.text((72, 500), "小红书 / 抖音 / 快手 / B站 采集  →  本机改写文案与标题  →  定时发布到大众点评多个蓝 V", font=font(22), fill=MUTED)
    d.text((72, 540), "笔记、素材与发布状态全部保存在本机 · 按成功发布条数计费，1 条 1 元起", font=font(20), fill=(120, 130, 155))

    dst = PUB / "og-default.png"
    img.save(dst, "PNG", optimize=True)
    print(f"og-default.png {dst.stat().st_size // 1024} KB")


if __name__ == "__main__":
    convert_screenshots()
    make_og()