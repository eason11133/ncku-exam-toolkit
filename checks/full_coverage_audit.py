"""Create an honest per-item coverage ledger; existence is not technical verification."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parent.parent
articles={p.stem:p for p in (root/'src/content').glob('*.md')}
methods=[json.loads(p.read_text(encoding='utf8')) for p in (root/'src/optimizations').glob('*.json')]
concepts=json.loads((root/'src/concepts/concepts.json').read_text(encoding='utf8'))
priority_ids={item['id'] for item in json.loads((root/'audit/semantic_priority_review.json').read_text(encoding='utf8'))}
rows=[]
for id,p in sorted(articles.items()):
 body=p.read_text(encoding='utf8')
 fences=re.findall(r'```([^\n]*)\n[\s\S]*?\n```',body)
 rows.append({'kind':'article','id':id,'static':'present','technical':'manual-review-needed','runtime':'not-tested','codeBlocks':len(fences)})
for method in methods:
 for option in method['options']:
  a=option.get('articleId')
  rows.append({'kind':'option','id':method['id']+'/'+option['id'],'articleId':a,'static':'linked' if a in articles else 'missing','technical':'manual-review-needed','runtime':'not-tested'})
for concept in concepts:
 a=concept.get('relatedArticle')
 rows.append({'kind':'concept','id':concept['id'],'articleId':a['articleId'] if a else None,'static':'linked' if not a or a['articleId'] in articles else 'missing','semantic':'priority-mapping-reviewed' if concept['id'] in priority_ids else 'manual-review-needed'})
assert len(rows)==len(articles)+sum(len(m['options']) for m in methods)+len(concepts)
out=root/'audit/coverage_ledger.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps({'scope':'static inventory; no automatic semantic or runtime signoff','rows':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('articles',len(articles),'options',sum(len(m['options']) for m in methods),'concepts',len(concepts),'rows',len(rows),'missing',sum(x.get('static')=='missing' for x in rows))
