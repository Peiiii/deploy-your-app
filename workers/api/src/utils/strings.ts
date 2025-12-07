export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'app'
  );
}

export function trimWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
