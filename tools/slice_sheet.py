"""Şeffaf zeminli bir ikon sayfasını (sprite sheet) tek tek ikonlara böler.

Kullanım:  python tools/slice_sheet.py <sayfa> <çıktı_klasörü> <sütun> <satır> ad1 ad2 ...
İkonlar, sayfadaki boşluklara (şeffaf bantlara) bakılarak bulunur; her biri
kendi sınırına kırpılır, kare tuvale ortalanır ve SIZE px olarak kaydedilir.
"""
import sys
from PIL import Image

SIZE = 256        # çıktı boyutu (ekranda ~60px, retina için bol pay)
PAD = 0.04        # ikon çevresinde bırakılan boşluk oranı
ALPHA_MIN = 40    # bundan saydam pikseller "boş" sayılır (kenar gürültüsü)


def bands(profile, count):
    """Doluluk profilindeki en belirgin `count` dolu bandı döndürür."""
    runs, start = [], None
    for i, v in enumerate(profile + [0]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            runs.append([start, i])
            start = None
    # Küçük boşluklarla bölünmüş parçaları (ör. balinanın su fıskiyesi) birleştir
    while len(runs) > count:
        gaps = [runs[k + 1][0] - runs[k][1] for k in range(len(runs) - 1)]
        k = gaps.index(min(gaps))
        runs[k] = [runs[k][0], runs[k + 1][1]]
        del runs[k + 1]
    if len(runs) != count:
        raise SystemExit(f"{count} bant beklendi, {len(runs)} bulundu")
    return runs


def main():
    src, out, cols, rows, names = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5:]
    im = Image.open(src).convert("RGBA")
    mask = im.getchannel("A").point(lambda a: 255 if a >= ALPHA_MIN else 0)
    w, h = im.size
    px = mask.load()
    col_prof = [int(any(px[x, y] for y in range(0, h, 2))) for x in range(w)]
    row_prof = [int(any(px[x, y] for x in range(0, w, 2))) for y in range(h)]
    xs, ys = bands(col_prof, cols), bands(row_prof, rows)

    i = 0
    for r in range(rows):
        for c in range(cols):
            if i >= len(names):
                return
            box = (xs[c][0], ys[r][0], xs[c][1], ys[r][1])
            cell = im.crop(box)
            bb = cell.getchannel("A").point(lambda a: 255 if a >= ALPHA_MIN else 0).getbbox()
            icon = cell.crop(bb)
            side = int(max(icon.size) * (1 + 2 * PAD))
            canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            canvas.paste(icon, ((side - icon.width) // 2, (side - icon.height) // 2))
            canvas.resize((SIZE, SIZE), Image.LANCZOS).save(f"{out}/{names[i]}.png", optimize=True)
            print(names[i], icon.size)
            i += 1


if __name__ == "__main__":
    main()
