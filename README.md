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

`/studio-upload/` is a private page for the people who upload projects. It is not linked anywhere and is kept out of search engines; publishing needs a GitHub key with write access to this repository, so the page alone gives no access.

How it works:

1. The person signs in with their GitHub key, then adds, changes, duplicates or removes a project (title, areas, facts, description, map position, photos; the first photo is the cover).
2. "Pubblica" sends one commit to `content/inbox/`: a JSON request plus the photos, resized in the browser (at most 3000 px, JPEG, location data removed).
3. The workflow `.github/workflows/publish.yml` runs `tools/publish-inbox.js` (converts the photos to WebP in five sizes, updates `assets/js/data.js`, deletes photos no project uses any more, empties the inbox), then `node build.js`, and commits the result. That commit redeploys Netlify and GitHub Pages; the site is updated in 2–4 minutes.

New projects get `"added"` with the date and appear first among the latest projects on the home page (the eight most recent are shown).

Giving someone access:

1. Add their GitHub account as a collaborator with write access (repository Settings › Collaborators).
2. They create a key at github.com › Settings › Developer settings › Personal access tokens. A fine-grained key limited to this repository, with Contents "Read and write" (and Actions "Read-only" to see the publishing status), works when the repository belongs to them or to an organization they are in. For a repository owned by someone else's personal account, GitHub only allows a classic key with the `public_repo` scope; moving the repository to a studio organization avoids that.
3. Send them the address `…/studio-upload/`. The help on the sign-in page explains the rest.

The key stays in that browser only (session storage, or local storage if "Ricordami" is ticked, under `ha-dash`) and is sent only to api.github.com.

For Aruba, add a final step to the workflow that uploads the site by FTP/SFTP, with the server, user and password saved as repository secrets.

## Adding a project by hand

1. Put the images in `assets/img/projects/<slug>/` as WebP: the full image (at most 2200 px wide) plus smaller copies named `<name>-<width>x<height>.webp` (480, 800, 1200 and 1600 px wide, only those smaller than the full image).
2. Add the project to `projects` in `assets/js/data.js`: `slug`, `title`, `order` (1 to 3 marks the featured projects used by the "Featured" sort, 4 otherwise), `added` (date added, `YYYY-MM` or `YYYY-MM-DD`: the eight most recent appear on the home page), `areas` (ids from `areas`), `facts` (`Location`, `Client`, `Tipology`, `Size`, `Status`, `Credits`; leave out what is not known), `desc` (one string per paragraph, the first one is the lead), `gallery`, `cover` and `geo` (`[latitude, longitude]` of the city). Each image is `{ "src": "/assets/img/projects/<slug>/<name>.webp", "w": …, "h": …, "v": ["-480x…", "-800x…"] }`.
3. Run `node build.js`.

The position in the `projects` list is the order used in the project lists.

## Notes

- Images of the projects carried over from hastudio.it are loaded from `www.hastudio.it/wp-content/uploads/` with their WordPress-generated sizes (`srcset`) and are never shown larger than their native 1200 px. Newer images are stored in `assets/img/projects/`.
- Map tiles come from OpenFreeMap. Markers sit at the city given in each project's Location field, not at the exact site.
- Privacy (iubenda): the site sets no cookies and has no analytics, social widgets or embedded videos. It only keeps three technical values in the browser's session storage (`ha-intro`, `ha-view`, `ha-sort`: whether the intro was seen, the chosen view and sort order), deleted when the browser closes. Third parties contacted when a page loads: cdnjs.cloudflare.com (GSAP), unpkg.com (Lenis, MapLibre), tiles.openfreemap.org (map tiles, only where a map is shown) and www.hastudio.it (images). Declare them in the iubenda privacy policy, or host the libraries in `assets/` so only the map tiles remain. To add the iubenda banner, paste its embed code into `iubenda.html` at the root and run `node build.js`.
