"""Exercise the production migration's guarded SQL against real SQLite."""
import importlib.util
import json
from pathlib import Path
import sqlite3

spec = importlib.util.spec_from_file_location('migration', Path(__file__).with_name('reclassify-discovery-apps.py'))
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
db = sqlite3.connect(':memory:')
db.execute('CREATE TABLE projects (id,category,tags,last_deployed,url,name,description,is_deleted,is_public,status)')
p = dict(id='app',category='Fun',tags='["math"]',last_deployed='date',url='url',name='Math',description='Learning game')
db.execute('INSERT INTO projects VALUES (?,?,?,?,?,?,?,0,1,\'Live\')', tuple(p.values()))
r = dict(category='Education',educationalGame=True)
tags = migration.proposed_tags(p,r)
assert json.loads(tags) == ['math','game']
assert json.loads(migration.proposed_tags({**p, 'tags': tags}, dict(category='Education', educationalGame=False))) == ['math']
update = migration.guarded_update(p,p['category'],p['tags'],'Education',tags)
assert db.execute(*update).fetchall() == [('app',)]
assert db.execute(*update).fetchall() == [], 'repeated apply is idempotent'
rollback = migration.guarded_update(p,'Education',tags,p['category'],p['tags'])
assert db.execute(*rollback).fetchall() == [('app',)]
for field,value in [('tags','["author-edited"]'),('last_deployed','new-date'),('description','New content'),('is_public',0),('is_deleted',1)]:
 db.execute(f'UPDATE projects SET {field}=?', [value])
 assert db.execute(*update).fetchall() == [], field + ' must protect concurrent change'
 db.execute(f'UPDATE projects SET {field}=?', [p.get(field, 1 if field=='is_public' else 0)])
print('PASS reclassification: real guarded SQL, idempotence, rollback, tag preservation and concurrent edits/visibility/version protection.')
