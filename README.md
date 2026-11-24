# H&A Associati — website redesign

Static portfolio site for H&A Associati (Venice, Rome, Shanghai). Content, projects and images come from the current site, hastudio.it, plus the projects, texts and images supplied by the studio in November 2026.

## Structure

- `assets/js/data.js`: projects, people, firm texts and contacts (extracted from hastudio.it)
- `assets/js/views.js`: page templates (shared by the browser and the build)
- `assets/js/app.js`: navigation, page transitions and animations
- `assets/js/map.js`: project maps (MapLibre + OpenFreeMap, city-level positions)
- `assets/js/hero-gl.js`: home slideshow transition (WebGL, with image fallback)
- `assets/css/style.css`: styles; Rubik is self-hosted in `assets/fonts/`
- `build.js`: generates one static HTML page per URL, plus `sitemap.xml` and `robots.txt`

## Build and preview

```bash
node build.js
py -m http.server 5173
```

Then open http://localhost:5173. The URLs are the same as on the current site: `/projects/<slug>/`, `/area/<area>/`, `/the-firm/`, `/people/`.

### Hosting

All links and assets are relative, so the same files work anywhere without rebuilding:

- **Netlify**: publish directory `.` with no build command (already set in `netlify.toml`).
- **GitHub Pages**: branch `main`, folder `/ (root)`, at `https://thatssteve.github.io/TestH-A/`.
- **Final domain**: upload the folder as is.

- **Aruba (Apache)**: upload the whole folder to the web root. `.htaccess` sets the 404 page, compression and caching. The images of the projects carried over from the old site are still loaded from `www.hastudio.it/wp-content/uploads/`: when WordPress is removed, keep the `wp-content/uploads/` folder on the server (PHP is not needed), or those images stop showing.

`404.html` is self-contained. If the site is published in another sub-folder, add it to `SUBFOLDERS` in `build.js` so the "Back to home" link points to the right place.

## Studio dashboard (adding projects without code)

`/studio-upload/` is a private page for the people who upload projects. It is not linked anywhere and is kept out of search engines. While the site is a test, it opens and publishes without any sign-in: anyone who knows the address can add or remove projects. Before the real launch, set `STUDIO_CODE` (below) or put the page behind a login.

How it works:

1. The person writes the name, drops photos and videos, says where the project is, ticks the areas and, if known, the details and the description. Any photo works (JPG, PNG, WebP, AVIF, GIF, HEIC from iPhones, TIFF) and any common video (MP4, MOV, WebM…). In the browser, photos are turned the right way, scaled to at most 2400 px and saved as WebP (JPEG in browsers that cannot write WebP), with location data removed; photos the browser cannot read and videos are sent as they are.
2. "Pubblica il progetto" sends everything, in pieces of 3.5 MB, through the Netlify Function `netlify/functions/studio.mjs`, which writes it to `content/inbox/` in one commit. The function holds the GitHub key; it can only add files under `content/inbox/`.
3. The workflow `.github/workflows/publish.yml` runs `tools/publish-inbox.js`: photos become WebP in five sizes (HEIC through libheif), videos become H.264 MP4 at most 1920 px wide with a still frame as poster, `assets/js/data.js` is updated, files no project uses any more are deleted, the inbox is emptied. A file that cannot be read is left out and named in the commit message; the rest is published. Then `node build.js` runs and the result is committed. That commit redeploys Netlify and GitHub Pages; the site is updated in a few minutes, and the dashboard says when.

Limits: 250 MB per video and 80 MB per photo as sent; GitHub accepts about 80 new files a minute, so the dashboard sends one piece a second (a 250 MB video takes about two minutes to send).

New projects get `"added"` with the date and appear first among the latest projects on the home page (the eight most recent are shown). Videos play in the project gallery; the cover is the first photo, or the first video's still frame.

### Turning publishing on (once)

1. Create a GitHub key that can write to this repository: github.com › Settings › Developer settings › Personal access tokens. If the repository is yours: *Fine-grained tokens*, only this repository, *Contents* "Read and write" and *Actions* "Read-only". Otherwise, a classic key with the `public_repo` scope.
2. On Netlify: Site configuration › Environment variables › Add a variable: key `GITHUB_TOKEN`, value the key. Optional: `STUDIO_CODE` with a password (the dashboard does not ask for one yet, so set it only together with that change).
3. Deploys › Trigger deploy › Deploy site, so the function sees the variable.

Until the key is set, "Pubblica" downloads one file `<time>-<slug>.json` with everything inside; uploading it to `content/inbox/` on github.com (Add file › Upload files › Commit changes, files up to 25 MB) publishes it the same way.

The copy on GitHub Pages uses the Netlify function too. For Aruba, the dashboard keeps using the Netlify function; add a final step to the workflow that uploads the site by FTP/SFTP, with the server, user and password saved as repository secrets.

## Adding a project by hand

1. Put the images in `assets/img/projects/<slug>/` as WebP: the full image (at most 2200 px wide) plus smaller copies named `<name>-<width>x<height>.webp` (480, 800, 1200 and 1600 px wide, only those smaller than the full image).
2. Add the project to `projects` in `assets/js/data.js`: `slug`, `title`, `order` (1 to 3 marks the featured projects used by the "Featured" sort, 4 otherwise), `added` (date added, `YYYY-MM` or `YYYY-MM-DD`: the eight most recent appear on the home page), `areas` (ids from `areas`), `facts` (`Location`, `Client`, `Tipology`, `Size`, `Status`, `Credits`; leave out what is not known), `desc` (one string per paragraph, the first one is the lead), `gallery`, `cover` and `geo` (`[latitude, longitude]` of the city). Each image is `{ "src": "/assets/img/projects/<slug>/<name>.webp", "w": …, "h": …, "v": ["-480x…", "-800x…"] }`.
3. Run `node build.js`.

The position in the `projects` list is the order used in the project lists.

## Notes

- Images of the projects carried over from hastudio.it are loaded from `www.hastudio.it/wp-content/uploads/` with their WordPress-generated sizes (`srcset`) and are never shown larger than their native 1200 px. Newer images are stored in `assets/img/projects/`.
- Map tiles come from OpenFreeMap. Markers sit at the city given in each project's Location field, not at the exact site.
- Privacy (iubenda): the site sets no cookies and has no analytics, social widgets or embedded videos. It only keeps three technical values in the browser's session storage (`ha-intro`, `ha-view`, `ha-sort`: whether the intro was seen, the chosen view and sort order), deleted when the browser closes. Third parties contacted when a page loads: cdnjs.cloudflare.com (GSAP), unpkg.com (Lenis, MapLibre), tiles.openfreemap.org (map tiles, only where a map is shown) and www.hastudio.it (images). Declare them in the iubenda privacy policy, or host the libraries in `assets/` so only the map tiles remain. To add the iubenda banner, paste its embed code into `iubenda.html` at the root and run `node build.js`.
