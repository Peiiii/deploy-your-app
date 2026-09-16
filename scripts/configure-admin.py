#!/usr/bin/env python3
"""Configure the independent admin credential without exposing it in process arguments."""
import getpass
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
generate = '--generate' in sys.argv
password = secrets.token_urlsafe(24) if generate else getpass.getpass('New GemiGo admin password (minimum 16 characters): ')
if len(password) < 16:
    raise SystemExit('Password must be at least 16 characters.')
if not generate and password != getpass.getpass('Confirm password: '):
    raise SystemExit('Passwords do not match.')
salt = secrets.token_hex(16)
hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
payload = json.dumps({'ADMIN_PASSWORD_HASH': f'{salt}:{hashed}'})
subprocess.run(['pnpm', 'exec', 'wrangler', 'secret', 'bulk', '-c', 'workers/admin/wrangler.jsonc'], input=payload, text=True, cwd=root, check=True)
# Rotation revokes every previous admin session; no main-site account is changed.
subprocess.run(['pnpm', 'exec', 'wrangler', 'd1', 'execute', 'gemigo-projects', '--remote', '-c', 'workers/admin/wrangler.jsonc', '--command', 'DELETE FROM admin_sessions'], cwd=root, check=True)
if generate:
    directory = Path.home() / '.config' / 'gemigo'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    target = directory / 'admin-credentials.json'
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        json.dump({'url': 'https://admin.gemigo.io', 'username': 'admin', 'password': password}, output, indent=2)
    print(f'Credentials saved locally: {target}')
print('Independent admin password configured.')
