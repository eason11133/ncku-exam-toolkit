#!/usr/bin/env python3
"""NCKU Toolkit content structural and known-regression gate.

Run from repo root: python checks/ncku_audit_gate.py
- May be run without patch JSON in repo; it loads them if ../patches/ is present,
  otherwise relies on embedded short signature checks.
- Static checks cannot prove hardware correctness, ROS 2 runtime behavior, or
  that each recommendation is suitable for a particular problem.
"""
from pathlib import Path
from collections import Counter, defaultdict
import json, re, sys

ROOT=Path(__file__).resolve().parent.parent
CONTENT=ROOT/'src/content'
OPTS=ROOT/'src/optimizations'
CONCEPTS=ROOT/'src/concepts/concepts.json'
NAV=ROOT/'src/navigation'
issues=[]
warnings=[]

def problem(level,code,path,message):
    (issues if level=='ERROR' else warnings).append({'severity':level,'code':code,'path':str(path),'message':message})

def read_json(path):
    try:return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:problem('ERROR','BAD_JSON',path,str(e));return None

def frontmatter(txt):
    if not txt.startswith('---\n'):return {}
    section=txt.split('---\n',2)[1] if '---\n' in txt[4:] else ''
    return dict((a.strip(),b.strip()) for a,b in re.findall(r'^([\w_]+):\s*(.*?)\s*$',section,re.M))

def local_examples(body):
    # Avoid catching repo external URLs e.g. github.com/pico-examples/blob/....
    clean=re.sub(r'https?://[^\s)\]`>]+','',body)
    return set(re.findall(r'(?<![\w/])(examples/[\w./-]+\.(?:c|h|py|pio|sh|json))\b',clean))

if not CONTENT.exists() or not OPTS.exists() or not CONCEPTS.exists():
    print('ERROR: run this script from the target repo with src/content, src/optimizations, src/concepts',file=sys.stderr)
    sys.exit(2)
articles={p.stem:p for p in CONTENT.glob('*.md')}
methods={p.stem:read_json(p) for p in OPTS.glob('*.json')}
concepts=read_json(CONCEPTS) or []
for name,num,got in [('article',92,len(articles)),('optimization_method',47,len(methods)),('concept',217,len(concepts))]:
    if got<num:problem('ERROR','COUNT_REGRESSION',name,f'{got} < expected {num}')
    elif got>num:problem('WARN','COUNT_CHANGED',name,f'{got} > initial {num}; inspect new content before assuming verified')
if len({c.get('id') for c in concepts})!=len(concepts):problem('ERROR','DUP_CONCEPT_ID',CONCEPTS,'Repeated concept ids')
for p in articles.values():
    s=p.read_text(encoding='utf-8');fm=frontmatter(s)
    if fm.get('id') !=p.stem:problem('ERROR','ARTICLE_ID',p,'Frontmatter id does not match filename')
    for x in local_examples(s):
        if not (ROOT/x).exists():problem('ERROR','MISSING_LOCAL_EXAMPLE',p,f'Article references absent {x}')
    if '附 C 程式是可獨立建置的示範' in s and not any('int main(' in c for c in re.findall(r'```c\s*\n([\s\S]*?)\n```',s)) and not (ROOT/'examples/pthread_bounded_queue.c').exists():
        problem('ERROR','FALSE_COMPLETE_CODE_CLAIM',p,'Says attached independently buildable program but no standalone main() in page; verify actual attachment')
    if '附範例可用 C 編譯' in s and not any('int main(' in c for c in re.findall(r'```c\s*\n([\s\S]*?)\n```',s)):
        problem('WARN','UNPROVEN_COMPILATION_CLAIM',p,'Claims compileable example without a complete program in page')
    code_blocks=re.findall(r'```([\w+.-]+)?\r?\n([\s\S]*?)\r?\n```',s)
    for lang,block in code_blocks:
        if lang=='c' and '完整 C11 程式' in s[max(0,s.find('```c')-240):s.find('```c')]:
            if 'int main(' not in block:problem('ERROR','LABELED_COMPLETE_NOT_MAIN',p,'Marked full C11 but missing main')
            if '#include' not in block:problem('WARN','LABELED_COMPLETE_NO_INCLUDES',p,'Complete C11 may miss includes')
    # Obvious known bad preflight: old unwrapped memmove fence should never come back
    if p.stem=='ncku-v2-c-memcpy-overlap' and re.search(r'```c\n#include <string.h>\nchar buf\[\].*?\nmemmove\(',s,re.S):
        problem('ERROR','MEMMOVE_FILE_SCOPE',p,'memmove() call outside function in fenced C snippet')
    if p.stem=='lesson-ros2-qos-profile-keep-last-depth':
        body=s.split('## 考場快速判斷',1)[-1].split('## ',1)[0]
        if 'QoS mismatch' in body or 'QoS 不相容' in body:
            problem('ERROR','QOS_DEPTH_WRONG_TRIGGER',p,'Depth is not the fix for offered/requested reliability mismatch')
    if p.stem=='lesson-memory-buffer-copy-choose-memmove':
        body=s.split('## 考場快速判斷',1)[-1].split('## ',1)[0]
        if 'memcpy slow' in body:problem('ERROR','MEMMOVE_WRONG_TRIGGER',p,'Do not suggest memmove only because memcpy is slow')
    if p.stem=='lesson-transfer-engine-configuration-overlap-cpu':
        body=s.split('## 考場快速判斷',1)[-1].split('## ',1)[0]
        if 'count 與 bytes 搞混' in body:problem('ERROR','ASYNC_OVERLAP_WRONG_TRIGGER',p,'Fix count first; overlap is not related')
    if p.stem=='lesson-ros2-topic-pipeline-parallel-stages':
        body=s.split('## 考場快速判斷',1)[-1].split('## ',1)[0]
        if 'topic 名稱不一致' in body:problem('ERROR','PARALLEL_WRONG_TRIGGER',p,'Cannot parallelize a missing Topic')

for key,obj in methods.items():
    if not isinstance(obj,dict):continue
    if obj.get('id')!=key:problem('ERROR','METHOD_ID',OPTS/(key+'.json'),'File name mismatch')
    seen=set()
    for option in obj.get('options',[]):
        oid=option.get('id')
        if oid in seen:problem('ERROR','DUP_OPTION_ID',key,oid)
        seen.add(oid)
        aid=option.get('articleId')
        if aid and aid not in articles:problem('ERROR','OPTION_MISSING_ARTICLE',key,f'{oid} -> {aid}')
        if option.get('verified') is True:problem('WARN','VERIFY_FLAG',key,f'{oid}: verified=true requires separate evidence')
for c in concepts:
    cid=c.get('id')
    link=c.get('relatedArticle')
    if isinstance(link,dict) and link.get('kind')=='article' and link.get('articleId') not in articles:
        problem('ERROR','CONCEPT_MISSING_ARTICLE',cid,str(link))
    sol=c.get('exampleSolution')
    if isinstance(sol,dict) and sol.get('kind')=='optimization':
        m=methods.get(sol.get('methodId'))
        if not m or sol.get('optionId') not in {o['id'] for o in m.get('options',[])}:
            problem('ERROR','CONCEPT_MISSING_SOLUTION',cid,str(sol))
# Navigational reference completeness
for fn,key,field in [('article_routes.json','articleId','article'),('concept_routes.json','conceptId','concept')]:
    p=NAV/fn
    if not p.exists():problem('WARN','NAV_FILE_MISSING',p,'Navigation check skipped');continue
    entries=read_json(p)
    if not isinstance(entries,list):continue
    refs=[x.get(key) for x in entries]
    if len(refs)!=len(set(refs)):problem('ERROR','DUP_NAV_ROUTE',p,'Duplicate mapping key')
    expected=set(articles) if field=='article' else {c['id'] for c in concepts}
    if set(refs)!=expected:problem('ERROR','NAV_MISSING_OR_EXTRA',p,f'Missing {len(expected-set(refs))}, extra {len(set(refs)-expected)}')
# Alias collisions: synonyms may be ambiguous even if structurally valid
seen={}
for c in concepts:
    for name in [c.get('english',''),c.get('title',''),*(c.get('aliases') or [])]:
        k=str(name).casefold().strip()
        if len(k)<2:continue
        if k in seen and seen[k]!=c['id']:
            problem('WARN','AMBIGUOUS_ALIAS',CONCEPTS,f'{name}: {seen[k]} and {c["id"]}')
        else:seen[k]=c['id']
output={'counts':{'articles':len(articles),'methods':len(methods),'options':sum(len(x.get('options',[])) for x in methods.values() if isinstance(x,dict)),'concepts':len(concepts),'errors':len(issues),'warnings':len(warnings)},'errors':issues,'warnings':warnings}
print(json.dumps(output,ensure_ascii=False,indent=2))
# Nonzero exit if any actual integrity error. Warnings are not passing evidence.
sys.exit(1 if issues else 0)
