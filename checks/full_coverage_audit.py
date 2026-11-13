"""Create an honest per-item coverage ledger; existence is not technical verification."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parent.parent
articles={p.stem:p for p in (root/'src/content').glob('*.md')}
methods=[json.loads(p.read_text(encoding='utf8')) for p in (root/'src/optimizations').glob('*.json')]
concepts=json.loads((root/'src/concepts/concepts.json').read_text(encoding='utf8'))
priority_ids={item['id'] for item in json.loads((root/'audit/semantic_priority_review.json').read_text(encoding='utf8'))}
focused={'opt-transfer-unit-capacity':'A1','opt-transfer-no-channel-fallback':'A1','opt-ros2-service-request-state-machine':'A2','opt-ros2-parameterize-knobs':'A5','ncku-v2-c-signed-overflow':'A7','opt-c-compare-optimization-levels':'A8'}
focused.update({id:'A3/A4' for id in ('opt-pthread-stop-broadcast','opt-cond-bounded-ring','opt-pthread-lock-order','opt-pthread-local-count-merge','opt-pthread-mutex-multifield','opt-pthread-trylock-policy','opt-pthread-single-lock-redesign','opt-c-false-sharing-bench-safe','opt-pthread-fixed-worker-pool')})
rows=[]
for id,p in sorted(articles.items()):
 body=p.read_text(encoding='utf8')
 fences=re.findall(r'```([^\n]*)\n[\s\S]*?\n```',body)
 c_blocks=re.findall(r'```c\n(.*?)\n```',body,re.S)
 complete_c=any('int main(' in block for block in c_blocks)
 marked_python=bool(re.search(r'<!-- test: full-python -->\s*```python',body))
 evidence=[]
 if complete_c:evidence.append('checks/compile_c_examples.py: Windows GCC -O0/-O2/-O2 -DNDEBUG; compile and execute')
 if marked_python:evidence.append('checks/audit_python_examples.py: Python normal and -O; execute marked blocks')
 if id in focused:evidence.append('checks/audit_known_fixes.py: focused counterexamples; see script for executable scope')
 rows.append({'kind':'article','id':id,'static':'present','technical':'focused-correction-reviewed' if id in focused else 'manual-review-needed','issue':focused.get(id),'runtime':'partial-examples-executed' if evidence else 'not-tested','evidence':evidence,'sourceVerification':'not-individually-certified','codeBlocks':len(fences)})
for method in methods:
 for option in method['options']:
  a=option.get('articleId')
  rows.append({'kind':'option','id':method['id']+'/'+option['id'],'articleId':a,'static':'linked' if a in articles else 'missing','technical':'manual-review-needed','runtime':'not-tested','evidence':[]})
for concept in concepts:
 a=concept.get('relatedArticle')
 rows.append({'kind':'concept','id':concept['id'],'articleId':a['articleId'] if a else None,'static':'linked' if not a or a['articleId'] in articles else 'missing','semantic':'ISR-disambiguation-reviewed' if concept['id'] in ('isr','interrupt-service-routine') else 'priority-mapping-reviewed' if concept['id'] in priority_ids else 'manual-review-needed','runtime':'not-applicable','evidence':['tests/concepts.test.mjs: rendered ISR link and search'] if concept['id'] in ('isr','interrupt-service-routine') else []})
assert len(rows)==len(articles)+sum(len(m['options']) for m in methods)+len(concepts)
out=root/'audit/coverage_ledger.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps({'scope':'static inventory with per-item partial test evidence; examples do not certify article or hardware behavior','environment':'Windows, w64devkit GCC, Python 3.11, Node.js/Vite; ROS 2 and RP2350 hardware not run; UBSan unavailable','rows':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('articles',len(articles),'options',sum(len(m['options']) for m in methods),'concepts',len(concepts),'rows',len(rows),'missing',sum(x.get('static')=='missing' for x in rows))
