"""Exercise the real recovery command without changing production or real credentials."""
import hashlib
import json
import os
from pathlib import Path
import runpy
import tempfile
from unittest.mock import patch

with tempfile.TemporaryDirectory() as directory:
    calls = []
    sql_payloads = []

    def run(args, **kwargs):
        calls.append((args, kwargs))
        if '--file' in args:
            source = Path(args[args.index('--file') + 1])
            assert source.stat().st_mode & 0o777 == 0o600
            sql_payloads.append(source.read_text())

    with patch('pathlib.Path.home', return_value=Path(directory)), \
         patch('subprocess.run', side_effect=run), \
         patch('sys.argv', ['configure-admin.py', '--generate']):
        runpy.run_path('scripts/configure-admin.py', run_name='__main__')
    target = Path(directory) / '.config/gemigo/admin-credentials.json'
    credentials = json.loads(target.read_text())
    assert target.stat().st_mode & 0o777 == 0o600
    assert len(credentials['password']) >= 8
    stored = json.loads(calls[0][1]['input'])['ADMIN_PASSWORD_HASH']
    salt, expected = stored.split(':')
    assert hashlib.pbkdf2_hmac('sha256', credentials['password'].encode(), salt.encode(), 100000).hex() == expected
    assert stored in sql_payloads[0]
    assert 'version=admin_account.version+1' in sql_payloads[0]
    assert 'DELETE FROM admin_sessions' in sql_payloads[0]
    assert credentials['password'] not in sql_payloads[0]
    assert all(credentials['password'] not in str(args) and stored not in str(args) for args, _ in calls)
    assert not Path(calls[1][0][-1]).exists(), 'temporary hash file is removed'
    assert not os.listdir(directory) == [], 'only fake home was used'
    with patch('getpass.getpass', return_value='x' * 257), \
         patch('subprocess.run') as forbidden, \
         patch('sys.argv', ['configure-admin.py']):
        try:
            runpy.run_path('scripts/configure-admin.py', run_name='__main__')
            raise AssertionError('oversized passwords must fail before writing')
        except SystemExit:
            forbidden.assert_not_called()
print('PASS recovery: secret stdin, same account owner/version, session revocation, matching PBKDF2, private files, no plaintext/hash in arguments, temporary file cleanup.')
