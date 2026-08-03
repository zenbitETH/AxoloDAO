import { defineCollection, z } from 'astro:content';

const localeText = z.object({ es: z.string(), en: z.string(), pt: z.string() });
const localeTextOptional = z.object({ es: z.string().optional(), en: z.string().optional(), pt: z.string().optional() });

const social = z.object({
  platform: z.enum(['x', 'instagram', 'youtube', 'farcaster', 'github', 'website', 'linkedin', 'tiktok']),
  url: z.string().url(),
  handle: z.string().optional(),
});

const teamMember = z.object({
  name: z.string(),
  title: localeText,
  photo: z.string().optional(),
  socials: z.array(social).default([]),
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
    team: z.array(teamMember).default([]),
  }),
});

const partners = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    role: localeText,
    description: localeText,
    // Drives accent colour: academic → teal, government → rosa.
    kind: z.enum(['academic', 'government']).default('academic'),
    // Short ribbon/pleca tag shown at the top of every card.
    ribbon: localeTextOptional.optional(),
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
    links: z
      .array(
        z.object({
          label: localeText,
          url: z.string().url(),
          variant: z.enum(['primary', 'secondary']).default('primary'),
        }),
      )
      .optional(),
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

const news = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    author: z.enum(['zenbit', 'xolotlcalli', 'ndali']),
    url: z.string().url(),
    image: z.string(),
    // Rail proxy for the video-first chapters (lunes, ajolote). Small and
    // low-bitrate on purpose — the publish-quality master goes to Instagram, not
    // into this repo's history. `poster` falls back to `image` when absent.
    video: z.string().optional(),
    poster: z.string().optional(),
    caption: localeText,
    publishedAt: z.string(),
    weekNumber: z.number().optional(),
    podcastNumber: z.number().optional(),
    // Which of the week's four chapters this post is. `semanal` is the pre-W31
    // format: ONE post that carried the census, the water table and the podcast
    // together. Defaulting the fourteen archive entries to `axolonews` would have
    // been a small lie about what they contained, so they get their own value —
    // and the default keeps every one of them valid with no edit.
    chapter: z
      .enum(['semanal', 'lunes', 'axolonews', 'podcast', 'ajolote'])
      .default('semanal'),
  }),
});

export const collections = { members, partners, projects, species, news };
export { STATE_CODES };
