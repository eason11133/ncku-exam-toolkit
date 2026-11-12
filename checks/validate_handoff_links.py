#!/usr/bin/env python3
"""Source-level check, run from the merged repository root. Does not claim runtime or hardware validation."""
import json, pathlib, re, sys
repo=pathlib.Path(__file__).resolve().parent.parent
content=repo/'src/content'
opt=repo/'src/optimizations'
manifest=json.loads((repo/'FIRST_VERSION_ARTICLE_LINKS.json').read_text(encoding='utf8'))
errs=[]
articles={}
for p in content.glob('*.md'):
    s=p.read_text(encoding='utf8')
    hit=re.search(r'^id:\s*(.+)$',s,re.M)
    if not hit:errs.append(f'No article id: {p}');continue
    aid=hit.group(1).strip()
    if aid in articles:errs.append(f'Duplicate article id: {aid}')
    articles[aid]=p
    for src in re.findall(r'!\[[^]]*\]\((/[^)]+)\)',s):
        if not (repo/'public'/src.lstrip('/')).is_file():errs.append(f'Missing image: {p}: {src}')
methods={}
for p in opt.glob('*.json'):
    d=json.loads(p.read_text(encoding='utf8'))
    if d['id'] in methods:errs.append(f'Duplicate method id: {d["id"]}')
    methods[d['id']]=d
    for entry in d['options']:
        if entry.get('articleId') and entry['articleId'] not in articles:
            errs.append(f'Missing link {d["id"]}/{entry["id"]}: {entry["articleId"]}')
    for aid in d['articleIds']:
        if aid not in articles:errs.append(f'Missing method article link {d["id"]}: {aid}')
for item in manifest:
    method=methods.get(item['methodId'])
    entry=next((x for x in method['options'] if x['id']==item['optionId']),None) if method else None
    if entry is None or entry.get('articleId')!=item['articleId']:
        errs.append(f'First-version link missing: {item["methodId"]}/{item["optionId"]} -> {item["articleId"]}')
if errs:
    print('\n'.join(errs),file=sys.stderr);sys.exit(1)
opts=sum(len(d['options']) for d in methods.values())
linked=sum(bool(o.get('articleId')) for d in methods.values() for o in d['options'])
print(f'PASS: {len(articles)} Markdown articles, {len(methods)} methods, {opts} options, {linked} individually-linked article options.')
print('NOTE: Static refs only; source accuracy, code runnability, bench results, hardware unverified.')
