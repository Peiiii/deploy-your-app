export const api = async <T>(path: string, data?: object): Promise<T> => {
  const response = await fetch(
    '/api/' + path,
    data
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : undefined
  );
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== 'login')
      window.dispatchEvent(new Event('admin-session-expired'));
    throw new Error(result.error || '请求失败');
  }
  return result;
};
