import { defineCollection, z } from 'astro:content';

const localeText = z.object({ es: z.string(), en: z.string(), pt: z.string() });
const localeTextOptional = z.object({ es: z.string().optional(), en: z.string().optional(), pt: z.string().optional() });

const social = z.object({
  platform: z.enum(['x', 'instagram', 'youtube', 'farcaster', 'github', 'website', 'linkedin', 'tiktok']),
  url: z.string().url(),
  handle: z.string().optional(),
});

const members = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    role: localeText,
    description: localeText,
    socials: z.array(social).default([]),
    logo: z.string().optional(),
    icon: z.string().optional(),
    ens: z.string().optional(),
    accentColor: z.string().optional(),
  }),
});

const partners = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    role: localeText,
    description: localeText,
    featured: z.boolean().default(false),
    featuredLabel: localeTextOptional.optional(),
    socials: z.array(social).default([]),
    logo: z.string().optional(),
    logoMode: z.enum(['image', 'text']).default('image'),
    website: z.string().url().optional(),
  }),
});

const projects = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    status: z.enum(['live', 'wip', 'planning']),
    blurb: localeText,
    description: localeText,
    url: z.string().url().optional(),
    cta: localeTextOptional.optional(),
    icon: z.string().optional(),
    accent: z.enum(['teal', 'rosa', 'ocre', 'marfil']).default('teal'),
    contributors: z.array(z.string()).default([]),
  }),
});

const STATE_CODES = [
  'AGU','BCN','BCS','CAM','CHH','CHP','CMX','COA','COL','DUR','GRO','GUA','HID','JAL',
  'MEX','MIC','MOR','NAY','NLE','OAX','PUE','QUE','ROO','SIN','SLP','SON','TAB','TAM',
  'TLA','VER','YUC','ZAC',
] as const;

const species = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    scientificName: z.string(),
    commonNames: z.array(z.string()).default([]),
    states: z.array(z.enum(STATE_CODES)).default([]),
    iucn: z.enum(['CR','EN','VU','NT','LC','DD','NE']).optional(),
    nom059: z.enum(['P','A','Pr']).nullable().optional(),
    description: z.string().optional(),
    habitat: z.string().optional(),
    distribution: z.string().optional(),
    threats: z.string().optional(),
    feeding: z.string().optional(),
    reproduction: z.string().optional(),
    references: z.array(z.string()).default([]),
    anp: z.array(z.string()).default([]),
    localityType: z.string().optional(),
    characterizedBy: z.string().optional(),
    heroCardSvg: z.string().optional(),
    markerSvg: z.string().optional(),
    accentColor: z.string().optional(),
    endemic: z.boolean().default(true),
  }),
});

export const collections = { members, partners, projects, species };
export { STATE_CODES };
