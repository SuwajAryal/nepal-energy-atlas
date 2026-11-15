# Nepal Energy Atlas

Nepal Energy Atlas is an interactive terrain map of energy projects and a dashboard for Nepal’s electricity generation, imports, and exports. Project details and national figures link to their original sources.

- [Hosted preview](https://nepal-hydro-atlas.mixedwand.chatgpt.site/) · owner access
- [Report a data correction or propose an improvement](https://github.com/SuwajAryal/nepal-energy-atlas/issues)

## Run locally

Open [dist/index.html](dist/index.html) in a browser, or serve the static files from the repository root.

```sh
python -m http.server 8765 --directory dist
```

Open [localhost:8765](http://localhost:8765). The map, fonts, and data snapshots are included. Google Maps links open the national terrain view or an approximate project location.

## Project records

[Hydropower data](dist/projects.js) contains the 15 November 2026 snapshot for plants and construction licences over 1 MW. [Other energy projects](dist/other-projects.js) covers solar, bagasse cogeneration, and selected wind–solar and thermal records. A map marker uses the midpoint of the coordinate range provided by the source. Records without usable coordinates appear in the directory. Construction licence status reflects the regulator’s record. Where available, Investment Board Nepal's reported construction stage is cited separately.

- [DoED · Operating hydropower plants over 1 MW](https://doed.gov.np/pages/powerplantsmorethan1/)
- [DoED · Hydropower construction licences over 1 MW](https://doed.gov.np/pages/clhydromorethan1/)
- [DoED · Solar power plants](https://doed.gov.np/pages/powerplantssolar/) and [solar construction licences](https://doed.gov.np/pages/clsolar/)
- [DoED · Cogeneration plants](https://doed.gov.np/pages/powerplantscogeneration/)
- [AEPC · Wind energy and hybrid projects](https://www.aepc.gov.np/pages/wind-energy) and [ADB · Chisapani wind–solar project](https://www.adb.org/news/nepals-largest-wind-solar-hybrid-power-system-switched-connect-small-village-world)
- [Investment Board Nepal · Project status summary (PDF)](https://giwmscdnone.gov.np/media/pdf_upload/%E0%A4%AA%E0%A4%B0%E0%A4%BF%E0%A4%AF%E0%A5%8B%E0%A4%9C%E0%A4%A8%E0%A4%BE%E0%A4%B9%E0%A4%B0%E0%A5%81%E0%A4%95%E0%A5%8B%20%E0%A4%B5%E0%A4%BF%E0%A4%B5%E0%A4%B0%E0%A4%A3%20pdf_24mtewu.pdf)

## National energy figures

[National dashboard data](dist/energy.js) covers annual electricity generation, monthly dispatch balance, cross-border trade, and installed capacity. The annual and monthly figures use separate Nepal Electricity Authority reporting tables. Seasonal figures group complete Nepali reporting months by their Gregorian start month. The wider national energy balance is reported in petajoules.

- [Nepal Electricity Authority · Annual report FY 2025/26](https://www.nea.org.np/en/detail/annual-report-20252026)
- [Department of Hydrology and Meteorology · Seasonal weather definitions](https://dhm.gov.np/uploads/dhm/climateService/1777360855_cde386661a4216e39437.pdf)
- [Water and Energy Commission Secretariat · Energy Sector Synopsis Report, FY 2022/23 (PDF)](https://wecs.gov.np/source/ESR_2024.pdf)

## Map and asset credits

[The terrain script](scripts/build-terrain.py) regenerates the relief image and country geometry. It requires Python, NumPy, Pillow, curl, and internet access. Run `python scripts/build-terrain.py` from the repository root.

- [Mapzen Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/) supplies elevation data.
- [geoBoundaries / Open Data Nepal · Nepal ADM0](https://www.geoboundaries.org/api/current/gbOpen/NPL/ADM0/) supplies the 2019 boundary geometry, simplified and styled under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- The bundled fonts include their own license files for [DM Sans](dist/dm-sans-OFL.txt) and [Instrument Serif](dist/instrument-serif-OFL.txt).
