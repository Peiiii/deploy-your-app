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
import tempfile

root = Path(__file__).resolve().parents[1]
generate = '--generate' in sys.argv
minimum_password_length = 8
maximum_password_length = 256
password = secrets.token_urlsafe(24) if generate else getpass.getpass(
    f'New GemiGo admin password ({minimum_password_length}–{maximum_password_length} characters): '
)
if not minimum_password_length <= len(password) <= maximum_password_length:
    raise SystemExit(
        f'Password must be {minimum_password_length}–{maximum_password_length} characters.'
    )
if not generate and password != getpass.getpass('Confirm password: '):
    raise SystemExit('Passwords do not match.')
salt = secrets.token_hex(16)
hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
payload = json.dumps({'ADMIN_PASSWORD_HASH': f'{salt}:{hashed}'})
subprocess.run(['pnpm', 'exec', 'wrangler', 'secret', 'bulk', '-c', 'workers/admin/wrangler.jsonc'], input=payload, text=True, cwd=root, check=True)
# The same persistent account is authoritative for website changes and recovery.
# Send hashes through a private file, never command arguments or terminal output.
with tempfile.NamedTemporaryFile(mode='w', suffix='.sql') as migration:
    migration.write(
        "INSERT INTO admin_account (id,password_hash,version,updated_at) "
        f"VALUES (1,'{salt}:{hashed}',1,CAST(strftime('%s','now') AS INTEGER)*1000) "
        "ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,"
        "version=admin_account.version+1,updated_at=excluded.updated_at;\n"
        "DELETE FROM admin_sessions;\n"
    )
    migration.flush()
    subprocess.run(['pnpm', 'exec', 'wrangler', 'd1', 'execute', 'gemigo-projects', '--remote',
                    '-c', 'workers/admin/wrangler.jsonc', '--file', migration.name],
                   cwd=root, check=True)
if generate:
    directory = Path.home() / '.config' / 'gemigo'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    target = directory / 'admin-credentials.json'
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(descriptor, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        json.dump({'url': 'https://admin.gemigo.io', 'username': 'admin', 'password': password}, output, indent=2)
    print(f'Credentials saved locally: {target}')
print('Independent admin password configured.')
