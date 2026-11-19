#!/usr/bin/env python3
"""배포용 만들기.

python3 tools/build_single.py
  dist/colony2126.html  한 파일 버전(글꼴·코드·그림·사진이 모두 들어 있다. 내려받아 열어도 된다)
  dist/web/             웹에 올릴 폴더(index.html + js·fonts·img·photos, 한 파일 버전도 같이)
"""
import base64, html, mimetypes, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, 'colony2126')
DIST = os.path.join(ROOT, 'dist')
MIME = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}


def read(rel):
    with open(os.path.join(GAME, rel), encoding='utf-8') as f:
        return f.read()


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
