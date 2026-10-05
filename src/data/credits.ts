// Builds the Credits page from the two files that record where pictures come from: web/thumbnails/sources.json (card images,
// Explore previews and course banners) and web/lesson-media/attribution.json (figures inside lessons). Pure functions, no imports
// of JSON or the network, so `node --test` runs the same code against the shipped files.

/** One picture's record in sources.json (the fields the page needs). */
export type SourceItem = { credit?: string; license?: string; source?: string };

export type SourcesFile = {
  items: Record<string, SourceItem>;
  previews: { items: Record<string, SourceItem> };
  banners?: { items: Record<string, SourceItem> };
};

export type AttributionFile = Record<string, { title: string; creator?: string; source?: string; license: string }>;

/** The licence the app gives to pictures it rendered itself from its own 3D models; these are summarised, not listed. */
export const OWN_RENDER_LICENSE = 'Course material';

export type CreditEntry = {
  /** What the picture shows or where it is from. */
  label: string;
  creator?: string;
  license: string;
  /** A web address for the original, when there is one. */
  link?: string;
  /** A source that is not a web page, such as a figure number in a manual. */
  reference?: string;
};

export type CreditGroup = { license: string; licenseLink?: string; entries: CreditEntry[] };

export type Credits = {
  groups: CreditGroup[];
  /** How many pictures are the app's own renders (listed together, not one by one). */
  ownRenderCount: number;
};

const LICENSE_LINKS: Record<string, string> = {
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
};

// The order the page lists licences in: open licences first, then public-domain government work, then licensed course material.
const LICENSE_ORDER = ['CC BY 2.0', 'CC BY-SA 3.0', 'CC0', 'U.S. Government work', 'Course reference extract'];

const isWebAddress = (value?: string) => Boolean(value && /^https?:\/\//i.test(value));

/** Every picture record in sources.json, with the image id it is filed under. */
function sourceRecords(sources: SourcesFile): SourceItem[] {
  const sections = [sources.items, sources.previews?.items, sources.banners?.items];
  return sections.flatMap((section) => Object.values(section || {}));
}

export function buildCredits(sources: SourcesFile, attribution: AttributionFile): Credits {
  const entries = new Map<string, CreditEntry>();
  let ownRenderCount = 0;

  // The figures inside lessons carry structured fields (title, creator), so they are read first and win over a looser credit line.
  for (const item of Object.values(attribution)) {
    if (item.license === OWN_RENDER_LICENSE) continue;
    const web = isWebAddress(item.source);
    const key = web ? item.source! : `${item.title}|${item.license}`;
    entries.set(key, { label: item.title, creator: item.creator, license: item.license, link: web ? item.source : undefined, reference: web ? undefined : item.source });
  }

  for (const item of sourceRecords(sources)) {
    if (!item.license) continue;
    if (item.license === OWN_RENDER_LICENSE) { ownRenderCount += 1; continue; }
    const credit = item.credit || '';
    const web = isWebAddress(item.source);
    const key = web ? item.source! : `${credit}|${item.license}`;
    if (!entries.has(key)) entries.set(key, { label: credit, license: item.license, link: web ? item.source : undefined });
  }

  const byLicense = new Map<string, CreditEntry[]>();
  for (const entry of entries.values()) byLicense.set(entry.license, [...(byLicense.get(entry.license) || []), entry]);
  const licenses = [...byLicense.keys()].sort((a, b) => {
    const rank = (license: string) => (LICENSE_ORDER.includes(license) ? LICENSE_ORDER.indexOf(license) : LICENSE_ORDER.length);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return {
    groups: licenses.map((license) => ({
      license,
      licenseLink: LICENSE_LINKS[license],
      entries: byLicense.get(license)!.sort((a, b) => a.label.localeCompare(b.label)),
    })),
    ownRenderCount,
  };
}
