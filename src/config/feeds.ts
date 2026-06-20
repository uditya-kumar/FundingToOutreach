// Step 1 funding-news sources from task.md. All verified returning 200 + items.
// NOTE: Entrackr and IndiaStartupNews use /rss — their /feed paths 404.
export const FEEDS: Record<string, string> = {
  TechCrunch: "https://techcrunch.com/category/venture/feed/",
  Entrackr: "https://entrackr.com/rss",
  Inc42: "https://inc42.com/feed/",
  YourStory: "https://yourstory.com/feed",
  IndiaStartupNews: "https://indianstartupnews.com/rss",
  ETStartup:
    "https://economictimes.indiatimes.com/small-biz/startups/rssfeeds/11993050.cms",
  LiveMint: "https://www.livemint.com/rss/companies",
  YC: "https://www.ycombinator.com/blog/rss",
};
