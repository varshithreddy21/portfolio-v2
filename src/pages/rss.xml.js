import rss from "@astrojs/rss";
import { getEntry, getCollection } from "astro:content";

export async function GET(context) {
  const profile = (await getEntry("profile", "profile")).data;
  const posts = (await getCollection("blog"))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime());

  return rss({
    title: `${profile.name}'s Blog`,
    description: profile.about,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.publishDate,
      description: post.data.description,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: `<language>en-us</language>`,
  });
}
