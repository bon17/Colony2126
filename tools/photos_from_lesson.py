"""수업 파일에서 게임용 사진을 뽑아 colony2126/photos/ 에 넣는다.

쓰는 법 (저장소 맨 위에서):
    python3 tools/photos_from_lesson.py "민주주의와 인권의 확산.html"

- 수업 파일의 <img data-src-key="..."> 이름으로 사진을 찾는다(순서가 바뀌어도 된다).
- 긴 변이 1280px보다 크면 줄이고 JPEG로 저장한다. 작은 사진은 그대로 쓴다.
- photos/ 는 .gitignore 에 들어 있다(저작권 확인 전까지 공개 저장소에 올리지 않음).
- Pillow 필요: pip install pillow
"""
import base64
import io
import os
import re
import sys

from PIL import Image

# 게임 사진 이름(data.js의 photo 값) ← 수업 파일의 data-src-key
PHOTOS = {
    # 1 민권
    's1_sign': 'segregation-sign.jpg',
    's1_king': 'king-march.jpg',
    's1_johnson': 'civil-rights-act-1964.jpg',
    's1_selma': 'selma-1965.jpg',
    's1_museum': 'apartheid-museum.jpg',
    's1_beach': 'apartheid-sign.jpg',
    's1_robben': 'robben-island.jpg',
    's1_nobel': 'mandela-nobel.jpg',
    's1_ballot': 'sa-election-1994.jpg',
    # 2 여성
    's2_arrest': 'suffragettes.jpg',
    's2_boston': 'boston-1967.jpg',
    's2_license': 'saudi-2018.jpg',
    's2_march': 'uk-women-1971.jpg',
    # 3 노동
    's3_chicago': 'haymarket-1886.jpg',
    's3_child': 'child-labor.jpg',
    's3_mayday': 'mayday-1890s.jpg',
    's3_weimar': 'weimar-constitution.jpg',
    's3_wagner': 'wagner-act-1935.jpg',
    's3_ilo': 'ilo-1919.jpg',
    's3_phila': 'philadelphia-1944.jpg',
    's3_memorial': 'ilo-poster.jpg',
    # 4~5스테이지는 만들 때 여기에 추가한다
}
MAX_SIDE = 1280
QUALITY = 82


def main():
    if len(sys.argv) < 2:
        sys.exit('수업 파일 경로를 넣어 주세요')
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'colony2126', 'photos')
    os.makedirs(out, exist_ok=True)
    text = open(sys.argv[1], encoding='utf-8').read()

    found = {}
    for tag in re.findall(r'<img\b[^>]*>', text):
        key = re.search(r'data-src-key="([^"]+)"', tag)
        src = re.search(r'src="data:image/[a-z+]+;base64,([^"]+)"', tag)
        if key and src and key.group(1) not in found:
            found[key.group(1)] = base64.b64decode(src.group(1))

    total = 0
    for name, key in PHOTOS.items():
        data = found.get(key)
        if data is None:
            print('없음:', name, '←', key)
            continue
        im = Image.open(io.BytesIO(data))
        path = os.path.join(out, name + '.jpg')
        is_jpeg = im.format == 'JPEG'
        if is_jpeg and max(im.size) <= MAX_SIDE and len(data) <= 300 * 1024:
            with open(path, 'wb') as f:
                f.write(data)
        else:
            if im.mode in ('RGBA', 'LA', 'P'):
                im = im.convert('RGBA')
                bg = Image.new('RGB', im.size, (255, 255, 255))
                bg.paste(im, mask=im.split()[-1])
                im = bg
            else:
                im = im.convert('RGB')
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            im.save(path, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        size = os.path.getsize(path)
        total += size
        print(f'{name}.jpg  {size // 1024} KB')
    print(f'합계 {total / 1024 / 1024:.1f} MB → {out}')


if __name__ == '__main__':
    main()
