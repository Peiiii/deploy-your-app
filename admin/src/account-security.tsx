import { useState, type FormEvent } from 'react';
import { api } from './api';

export default function AccountSecurity({
  username,
  changed,
}: {
  username: string;
  changed: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (newPassword === currentPassword) {
      setError('新密码不能与当前密码相同');
      return;
    }
    setBusy(true);
    try {
      await api('password', { currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      changed();
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="two-columns security-columns">
      <article className="panel">
        <h3>修改管理员密码</h3>
        <p className="muted">
          当前独立账号：<strong>{username}</strong>
        </p>
        <form className="password-form" onSubmit={(event) => void submit(event)}>
          <label>
            当前密码
            <input
              required
              type="password"
              autoComplete="current-password"
              maxLength={256}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            新密码
            <input
              required
              type="password"
              autoComplete="new-password"
              aria-label="新密码"
              aria-describedby="new-password-hint"
              minLength={8}
              maxLength={256}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <small id="new-password-hint">8–256 个字符，建议使用密码管理器生成。</small>
          </label>
          <label>
            确认新密码
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? '正在修改…' : '保存新密码并重新登录'}
          </button>
        </form>
      </article>
      <article className="panel security-note">
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h3>独立的管理权限</h3>
        <p className="muted">管理员账号与主站用户账号分离。修改此密码不会影响主站用户的密码。</p>
        <div className="row">修改成功后，所有管理员登录会话立即失效。</div>
        <div className="row">你将返回登录页，使用新密码继续管理。</div>
        <div className="row">密码不会显示在操作记录中。</div>
      </article>
    </div>
  );
}
