#!/usr/bin/env python3
"""Static checks aligned with current ncku-exam-toolkit JSON / Markdown loaders.
These tests do not run ROS 2, pthread demo, or benchmark code.
"""
import json, pathlib, re
from urllib.parse import urlsplit
from xml.etree import ElementTree
ROOT=pathlib.Path(__file__).resolve().parent.parent
CONTENT=ROOT/'src/content'; OPT=ROOT/'src/optimizations'; DIAGRAM=ROOT/'public/diagrams'
ARTICLE_FIELDS={'id','title','category','tags','aliases','difficulty','priority','source_type','verified','updated_at','summary','related'}
METHOD_FIELDS={'id','name','aliases','category','summary','problems','bottlenecks','verified','updatedAt','sources','relatedMethodIds','articleIds','commandIds','docIds','options'}
OPTION_FIELDS={'id','title','aliases','summary','principle','conditions','tradeoffs','behavior','metrics','code','sources','verified','articleId'}
validsource={'official','community','personal','speculative'}
article_ids=set(); method_ids=set(); images_used=set(); articles=[]; methods=[]

def verify_source(s):
    assert isinstance(s,dict) and s.get('title') and s.get('url'),s
    assert urlsplit(s['url']).scheme in ('https','http'),s

for f in sorted(CONTENT.glob('*.md')):
    raw=f.read_text(encoding='utf8')
    match=re.fullmatch(r'---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)',raw)
    assert match,f'Missing YAML front matter: {f}'
    meta={}
    for line in match[1].splitlines():
        kv=re.fullmatch(r'([a-z_]+):\s*(.*)',line)
        assert kv,f'Non-parser-compatible metadata: {f}: {line!r}'
        key,val=kv.groups();assert key not in meta,f'Key repeated: {f} {key}'
        meta[key]=val
    assert ARTICLE_FIELDS.issubset(meta.keys()),(f,ARTICLE_FIELDS-meta.keys())
    assert meta['id'] and meta['id'] not in article_ids,(f,meta['id'])
    assert meta['difficulty'] in ('beginner','intermediate','advanced'),f
    assert meta['priority'] in ('P0','P1','P2'),f
    assert meta['source_type'] in validsource,f
    assert meta['verified'] in ('true','false'),f
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}',meta['updated_at']),f
    if meta.get('source_url'): assert urlsplit(meta['source_url']).scheme == 'https',f
    for img in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',match[2]):
        images_used.add(img)
        if img.startswith('/diagrams/'):
            assert (DIAGRAM/pathlib.Path(img).name).is_file(),(f,img)
    if f.name.startswith(('ncku-', 'ros2-ste-')):
        assert len(match[2].strip())>300,f
    article_ids.add(meta['id']);articles.append((f,meta,match[2]))

for f in sorted(OPT.glob('*.json')):
    d=json.loads(f.read_text(encoding='utf8'))
    assert set(d)==METHOD_FIELDS,(f,set(d)^METHOD_FIELDS)
    assert d['id']==f.stem and d['id'] not in method_ids,f
    assert d['options'] and all(d[x] for x in ('summary','category','name','problems','bottlenecks','sources')),f
    assert d['verified'] is False,f
    for s in d['sources']: verify_source(s)
    opt_ids=set()
    for o in d['options']:
        assert set(o).issubset(OPTION_FIELDS) and OPTION_FIELDS-{'code','articleId'}<=set(o),(f,o['id'],set(o)^OPTION_FIELDS)
        assert o['id'] not in opt_ids,(f,o['id'])
        opt_ids.add(o['id'])
        assert all(o[k] for k in ('title','summary','principle','conditions','tradeoffs','behavior','metrics','sources')),(f,o['id'])
        assert o['verified'] is False,(f,o['id'])
        for s in o['sources']:verify_source(s)
    method_ids.add(d['id']);methods.append(d)

for f in CONTENT.glob('*.json'):
    article_ids.add(json.loads(f.read_text(encoding='utf8'))['id'])
for d in methods:
    for rel in d['relatedMethodIds']:
        assert rel in method_ids,(d['id'],rel)
    for rel in d['articleIds']:
        assert rel in article_ids,(d['id'],rel)
    for option in d['options']:
        if option.get('articleId'):
            assert option['articleId'] in article_ids,(d['id'],option['id'],option['articleId'])
for f,meta,body in articles:
    rel=[x.strip() for x in meta['related'].split(',') if x.strip()]
    for item in rel:
        assert item in article_ids,(f.name,item)

for img in DIAGRAM.glob('*.svg'): ElementTree.parse(img)
assert len(methods)>=10 and len(articles)>=10
print(f'PASS: {len(articles)} Markdown articles, {len(methods)} JSON methods, {sum(len(x["options"]) for x in methods)} options, {len(list(DIAGRAM.glob("*.svg")))} valid SVG diagrams')
print('NOTE: Parser/schema static checks only. Runtime build, ROS 2/DMA tests and actual performance benchmarks not executed.')
