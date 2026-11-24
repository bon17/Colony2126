#!/usr/bin/env python3
"""배포용 만들기.

python3 tools/build_single.py
  dist/colony2126.html  한 파일 버전(글꼴·코드·그림·사진이 모두 들어 있다. 내려받아 열어도 된다)
  dist/web/             웹에 올릴 폴더(index.html + js·fonts·img·photos, 한 파일 버전도 같이)

python3 tools/build_single.py --public
  dist/public/          다른 선생님들께 나누는 공개용. 구글 시트 주소(data.js의 ending.sheetUrl)를 비워서
                        헌장을 어디로도 보내지 않는다(보내기 버튼·「선생님께 보냈어요」도 안 나옴).
                        안의 colony2126.html·web/은 위와 같은 구조
"""
import base64, html, mimetypes, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, 'colony2126')
PUBLIC = '--public' in sys.argv
DIST = os.path.join(ROOT, 'dist', 'public') if PUBLIC else os.path.join(ROOT, 'dist')
MIME = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}


def read(rel):
    with open(os.path.join(GAME, rel), encoding='utf-8') as f:
        text = f.read()
    if PUBLIC and rel == 'js/data.js':
        text, n = re.subn(r"sheetUrl:\s*'[^']*'", "sheetUrl: ''", text)
        if n != 1:
            sys.exit('data.js에서 sheetUrl을 찾지 못했어요')
    return text


def shrink(path, ext):
    """한 파일 버전은 그림을 가볍게(WebP, 가로 1280 이하·사진은 1000 이하). PIL이 없으면 그대로 넣는다."""
    with open(path, 'rb') as f:
        raw = f.read()
    try:
        from PIL import Image
        import io
        im = Image.open(io.BytesIO(raw))
        limit = 1000 if os.sep + 'photos' + os.sep in path else 1280
        if im.width > limit:
            im = im.resize((limit, round(im.height * limit / im.width)), Image.LANCZOS)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=72, method=6)
        if buf.tell() < len(raw):
            return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
    except Exception as e:  # 그림을 못 줄여도 원본을 넣는다
        print('그대로 넣음:', os.path.basename(path), e)
    return 'data:' + MIME[ext] + ';base64,' + base64.b64encode(raw).decode('ascii')


def assets():
    out = {}
    for folder in ('img', 'photos'):
        for name in sorted(os.listdir(os.path.join(GAME, folder))):
            ext = os.path.splitext(name)[1].lower()
            if ext not in MIME:
                continue
            out[folder + '/' + name] = shrink(os.path.join(GAME, folder, name), ext)
    return out


def single():
    page = read('index.html')
    pack = assets()
    js_pack = 'window.COLONY_ASSETS = {\n' + ',\n'.join('"%s": "%s"' % (k, v) for k, v in pack.items()) + '\n};'

    def inline(m):
        src = m.group(1)
        code = read(src).replace('</script', '<\\/script')
        extra = ('<script>\n' + js_pack + '\n</script>\n') if src == 'js/game.js' else ''
        return extra + '<script>\n/* ' + src + ' */\n' + code + '\n</script>'

    page = re.sub(r'<script src="([^"]+)"></script>', inline, page)
    # 글꼴 사용 허락(SIL OFL)은 글꼴과 함께 나눠야 한다
    lic = ''.join('\n===== fonts/%s =====\n%s' % (n, read('fonts/' + n)) for n in sorted(os.listdir(os.path.join(GAME, 'fonts'))) if n.startswith('LICENSE'))
    page = page.replace('<!doctype html>', '<!doctype html>\n<!-- 콜로니 2126 · 한 파일 버전 (tools/build_single.py로 만듦)\n글꼴: 학교안심 별자리·보드마카 (SIL Open Font License)' + lic.replace('--', '- -') + '\n-->', 1)
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'colony2126.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(page)
    return out, len(pack)


def web(single_path):
    dst = os.path.join(DIST, 'web')
    shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst)
    shutil.copy(os.path.join(GAME, 'index.html'), dst)
    shutil.copytree(os.path.join(GAME, 'js'), os.path.join(dst, 'js'))
    with open(os.path.join(dst, 'js', 'data.js'), 'w', encoding='utf-8') as f:
        f.write(read('js/data.js'))  # 공개용이면 시트 주소를 뺀 것
    shutil.copytree(os.path.join(GAME, 'fonts'), os.path.join(dst, 'fonts'))
    shutil.copytree(os.path.join(GAME, 'photos'), os.path.join(dst, 'photos'))
    shutil.copytree(os.path.join(GAME, 'img'), os.path.join(dst, 'img'), ignore=shutil.ignore_patterns('*.md'))
    shutil.copy(single_path, dst)
    return dst


if __name__ == '__main__':
    path, n = single()
    print('한 파일 버전:', os.path.relpath(path, ROOT), '%.1f MB' % (os.path.getsize(path) / 1e6), '그림·사진', n, '장')
    if '--no-web' not in sys.argv:
        print('웹 폴더:', os.path.relpath(web(path), ROOT))
    if PUBLIC:  # 원래 data.js에 있던 시트 주소가 정말 빠졌는지 확인
        with open(os.path.join(GAME, 'js', 'data.js'), encoding='utf-8') as f:
            m = re.search(r"sheetUrl:\s*'([^']+)'", f.read())
        for d, _, names in os.walk(DIST):
            for n in names:
                if m and n.endswith(('.html', '.js')):
                    with open(os.path.join(d, n), encoding='utf-8') as f:
                        if m.group(1) in f.read():
                            sys.exit('시트 주소가 남아 있어요: ' + os.path.join(d, n))
        print('공개용: 구글 시트 주소 없음 ✓')
