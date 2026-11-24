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

`404.html` is self-contained. If the site is published in another sub-folder, add it to `SUBFOLDERS` in `build.js` so the "Back to home" link points to the right place.

## Adding a project

1. Put the images in `assets/img/projects/<slug>/` as WebP: the full image (at most 2200 px wide) plus smaller copies named `<name>-<width>x<height>.webp` (480, 800, 1200 and 1600 px wide, only those smaller than the full image).
2. Add the project to `projects` in `assets/js/data.js`: `slug`, `title`, `order` (1 to 3 puts it among the featured projects on the home page, 4 otherwise), `areas` (ids from `areas`), `facts` (`Location`, `Client`, `Tipology`, `Size`, `Status`, `Credits`; leave out what is not known), `desc` (one string per paragraph, the first one is the lead), `gallery`, `cover` and `geo` (`[latitude, longitude]` of the city). Each image is `{ "src": "/assets/img/projects/<slug>/<name>.webp", "w": …, "h": …, "v": ["-480x…", "-800x…"] }`.
3. Run `node build.js`.

The position in the `projects` list is the order used on the home page and in the project lists.

## Notes

- Images of the projects carried over from hastudio.it are loaded from `www.hastudio.it/wp-content/uploads/` with their WordPress-generated sizes (`srcset`) and are never shown larger than their native 1200 px. Newer images are stored in `assets/img/projects/`.
- Map tiles come from OpenFreeMap. Markers sit at the city given in each project's Location field, not at the exact site.
- No cookie banner yet. The current site uses iubenda.
