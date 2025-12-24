import { ParsedQs } from 'qs';

const THEMES = new Set(['dark', 'light', 'github', 'devgrid']);
const LAYOUTS = new Set(['default', 'compact', 'wide']);
const KNOWN_SECTIONS = new Set(['stars', 'repos', 'prs', 'commits', 'contributions', 'streak']);

export interface SvgOptions {
  theme: 'dark' | 'light' | 'github' | 'devgrid';
  layout: 'default' | 'compact' | 'wide';
  hide: string[]; // section keys to hide
  show: string[]; // section keys to force-show
  hide_border: boolean;
}

function toList(v?: any) {
  if (!v) return [] as string[];
  if (Array.isArray(v)) return v.map((x: any) => String(x)).flatMap((s: string) => s.split(',').map(x => x.trim()).filter(Boolean));
  return String(v).split(',').map(x => x.trim()).filter(Boolean);
}

export function parseSvgOptions(q: ParsedQs | undefined): SvgOptions {
  const themeRaw = q?.theme ? String(q.theme).toLowerCase() : 'dark';
  const layoutRaw = q?.layout ? String(q.layout).toLowerCase() : 'default';

  const theme = THEMES.has(themeRaw) ? (themeRaw as SvgOptions['theme']) : 'dark';
  const layout = LAYOUTS.has(layoutRaw) ? (layoutRaw as SvgOptions['layout']) : 'default';

  const hide = toList(q?.hide).map(s => s.toLowerCase()).filter(s => KNOWN_SECTIONS.has(s));
  const show = toList(q?.show).map(s => s.toLowerCase()).filter(s => KNOWN_SECTIONS.has(s));

  const hide_border = ((): boolean => {
    const v = q?.hide_border;
    if (v === undefined) return false;
    const s = String(v).toLowerCase().trim();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  })();

  // hide overrides show per requirements
  const finalHide = new Set<string>(hide);
  for (const s of show) {
    if (!finalHide.has(s)) finalHide.add(s === 'all' ? '' : ''); // noop: show only matters for known sections, hide wins
  }

  return { theme, layout, hide: Array.from(finalHide).filter(Boolean), show, hide_border };
}

export function themePalette(theme: SvgOptions['theme']) {
  switch (theme) {
    case 'light':
      return { bg: '#ffffff', card: '#f7f8fa', text: '#0b1226', subtext: '#586069', accent: '#0366d6' };
    case 'github':
      return { bg: '#ffffff', card: '#fafbfc', text: '#24292f', subtext: '#57606a', accent: '#6cc644' };
    case 'devgrid':
      return { bg: '#0f1724', card: '#071028', text: '#e6eef8', subtext: '#9fb0d6', accent: '#00d4ff' };
    case 'dark':
    default:
      return { bg: '#0b1226', card: '#0b1226', text: '#ffffff', subtext: '#9aa4c0', accent: '#7c5cff' };
  }
}
