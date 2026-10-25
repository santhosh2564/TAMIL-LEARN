import fs from 'fs';
import path from 'path';
import https from 'https';

export interface LicenseEvidence {
  assetId: string;
  retrievalDate: string;
  sourceUrl: string;
  platform: 'flickr' | 'wikimedia' | 'rawpixel' | 'unknown';
  liveLicense: string;
  liveLicenseRaw: string;
  liveCreator: string;
  isAllowedLicense: boolean;
  disallowedReason?: string;
  rawResponse: any;
}

export function normalizeLicense(lic?: string): string {
  if (!lic) return 'unknown';
  const l = lic.trim().toLowerCase();
  if (l.includes('cc0') || l.includes('zero') || l.includes('public domain dedication') || l === 'public domain' || l === 'pdm') return 'cc0';
  if (l.includes('by-nc-sa')) {
    const v = l.match(/4\.0|3\.0|2\.5|2\.0/) ? l.match(/4\.0|3\.0|2\.5|2\.0/)![0] : '4.0';
    return `cc-by-nc-sa-${v}`;
  }
  if (l.includes('by-nc')) {
    const v = l.match(/4\.0|3\.0|2\.5|2\.0/) ? l.match(/4\.0|3\.0|2\.5|2\.0/)![0] : '4.0';
    return `cc-by-nc-${v}`;
  }
  if (l.includes('by-nd')) {
    const v = l.match(/4\.0|3\.0|2\.5|2\.0/) ? l.match(/4\.0|3\.0|2\.5|2\.0/)![0] : '4.0';
    return `cc-by-nd-${v}`;
  }
  if (l.includes('by-sa-4.0') || l.includes('by-sa 4.0') || l.includes('by-sa/4.0')) return 'cc-by-sa-4.0';
  if (l.includes('by-sa-3.0') || l.includes('by-sa 3.0') || l.includes('by-sa/3.0')) return 'cc-by-sa-3.0';
  if (l.includes('by-sa-2.5') || l.includes('by-sa 2.5') || l.includes('by-sa/2.5')) return 'cc-by-sa-2.5';
  if (l.includes('by-sa-2.0') || l.includes('by-sa 2.0') || l.includes('by-sa/2.0')) return 'cc-by-sa-2.0';
  if (l.includes('by-4.0') || l.includes('by 4.0') || l.includes('by/4.0')) return 'cc-by-4.0';
  if (l.includes('by-3.0') || l.includes('by 3.0') || l.includes('by/3.0')) return 'cc-by-3.0';
  if (l.includes('by-2.5') || l.includes('by 2.5') || l.includes('by/2.5')) return 'cc-by-2.5';
  if (l.includes('by-2.0') || l.includes('by 2.0') || l.includes('by/2.0')) return 'cc-by-2.0';
  if (l === 'by') return 'cc-by-4.0';
  if (l === 'by-sa') return 'cc-by-sa-4.0';
  return l;
}

export function isAllowedLicense(normLic: string): boolean {
  if (normLic.includes('nc') || normLic.includes('nd')) return false;
  return /^(cc0|pdm|cc-by-(2\.0|2\.5|3\.0|4\.0)|cc-by-sa-(2\.0|2\.5|3\.0|4\.0))$/.test(normLic);
}

function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'TamilLearningPlatform/1.0 (educational; contact: info@tamil-learn.org)', ...headers }, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ error: `Non-JSON response (HTTP ${res.statusCode})`, raw: data.slice(0, 300) });
        }
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)', ...headers }, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

export async function verifySingleAsset(assetId: string, sourceUrl: string): Promise<LicenseEvidence> {
  const retrievalDate = new Date().toISOString();
  
  if (sourceUrl.includes('flickr.com')) {
    const oembedUrl = `https://www.flickr.com/services/oembed/?format=json&url=${encodeURIComponent(sourceUrl)}`;
    const oembed = await fetchJson(oembedUrl);
    
    let rawLic = oembed.license || '';
    let author = oembed.author_name || '';
    
    // Also inspect page HTML for full display name / real name
    const html = await fetchText(sourceUrl);
    const realnameMatch = html.match(/"realname":\s*"([^"]+)"/i);
    if (realnameMatch && realnameMatch[1].trim() && !realnameMatch[1].includes('@')) {
      author = realnameMatch[1].replace(/\s+/g, ' ').trim();
    }
    
    if (!rawLic) {
      const ccMatch = html.match(/https?:\/\/creativecommons\.org\/licenses\/[^\s"'>]+/i);
      if (ccMatch) rawLic = ccMatch[0];
    }
    
    const norm = normalizeLicense(oembed.license_url || rawLic);
    const allowed = isAllowedLicense(norm);
    
    return {
      assetId,
      retrievalDate,
      sourceUrl,
      platform: 'flickr',
      liveLicense: norm,
      liveLicenseRaw: rawLic,
      liveCreator: author,
      isAllowedLicense: allowed,
      disallowedReason: !allowed ? (norm.includes('nc') ? 'Non-Commercial (NC) not allowed' : norm.includes('nd') ? 'No-Derivatives (ND) not allowed' : 'Unrecognized or restricted license') : undefined,
      rawResponse: oembed
    };
  }
  
  if (sourceUrl.includes('wikimedia.org')) {
    const curidMatch = sourceUrl.match(/curid=(\d+)/);
    let apiUrl = '';
    let fileTitle = '';
    if (curidMatch) {
      apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&pageids=${curidMatch[1]}&prop=imageinfo&iiprop=extmetadata|url&format=json`;
    } else {
      const match = sourceUrl.match(/File:([^&?#]+)/);
      fileTitle = match ? match[1] : '';
      apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${fileTitle}&prop=imageinfo&iiprop=extmetadata|url&format=json`;
    }
    
    const apiRes = await fetchJson(apiUrl);
    const page = Object.values(apiRes.query?.pages || {})[0] as any;
    const meta = page?.imageinfo?.[0]?.extmetadata || {};
    
    const licRaw = meta.LicenseShortName?.value || meta.License?.value || '';
    const licUrl = meta.LicenseUrl?.value || '';
    const norm = normalizeLicense(licUrl || licRaw);
    
    // Extract author
    let artistRaw = meta.Artist?.value || '';
    let artist = artistRaw.replace(/<[^>]+>/g, '').trim();
    
    // Special handling for placeholder author strings in Wikimedia (e.g. crow -> "Duncan Wright")
    if (artist.includes('No machine-readable author provided') || artist.includes('assumed (based on copyright claims)')) {
      const pageTitle = page?.title ? page.title.replace(/ /g, '_') : '';
      const htmlUrl = pageTitle ? `https://commons.wikimedia.org/wiki/${pageTitle}` : sourceUrl;
      const html = await fetchText(htmlUrl);
      const takenByMatch = html.match(/Taken by <a[^>]*>([^<]+)<\/a>/i);
      if (takenByMatch) {
        artist = takenByMatch[1].trim();
      } else {
        const userMatch = artistRaw.match(/User:([^"&'>]+)/i);
        artist = userMatch ? decodeURIComponent(userMatch[1].replace(/_/g, ' ')) : 'Wikimedia Commons contributor';
      }
    }
    
    const allowed = isAllowedLicense(norm);
    return {
      assetId,
      retrievalDate,
      sourceUrl,
      platform: 'wikimedia',
      liveLicense: norm,
      liveLicenseRaw: licRaw,
      liveCreator: artist,
      isAllowedLicense: allowed,
      disallowedReason: !allowed ? (norm.includes('nc') ? 'Non-Commercial (NC) not allowed' : norm.includes('nd') ? 'No-Derivatives (ND) not allowed' : 'Unrecognized or restricted license') : undefined,
      rawResponse: apiRes
    };
  }
  
  if (sourceUrl.includes('rawpixel.com')) {
    const isPublicDomainUrl = sourceUrl.includes('public-domain');
    let openverseMatch: any = null;
    
    const openverseSearch = await fetchJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(sourceUrl)}`);
    if (openverseSearch.results?.length) {
      openverseMatch = openverseSearch.results.find((r: any) => r.foreign_landing_url === sourceUrl) || openverseSearch.results[0];
    }
    
    const isConfirmed = isPublicDomainUrl && (!openverseMatch || openverseMatch.license === 'cc0');
    const norm = isConfirmed ? 'cc0' : 'unknown';
    const allowed = isAllowedLicense(norm);
    
    return {
      assetId,
      retrievalDate,
      sourceUrl,
      platform: 'rawpixel',
      liveLicense: norm,
      liveLicenseRaw: 'CC0 / Public Domain',
      liveCreator: 'rawpixel',
      isAllowedLicense: allowed,
      disallowedReason: !allowed ? 'Could not confirm CC0 status' : undefined,
      rawResponse: { url: sourceUrl, isPublicDomainUrl, openverseMatch }
    };
  }
  
  return {
    assetId,
    retrievalDate,
    sourceUrl,
    platform: 'unknown',
    liveLicense: 'unknown',
    liveLicenseRaw: 'unknown',
    liveCreator: 'unknown',
    isAllowedLicense: false,
    disallowedReason: 'Unknown platform',
    rawResponse: {}
  };
}

export async function runVerification(targetAssets?: string[]) {
  const evidenceDir = path.resolve('docs/license-evidence');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  
  const manifestPath = path.resolve('src/content/class-3/english/asset-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  const assetsToCheck = targetAssets || Object.keys(manifest).filter(key => {
    const entry = manifest[key];
    const src = entry.provenance?.source;
    return ['openverse', 'wikimedia', 'flickr'].includes(src);
  });
  
  const rows: {
    asset: string;
    manifestLicense: string;
    liveLicense: string;
    manifestCreator: string;
    liveCreator: string;
    result: string;
  }[] = [];
  
  for (const assetId of assetsToCheck) {
    const entry = manifest[assetId];
    if (!entry) continue;
    const sourceUrl = entry.provenance?.sourceUrl || entry.sourcePageUrl;
    if (!sourceUrl) {
      rows.push({
        asset: assetId,
        manifestLicense: entry.provenance?.license || entry.license || 'unknown',
        liveLicense: 'none',
        manifestCreator: entry.provenance?.creator || entry.creator || 'unknown',
        liveCreator: 'none',
        result: 'FAIL: Missing sourceUrl'
      });
      continue;
    }
    
    const evidence = await verifySingleAsset(assetId, sourceUrl);
    
    // Save raw response to docs/license-evidence/<asset>.json
    const evidenceFile = path.join(evidenceDir, `${assetId}.json`);
    fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2), 'utf8');
    
    const manifestLicense = entry.provenance?.license || entry.license || 'unknown';
    const manifestCreator = entry.provenance?.creator || entry.creator || 'unknown';
    
    let result = 'PASS';
    if (!evidence.isAllowedLicense) {
      result = `FAIL: Disallowed license (${evidence.liveLicense}) - ${evidence.disallowedReason}`;
    } else if (manifestLicense !== evidence.liveLicense) {
      result = `FAIL: License mismatch (manifest: ${manifestLicense} vs live: ${evidence.liveLicense})`;
    } else if (manifestCreator !== evidence.liveCreator) {
      result = `FAIL: Creator mismatch (manifest: "${manifestCreator}" vs live: "${evidence.liveCreator}")`;
    }
    
    rows.push({
      asset: assetId,
      manifestLicense,
      liveLicense: evidence.liveLicense,
      manifestCreator,
      liveCreator: evidence.liveCreator,
      result
    });
  }
  
  return rows;
}

if (process.argv[1]?.endsWith('verify-licenses-live.ts')) {
  runVerification().then(rows => {
    console.log('\nRAW COMPARISON OUTPUT:');
    console.log('asset | manifest license | live license | manifest creator | live creator | result');
    console.log('---|---|---|---|---|---');
    for (const r of rows) {
      console.log(`${r.asset} | ${r.manifestLicense} | ${r.liveLicense} | ${r.manifestCreator} | ${r.liveCreator} | ${r.result}`);
    }
  });
}
