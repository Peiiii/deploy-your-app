"""Content-based public catalog correction with reviewable backups and guarded writes.

prepare writes a local content snapshot only; apply and rollback require explicit modes.
Keep the output directory private: it contains project metadata, never credentials.
"""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import html
import json
import os
from pathlib import Path
import re
import time
import tomllib
import urllib.error
import urllib.request

CATEGORIES = ['Education', 'Games', 'Productivity', 'Creative', 'Development', 'Other']
PUBLIC = "COALESCE(is_deleted,0)=0 AND is_public=1 AND status='Live' AND trim(COALESCE(url,''))!=''"

def request_json(url, body, token, timeout=90):
    request = urllib.request.Request(url, json.dumps(body).encode(), {
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise RuntimeError(f'Request failed (HTTP {error.code})') from None
        except (TimeoutError, urllib.error.URLError):
            if attempt == 2:
                raise RuntimeError('Request failed (network/timeout)') from None
        time.sleep(2 ** attempt)


def save(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    temporary.chmod(0o600)
    temporary.replace(path)


def fetch_context(project):
    try:
        request = urllib.request.Request(project['url'], headers={'User-Agent': 'GemiGo catalog classification'})
        with urllib.request.urlopen(request, timeout=15) as response:
            if 'text/html' not in response.headers.get('Content-Type', ''):
                return {**project, 'content': '', 'contentStatus': 'non-html'}
            source = response.read(400_000).decode('utf-8', errors='replace')
        scripts = re.findall(r'<script[^>]*>(.*?)</script>', source, re.S | re.I)
        clean = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', ' ', source, flags=re.S | re.I)
        clean = html.unescape(re.sub(r'<[^>]+>', ' ', clean))
        clean = re.sub(r'\s+', ' ', clean).strip()
        # Small inline programs help identify canvas games / JS-only pages.
        code = '\n'.join(s for s in scripts if len(s) < 20_000)[:3000]
        return {**project, 'content': clean[:6500] + '\nInline program excerpt:\n' + code,
                'contentStatus': 'readable' if clean or code else 'empty'}
    except (OSError, ValueError):
        return {**project, 'content': '', 'contentStatus': 'unavailable'}


def proposed_tags(project, result):
    if not result['educationalGame']:
        if result['category'] == 'Education':
            try:
                tags = json.loads(project['tags'] or '[]')
            except (ValueError, TypeError):
                return project['tags']
            if isinstance(tags, list):
                corrected = [tag for tag in tags if not (isinstance(tag, str) and tag.lower() == 'game')]
                if corrected != tags:
                    return json.dumps(corrected, ensure_ascii=False)
        return project['tags']
    try:
        tags = json.loads(project['tags'] or '[]')
    except (ValueError, TypeError):
        tags = []
    if not isinstance(tags, list):
        tags = []
    if not any(isinstance(tag, str) and tag.lower() == 'game' for tag in tags):
        tags.append('game')
    return json.dumps(tags, ensure_ascii=False)


def guarded_update(project, from_category, from_tags, to_category, to_tags):
    sql = f'''UPDATE projects SET category=?, tags=? WHERE id=? AND {PUBLIC}
      AND category IS ? AND tags IS ? AND last_deployed IS ? AND url IS ?
      AND name IS ? AND description IS ? RETURNING id'''
    params = [to_category, to_tags, project['id'], from_category, from_tags,
              project['last_deployed'], project['url'], project['name'], project['description']]
    return sql, params


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['prepare', 'apply', 'rollback'])
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--account', default='adb27b39051202962038992eeaf8f6bb')
    parser.add_argument('--database', default='e1e28d75-d0a0-4f8e-9b5d-714454686a4f')
    args = parser.parse_args()
    token = os.environ.get('CLOUDFLARE_API_TOKEN')
    if not token:
        config = Path.home() / 'Library/Preferences/.wrangler/config/default.toml'
        token = tomllib.loads(config.read_text())['oauth_token']
    endpoint = f'https://api.cloudflare.com/client/v4/accounts/{args.account}/d1/database/{args.database}/query'

    def query(sql, params=None):
        data = request_json(endpoint, {'sql': sql, 'params': params or []}, token)
        if not data.get('success') or data.get('errors'):
            raise RuntimeError('D1 query failed')
        return data['result'][0]

    directory = args.directory
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory.chmod(0o700)
    snapshot_path, proposal_path = directory / 'snapshot.json', directory / 'proposal.json'
    if args.mode == 'prepare':
        if snapshot_path.exists():
            projects = json.loads(snapshot_path.read_text())
        else:
            projects = query(f'SELECT id,name,description,category,tags,url,last_deployed FROM projects WHERE {PUBLIC} ORDER BY id')['results']
            with ThreadPoolExecutor(max_workers=10) as pool:
                projects = list(pool.map(fetch_context, projects))
            save(snapshot_path, projects)
        print(json.dumps({'snapshot': len(projects), 'content': Counter(p['contentStatus'] for p in projects),
                          'next': 'Review content; write proposal.json with exact ids, category, educationalGame, reviewed=true and evidence before apply.'}))
        return
    projects = {p['id']: p for p in json.loads(snapshot_path.read_text())}
    proposals = json.loads(proposal_path.read_text())
    if {p['id'] for p in proposals} != set(projects) or len(proposals) != len(projects):
        raise RuntimeError('Incomplete or duplicate proposal; no writes allowed')
    if any(p.get('reviewed') is not True or not isinstance(p.get('evidence'), str) or not p['evidence'].strip()
           or p['category'] not in CATEGORIES or type(p.get('educationalGame')) is not bool
           or (p['educationalGame'] and p['category'] != 'Education') for p in proposals):
        raise RuntimeError('Every proposal needs content review and evidence before writes')
    applied_path = directory / 'applied.json'
    intents_path = directory / 'write-intents.json'
    intents = json.loads(intents_path.read_text()) if intents_path.exists() else []
    applied = json.loads(applied_path.read_text()) if applied_path.exists() else []
    if args.mode == 'rollback':
        work = list(reversed(intents))
    else:
        completed = {p['id'] for p in applied}
        work = [p for p in proposals if p['id'] not in completed]
    skipped, changed = 0, 0
    for result in work:
        project = projects[result['id']]
        if result['category'] not in CATEGORIES:
            raise RuntimeError('Invalid category; aborting')
        next_tags = proposed_tags(project, result)
        old, new = (project['category'], project['tags']), (result['category'], next_tags)
        if old == new:
            continue
        source, target = (new, old) if args.mode == 'rollback' else (old, new)
        sql, params = guarded_update(project, *source, *target)
        # Journal before the network call so ambiguous responses remain recoverable.
        if args.mode == 'apply' and not any(p['id'] == result['id'] for p in intents):
            intents.append(result)
            save(intents_path, intents)
        rows = query(sql, params)['results']
        if not rows:
            # A guarded retry may have written before the first response was lost.
            check_sql, check_params = guarded_update(project, *target, *target)
            where = check_sql.split(' WHERE ', 1)[1].replace(' RETURNING id', '')
            rows = query('SELECT id FROM projects WHERE ' + where, check_params[2:])['results']
        if not rows:
            skipped += 1
            continue
        changed += 1
        if args.mode == 'apply':
            applied.append(result)
        else:
            applied = [p for p in applied if p['id'] != result['id']]
        save(applied_path, applied)
        if args.mode == 'rollback':
            intents = [p for p in intents if p['id'] != result['id']]
            save(intents_path, intents)
        if changed % 50 == 0:
            print(json.dumps({'mode': args.mode, 'confirmed': changed}), flush=True)
    print(json.dumps({'mode': args.mode, 'changed': changed, 'concurrentOrPreviouslyChanged': skipped,
                      'categories': query(f'SELECT category,COUNT(*) apps FROM projects WHERE {PUBLIC} GROUP BY category')['results']}))


if __name__ == '__main__':
    main()
