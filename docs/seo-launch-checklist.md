# diogofit.com: SEO launch checklist

Last updated: October 12, 2026. Companion to the SEO expansion branch. Work through it top to bottom; the first three steps are the ones that actually get the site into Google.

## 0. What the expansion branch changed

- **Opened the site to search engines.** `robots.txt` was `Disallow: /` and every page carried `noindex, nofollow`. Both are now index/follow (the 404 page stays noindex). Until this is merged to `main`, Google cannot see the site at all.
- **Added `sitemap.xml`** (22 URLs, with image entries and the "My story" video) and an RSS feed at `/learn/feed.xml`.
- **Upgraded structured data on every page:** `WebSite`, `Organization`, `Person` (full name Diogo Camera, Brazil, South Florida, St. Thomas University, languages), `Service` (worldwide), `WebPage`/`CollectionPage`/`ProfilePage` per URL, `Article` with word count, reading time, keywords and 16:9 / 4:3 / 1:1 images, `BreadcrumbList` with stable ids.
- **Branded-search signals.** "Diogo Camera" now appears in the home and about titles, in visible copy, and in `alternateName` values ("Diogo Fit", "DiogoFit").
- **Worldwide reach.** Footer, coaching page, `Service.areaServed`, a new FAQ ("Do you coach people outside South Florida, or outside the US?"), `hreflang` + `x-default`, `og:locale`.
- **Five new sourced articles** in `/learn/`: what online fitness coaching is, how to choose an online coach, body recomposition, how long results take, progressive overload. The learn hub, footer and related-reads were re-linked so every new page has inbound links from day one.
- **Web app manifest** got a description, language, categories and a PNG icon.

## 1. Merge and confirm the site is open (day 1, 10 minutes)

1. Merge the branch into `main`. GitHub Pages deploys from `main` automatically.
2. Open `https://diogofit.com/robots.txt` and confirm it starts with `Allow: /` and ends with the `Sitemap:` line.
3. View source on the home page and confirm the robots meta reads `index, follow, …`.
4. In the GitHub repo: Settings → Pages → tick **Enforce HTTPS** if it isn't already.
5. At the domain registrar, make sure `www.diogofit.com` has a CNAME to `claytoncamera.github.io` so the www version redirects to the apex domain instead of failing.

## 2. Google Search Console (day 1, 20 minutes)

1. Go to search.google.com/search-console and add a **Domain** property for `diogofit.com`.
2. Verify with the DNS TXT record Google gives you (add it at the registrar). This covers http/https and www/non-www in one property.
   - If DNS is awkward, use a URL-prefix property for `https://diogofit.com/` instead and verify by uploading the `google….html` file to the repo root. Do not use the meta-tag method unless you add the tag to every page.
3. **Sitemaps → Add** `https://diogofit.com/sitemap.xml`.
4. **URL Inspection → Request indexing** for these, in this order: `/`, `/coaching/`, `/about/`, `/learn/`, `/faq/`, then the five new articles. (Quota is about 10 a day.)
5. After a week, check **Pages** for "Discovered, currently not indexed" and request indexing on anything stuck.
6. After 2 to 4 weeks, check **Performance** for the queries. Expect brand queries first ("diogo fitness", "diogo camera coach", "diogofit").

## 3. Bing Webmaster Tools (day 1, 5 minutes)

bing.com/webmasters → **Import from Google Search Console**. This also feeds DuckDuckGo, Yahoo and most AI search assistants that use Bing's index.

## 4. Make the entity consistent everywhere (week 1)

Google builds its idea of "who is Diogo Camera" from matching signals across the web. Use the same name, photo and one-line bio everywhere:

- Instagram bio: name "Diogo Camera", title line "Online fitness coach", link `https://diogofit.com/`.
- Any other profiles (TikTok, YouTube, LinkedIn, Threads, a Trainerize public page): same name and photo, link back to the site. Send me the URLs and I will add them to `sameAs` in the schema so Google ties them together.
- Google Business Profile: only eligible if Diogo meets clients in person somewhere in South Florida. Pure online businesses are not allowed. If he does any in-person sessions, set it up as a service-area business with the address hidden; it is the strongest signal for "fitness coach near me" searches.

## 5. Analytics (week 1)

`assets/js/track.js` already fires events to Plausible or GA4 if either is on the page. Pick one and add its script tag to the head of every page (one line):

- **Plausible** (paid, no cookie banner needed, simplest): `<script defer data-domain="diogofit.com" src="https://plausible.io/js/script.js"></script>`
- **GA4** (free): the standard gtag snippet with your `G-…` ID.

Without one of these you will not see which articles bring in applications.

## 6. Links from other sites (ongoing, the part that moves generic rankings)

Being indexed gets brand queries. Ranking for "online fitness coach" against established sites takes links and time. Realistic sources:

- St. Thomas University: student spotlight, Health Science department page, athletics or wrestling alumni page.
- Local gyms in South Florida: "our members' coaches" or a guest post for their blog.
- Podcasts and YouTube channels about fitness or the Brazilian community in Florida: a guest spot usually includes a link.
- Answer real questions on Reddit (r/fitness, r/loseit, r/Brazil) and Quora, linking to the matching Learn article only when it genuinely answers the question.
- Directories that list online coaches (Trainerize's "find a coach", local Florida business directories).

Avoid buying links or link-exchange schemes; Google penalizes both.

## 7. Content cadence (ongoing)

Two sourced articles a month keeps the site "alive" to Google and builds topical authority. The next ten, in rough priority order of search demand and fit:

1. Beginner full-body workout plan, three days a week
2. How to find your maintenance calories
3. Cutting vs. bulking: which should you do first?
4. How to stop overeating on weekends
5. Creatine: what it does and who it helps
6. How to train with a busy or unpredictable schedule
7. Sleep and fat loss: what the research actually says
8. Meal prep for one person
9. How to track food without losing your mind
10. Does the time of day you work out matter?

Keep the existing format: TOC, short sections, "What to do" lines, real sources with accessed dates, a soft coaching CTA.

## 8. Portuguese version (the biggest "worldwide" lever)

Diogo is Brazilian; Portuguese-language searches for online coaching are large and far less competitive than English ones. A `/pt/` copy of the home, coaching, about and apply pages with `hreflang="pt-BR"` would open Brazil and the Brazilian diaspora. Diogo should write or at least approve the copy so it sounds like him. I can scaffold it when he is ready.

## 9. What to expect

- **Brand queries** ("diogo fitness coach", "diogo camera fitness", "diogofit"): first page within days of indexing, usually #1 within 2 to 6 weeks.
- **Article queries** ("can you lose fat and build muscle at the same time", "how long to see results from working out"): these are competitive; expect impressions within a month and real clicks over 3 to 6 months as links accumulate.
- **Generic "fitness coach" / "online fitness coach"**: a years-long play for any new site. The route is the articles plus links, not the home page.

## 10. Claims added in this branch that Diogo should confirm

- Schema says he speaks English and Portuguese (`knowsLanguage`, `availableLanguage`).
- Footer and coaching page now say "clients anywhere in the world".
- New FAQ answer says the weekly call is scheduled around the client's time zone.

If any of these are wrong, tell me and I will remove them.

## 11. Technical note on the build

The repository holds generated HTML ("Deploy preview build …" commits). If there is a separate source project that produces these files, the same changes need to be made there or the next build will overwrite them: robots meta, `robots.txt`, `sitemap.xml`, `learn/feed.xml`, the five new articles and their images, the schema upgrades, the FAQ entries and the copy changes listed in section 0.
