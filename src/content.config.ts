import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

// --- Profile collection (single JSON file — swap this to rebrand the entire site) ---
const profile = defineCollection({
  loader: file('src/data/profile.json'),
  schema: z.object({
    name: z.string(),
    firstName: z.string(),
    headline: z.string(),
    location: z.string().optional(),
    email: z.string().email(),
    phone: z.string().optional(),
    avatar: z.string().optional(),
    resumeUrl: z.string().optional(),
    about: z.string(),
    stats: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        })
      )
      .optional(),
    experience: z.array(
      z.object({
        title: z.string(),
        company: z.string(),
        companyUrl: z.string().optional(),
        location: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        current: z.boolean().default(false),
        description: z.string(),
        highlights: z.array(z.string()),
        tech: z.array(z.string()).optional(),
      })
    ),
    projects: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        longDescription: z.string().optional(),
        url: z.string().optional(),
        repo: z.string().optional(),
        tags: z.array(z.string()),
        featured: z.boolean().default(false),
        image: z.string().optional(),
      })
    ),
    skills: z.array(
      z.object({
        category: z.string(),
        icon: z.string().optional(),
        items: z.array(
          z.object({
            name: z.string(),
            level: z.number().min(0).max(100).optional(),
          })
        ),
      })
    ).optional(),
    education: z.array(
      z.object({
        institution: z.string(),
        degree: z.string(),
        field: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        description: z.string().optional(),
      })
    ),
    certifications: z.array(
      z.object({
        name: z.string(),
        issuer: z.string(),
        issueDate: z.string().optional(),
        credentialId: z.string().optional(),
        url: z.string().optional(),
        skills: z.array(z.string()).optional(),
      })
    ).optional(),
    socials: z.array(
      z.object({
        label: z.string(),
        url: z.string(),
        icon: z.string(),
      })
    ),
  }),
});

// --- Blog collection (Markdown files in src/content/blog/) ---
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    readingTime: z.string().optional(),
  }),
});

export const collections = { profile, blog };
