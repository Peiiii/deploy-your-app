const paths: Record<string, string> = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  growth: 'M4 20V4 M4 20h16 M7 15l5-5 4 3 5-7 M17 6h4v4',
  projects: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M17.5 14v7 M14 17.5h7',
  feedback: 'M21 11a8 8 0 0 1-8 8H6l-4 3V11a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8z M7 9h9 M7 13h6',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  deployments: 'M12 16V3 M7 8l5-5 5 5 M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  overview: 'M3 3h18v18H3z M3 9h18 M9 9v12',
  features: 'M12 3l9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  funnels: 'M3 4h18l-7 8v7l-4 2v-9z',
  events: 'M4 6h1 M9 6h11 M4 12h1 M9 12h11 M4 18h1 M9 18h11',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  security: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M9 12l2 2 4-4',
  audit: 'M7 3h10v3H7z M7 4H5v17h14V4h-2 M8 11h8 M8 15h6',
};
export default function SidebarIcon({ name }: { name: string }) {
  return (
    <svg
      className="sidebar-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name] || paths.overview} />
    </svg>
  );
}
