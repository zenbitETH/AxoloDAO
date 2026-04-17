#!/usr/bin/env node
/**
 * extract-species.mjs
 *
 * Parses the 17 Notion-exported A_*.html files in AmbystomaSpecies/ and writes
 * one YAML per species into src/content/species/{slug}.yaml.
 * Cross-references the master CSV to reconcile state lists.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseHTML } from 'node-html-parser';
import { stringify as yamlStringify } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC_DIR = resolve(ROOT, 'AmbystomaSpecies');
const OUT_DIR = resolve(ROOT, 'src/content/species');
const MARKERS_DIR = resolve(ROOT, 'MapAssets');
const STATE_OVERRIDES_PATH = resolve(__dirname, 'species-state-overrides.json');

mkdirSync(OUT_DIR, { recursive: true });

const stateOverrides = existsSync(STATE_OVERRIDES_PATH)
  ? JSON.parse(readFileSync(STATE_OVERRIDES_PATH, 'utf8'))
  : {};

// Map Spanish state names → ISO codes used in our schema
const STATE_NAME_TO_CODE = {
  'Aguascalientes': 'AGU',
  'Baja California': 'BCN',
  'Baja California Sur': 'BCS',
  'Campeche': 'CAM',
  'Chiapas': 'CHP',
  'Chihuahua': 'CHH',
  'Ciudad de México': 'CMX',
  'CDMX': 'CMX',
  'Coahuila': 'COA',
  'Colima': 'COL',
  'Durango': 'DUR',
  'Estado de México': 'MEX',
  'México': 'MEX',
  'Guanajuato': 'GUA',
  'Guerrero': 'GRO',
  'Hidalgo': 'HID',
  'Jalisco': 'JAL',
  'Michoacán': 'MIC',
  'Michoacan': 'MIC',
  'Morelos': 'MOR',
  'Nayarit': 'NAY',
  'Nuevo León': 'NLE',
  'Oaxaca': 'OAX',
  'Puebla': 'PUE',
  'Querétaro': 'QUE',
  'Quintana Roo': 'ROO',
  'San Luis Potosí': 'SLP',
  'Sinaloa': 'SIN',
  'Sonora': 'SON',
  'Tabasco': 'TAB',
  'Tamaulipas': 'TAM',
  'Tlaxcala': 'TLA',
  'Veracruz': 'VER',
  'Yucatán': 'YUC',
  'Zacatecas': 'ZAC',
};

const IUCN_MAP = {
  'CR': 'CR', 'EN': 'EN', 'VU': 'VU', 'NT': 'NT', 'LC': 'LC', 'DD': 'DD', 'NE': 'NE',
};

const NOM_MAP = { 'P': 'P', 'A': 'A', 'Pr': 'Pr' };

function parseStates(text) {
  if (!text) return [];
  const codes = new Set();
  const parts = text.split(/[,;]+|\s+y\s+/g).map((s) => s.trim()).filter(Boolean);
  for (let p of parts) {
    p = p.replace(/\(US\)|\(MX\)/gi, '').trim();
    // Strip parentheticals
    p = p.replace(/\(.*?\)/g, '').trim();
    if (STATE_NAME_TO_CODE[p]) {
      codes.add(STATE_NAME_TO_CODE[p]);
      continue;
    }
    // Try a fuzzy contains check (handles "Estado de México" vs "México")
    for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
      if (p.toLowerCase() === name.toLowerCase()) {
        codes.add(code);
        break;
      }
    }
  }
  return [...codes].sort();
}

function parseIucn(text) {
  if (!text) return undefined;
  const m = text.trim().match(/^([A-Z]{2})/);
  return m && IUCN_MAP[m[1]] ? IUCN_MAP[m[1]] : undefined;
}

function parseNom(text) {
  if (!text) return null;
  const m = text.trim().match(/^(Pr|P|A)\b/);
  return m && NOM_MAP[m[1]] ? NOM_MAP[m[1]] : null;
}

function slugify(scientificName) {
  // "A. mexicanum" → "mexicanum"
  return scientificName.replace(/^A\.?\s*/i, '').trim().toLowerCase().replace(/\s+/g, '-');
}

function readMarker(slug) {
  // Best-effort: the per-species marker SVG (a 39x39 dot)
  const candidates = [`${slug}.svg`, `${slug}-1.svg`];
  for (const c of candidates) {
    try {
      return readFileSync(join(MARKERS_DIR, c), 'utf8');
    } catch {}
  }
  return null;
}

function extractAccentFromMarker(svgText) {
  if (!svgText) return undefined;
  const m = svgText.match(/(?:fill|stroke)\s*=\s*"(#[0-9A-Fa-f]{3,8})"/);
  return m ? m[1] : undefined;
}

function getProperty(propertyRows, label) {
  for (const row of propertyRows) {
    const th = row.querySelector('th');
    if (!th) continue;
    const thText = th.text.replace(/\s+/g, ' ').trim();
    if (thText.endsWith(label) || thText === label) {
      const td = row.querySelector('td');
      return td ? td.text.replace(/\s+/g, ' ').trim() : '';
    }
  }
  return '';
}

function getMultiSelect(propertyRows, label) {
  for (const row of propertyRows) {
    const th = row.querySelector('th');
    if (!th) continue;
    const thText = th.text.replace(/\s+/g, ' ').trim();
    if (thText.endsWith(label) || thText === label) {
      const tds = row.querySelectorAll('td .selected-value');
      return tds.map((s) => s.text.trim());
    }
  }
  return [];
}

function getBodySection(article, h2Title) {
  const headers = article.querySelectorAll('h2');
  for (const h of headers) {
    const title = h.text.replace(/\s+/g, ' ').trim();
    if (title.toLowerCase() === h2Title.toLowerCase()) {
      // Collect all <p> until the next h2
      const paragraphs = [];
      // Notion exports wrap each h2 / p in <div style="display:contents">, so siblings live two levels up.
      // Walk forward through the article's flat children list.
      const articleKids = article.querySelectorAll('h2, h3, p');
      const startIdx = articleKids.indexOf(h);
      for (let i = startIdx + 1; i < articleKids.length; i++) {
        const node = articleKids[i];
        if (node.tagName === 'H2' || node.tagName === 'H3') break;
        if (node.tagName === 'P') {
          const txt = node.text.replace(/\s+/g, ' ').trim();
          if (txt) paragraphs.push(txt);
        }
      }
      return paragraphs.join('\n\n');
    }
  }
  return '';
}

function getReferences(article) {
  const headers = article.querySelectorAll('h2');
  for (const h of headers) {
    const title = h.text.replace(/\s+/g, ' ').trim();
    if (title.toLowerCase() === 'referencias') {
      const refs = [];
      const articleKids = article.querySelectorAll('h2, h3, p');
      const startIdx = articleKids.indexOf(h);
      for (let i = startIdx + 1; i < articleKids.length; i++) {
        const node = articleKids[i];
        if (node.tagName === 'H2' || node.tagName === 'H3') break;
        if (node.tagName === 'P') {
          const txt = node.text.replace(/\s+/g, ' ').trim();
          if (txt && /[a-z]/i.test(txt) && txt.length > 30) refs.push(txt);
        }
      }
      return refs;
    }
  }
  return [];
}

// --- main ------------------------------------------------------------------
const files = readdirSync(SRC_DIR).filter((f) => /^A\s+[a-z]+\s+[0-9a-f]{32}\.html$/i.test(f));
console.log(`[species] processing ${files.length} HTML files`);

let written = 0;
for (const file of files) {
  const html = readFileSync(join(SRC_DIR, file), 'utf8');
  const root = parseHTML(html);
  const article = root.querySelector('article');
  if (!article) { console.warn(`[species] no <article> in ${file}, skipping`); continue; }

  const titleNode = article.querySelector('.page-title');
  const scientificRaw = titleNode?.text?.trim() ?? file.replace(/\s+[0-9a-f]{32}\.html$/i, '');
  const scientificName = scientificRaw.replace(/\s+/g, ' ').trim();
  const slug = slugify(scientificName);

  const propertyRows = article.querySelectorAll('tr.property-row');

  const commonNamesText = getProperty(propertyRows, 'Nombre común');
  const commonNames = commonNamesText
    ? commonNamesText.split(/,/).map((s) => s.trim()).filter(Boolean)
    : [];

  const characterizedBy = getProperty(propertyRows, 'Caracterizado');
  const localityType = getProperty(propertyRows, 'Localidad tipo');
  const stateMulti = getMultiSelect(propertyRows, 'Ubicación por Estado');
  const parsedStates = parseStates(stateMulti.join(','));
  const states = Array.isArray(stateOverrides[slug]) ? stateOverrides[slug] : parsedStates;
  const anpRaw = getProperty(propertyRows, 'ANP');
  const anp = anpRaw && !/^sin\s+(presencia|información)/i.test(anpRaw)
    ? anpRaw.split(/,(?![^()]*\))/).map((s) => s.trim()).filter(Boolean)
    : [];
  const iucn = parseIucn(getProperty(propertyRows, 'Estatus IUCN'));
  const nom059 = parseNom(getProperty(propertyRows, 'Estatus NOM-059'));

  const description = getBodySection(article, 'Descripción');
  const feeding = getBodySection(article, 'Alimentación');
  const reproduction = getBodySection(article, 'Reproducción');
  const habitat = getBodySection(article, 'Hábitat');
  const distribution = getBodySection(article, 'Distribución Geográfica');
  const threats = getBodySection(article, 'Principales amenazas');
  const references = getReferences(article);

  const markerSvg = readMarker(slug);
  const accentColor = extractAccentFromMarker(markerSvg);

  const heroCardSvg = ['andersoni', 'dumerili', 'mexicanum'].includes(slug)
    ? `${slug.charAt(0).toUpperCase()}${slug.slice(1)}Card.svg`
    : undefined;

  const data = {
    slug,
    scientificName,
    commonNames,
    states,
    iucn,
    nom059,
    description: description || undefined,
    habitat: habitat || undefined,
    distribution: distribution || undefined,
    threats: threats || undefined,
    feeding: feeding || undefined,
    reproduction: reproduction || undefined,
    references,
    anp,
    localityType: localityType || undefined,
    characterizedBy: characterizedBy || undefined,
    heroCardSvg,
    markerSvg: markerSvg ? `${slug}.svg` : undefined,
    accentColor,
    endemic: !/(US|Canada|Texas|Mexico\)|Nuevo Mexico)/i.test(stateMulti.join(',')),
  };

  // strip undefined keys
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)));
  // re-add nom059 even when null so downstream code can render "—"
  if (data.nom059 === null) clean.nom059 = null;

  const yaml = yamlStringify(clean, { lineWidth: 0 });
  writeFileSync(join(OUT_DIR, `${slug}.yaml`), yaml);
  console.log(`  → ${slug}.yaml  (${states.length} states, IUCN=${iucn ?? '?'})`);
  written++;
}

console.log(`[species] wrote ${written} YAML files to ${OUT_DIR}`);
