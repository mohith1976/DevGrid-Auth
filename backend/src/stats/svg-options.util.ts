import { ParsedQs } from 'qs';

const THEMES = new Set(['dark', 'light', 'github', 'devgrid']);
const LAYOUTS = new Set(['default', 'compact', 'wide']);
const KNOWN_SECTIONS = new Set(['stars', 'repos', 'prs', 'pr', 'pulls', 'pull_requests', 'commits', 'contributions', 'activity', 'streak']);

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

  const hideList = toList(q?.hide).map(s => s.toLowerCase()).filter(s => KNOWN_SECTIONS.has(s));
  const showList = toList(q?.show).map(s => s.toLowerCase()).filter(s => KNOWN_SECTIONS.has(s));

  const hide_border = ((): boolean => {
    const v = q?.hide_border;
    if (v === undefined) return false;
    const s = String(v).toLowerCase().trim();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  })();

  // Determine visible set: start with all known sections, remove hide, then add show (but don't re-add anything hidden)
  const visible = new Set<string>();
  for (const s of KNOWN_SECTIONS) visible.add(s);
  for (const h of hideList) {
    visible.forEach(v => { if (v === h) visible.delete(v); });
    visible.delete(h);
  }
  for (const s of showList) {
    if (!hideList.includes(s)) visible.add(s);
  }

  // Normalize output hide/show arrays to the canonical keys we will use in rendering
  const canonical = (k: string) => {
    if (k === 'pr' || k === 'pulls' || k === 'pull_requests') return 'prs';
    if (k === 'activity') return 'contributions';
    return k;
  };

  const hide = Array.from(new Set(Array.from(KNOWN_SECTIONS).filter(k => !visible.has(k)).map(canonical))).filter(Boolean);
  const show = Array.from(new Set(Array.from(visible).map(canonical))).filter(Boolean);

  return { theme, layout, hide, show, hide_border };
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
      // dark theme should be pure/near-black for strong contrast per design request
      return { bg: '#000000', card: '#0b0b0b', text: '#ffffff', subtext: '#9aa4c0', accent: '#ff8c00' };
  }
}
