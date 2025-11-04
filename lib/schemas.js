// @ts-check
const { z } = require('zod');

const subtitleSchema = z.object({
  lang: z.string().min(1),
  label: z.string().min(1),
  url: z.string().url()
});

const baseMediaSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  genres: z.array(z.string().min(1)),
  releaseYear: z.number().int().min(1900).max(2100),
  durationMinutes: z.number().int().positive(),
  streamUrl: z.string().url(),
  posterUrl: z.string().url(),
  heroUrl: z.string().url().optional(),
  subtitles: z.array(subtitleSchema),
  createdAt: z.string().datetime(),
  published: z.boolean().default(false),
  featured: z.boolean().default(false),
  categories: z.array(z.string().min(1)).default([]),
  views: z.number().int().nonnegative().default(0)
});

const movieSchema = baseMediaSchema.extend({
  type: z.literal('movie'),
  languages: z.array(z.string().min(1)).default([])
});

const seriesEpisodeSchema = z.object({
  season: z.number().int().min(1),
  episode: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  streamUrl: z.string().url(),
  subtitles: z.array(subtitleSchema),
  releaseDate: z.string().datetime(),
  published: z.boolean().default(false)
});

const seriesSchema = baseMediaSchema.extend({
  type: z.literal('series'),
  seasons: z.array(
    z.object({
      season: z.number().int().min(1),
      episodes: z.array(seriesEpisodeSchema)
    })
  ),
  totalSeasons: z.number().int().min(1),
  totalEpisodes: z.number().int().min(1),
  slug: z.string().min(1)
});

const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  type: z.enum(['movie', 'series', 'mixed']),
  createdAt: z.string().datetime()
});

const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3),
  password: z.string().min(1),
  role: z.enum(['admin', 'user']),
  disabled: z.boolean().optional(),
  createdAt: z.string().datetime()
});

const historyEntrySchema = z.object({
  contentId: z.string().min(1),
  type: z.enum(['movie', 'series']),
  progress: z.number().min(0).max(1),
  lastWatched: z.string().datetime(),
  season: z.number().int().min(1).optional(),
  episode: z.number().int().min(1).optional()
});

module.exports = {
  baseMediaSchema,
  movieSchema,
  seriesEpisodeSchema,
  seriesSchema,
  categorySchema,
  userSchema,
  historyEntrySchema
};
