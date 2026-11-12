#!/usr/bin/env python3
"""Run from repository root AFTER copying 39 new first-version articles.
Adds `articleId` to matching 39 options; never deletes or overwrites an existing different articleId.
Run with --check to validate without writing.
"""
import argparse, json, pathlib, sys
parser=argparse.ArgumentParser()
parser.add_argument('--check',action='store_true')
a=parser.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent
manifest=json.loads((root/'FIRST_VERSION_ARTICLE_LINKS.json').read_text(encoding='utf8'))
updated=0
errors=[]
for item in manifest:
    path=root/'src/optimizations'/(item['methodId']+'.json')
    article=root/'src/content'/(item['articleId']+'.md')
    if not path.is_file() or not article.is_file():
        errors.append(f"Missing: {path if not path.is_file() else article}")
        continue
    data=json.loads(path.read_text(encoding='utf8'))
    found=next((x for x in data['options'] if x['id']==item['optionId']),None)
    if found is None:
        errors.append(f"Missing option: {item['methodId']}/{item['optionId']}")
        continue
    old=found.get('articleId')
    if old is not None and old!=item['articleId']:
        errors.append(f"Conflict (not overwritten): {path.name}/{found['id']}: {old}")
        continue
    if old!=item['articleId']:
        found['articleId']=item['articleId']
        if not a.check:
            path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        updated+=1
if errors:
    print('\n'.join(errors),file=sys.stderr)
    sys.exit(1)
print(f"{'Would update' if a.check else 'Updated'} {updated} first-version option article links. Total referenced: {len(manifest)}")
