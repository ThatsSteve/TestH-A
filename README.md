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

### Hosting

All links and assets are relative, so the same files work anywhere without rebuilding:

- **Netlify**: publish directory `.` with no build command (already set in `netlify.toml`).
- **GitHub Pages**: branch `main`, folder `/ (root)`, at `https://thatssteve.github.io/TestH-A/`.
- **Final domain**: upload the folder as is.

`404.html` is self-contained. If the site is published in another sub-folder, add it to `SUBFOLDERS` in `build.js` so the "Back to home" link points to the right place.

## Notes

- Images are loaded from `www.hastudio.it/wp-content/uploads/` with their WordPress-generated sizes (`srcset`). They are never shown larger than their native 1200 px.
- Map tiles come from OpenFreeMap. Markers sit at the city given in each project's Location field, not at the exact site.
- No cookie banner yet. The current site uses iubenda.
