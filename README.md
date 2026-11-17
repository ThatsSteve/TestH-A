# H&A Associati — website redesign

Static portfolio site for H&A Associati (Venice, Rome, Shanghai). Content, projects and images come from the current site, hastudio.it.

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
python -m http.server 5173
```

Then open http://localhost:5173. The URLs are the same as on the current site: `/projects/<slug>/`, `/area/<area>/`, `/the-firm/`, `/people/`.

### GitHub Pages (sub-folder)

The pages in this repository are built for GitHub Pages, where the site lives at `https://thatssteve.github.io/TestH-A/`:

```bash
node build.js --base=TestH-A
```

For the final domain (site at the root), build without `--base`.

## Notes

- Images are loaded from `www.hastudio.it/wp-content/uploads/` with their WordPress-generated sizes (`srcset`). They are never shown larger than their native 1200 px.
- Map tiles come from OpenFreeMap. Markers sit at the city given in each project's Location field, not at the exact site.
- No cookie banner yet. The current site uses iubenda.
