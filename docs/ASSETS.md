# Asset sources and licenses

## Photographs

All photographs come from Wikimedia Commons. Licenses and authors were read from each file's
Commons metadata (`extmetadata`) on 2026-10-06. Files were resized and re-encoded; the hero image
was cropped to a landscape band. Under the share-alike licenses, these modified versions are shared
under the same license.

| File in repo | Used for | Author | License | Source |
|---|---|---|---|---|
| `frontend/src/assets/photos/hero-tomato.jpg` | Upload card background (cropped) | 4028mdk09 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Harzfeuer F1 Solanum lycopersicum 2011](https://commons.wikimedia.org/wiki/File:Harzfeuer_F1_Solanum_lycopersicum_2011.JPG) |
| `frontend/src/assets/photos/auth-basil.jpg` | Sign-in page | Forest and Kim Starr | [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/deed.en) | [Starr-080731-9594 Ocimum basilicum](https://commons.wikimedia.org/wiki/File:Starr-080731-9594-Ocimum_basilicum-leaves-makawao-Maui_(24898439426).jpg) |
| `backend/app/content/example_photos/example-tomato-cover.jpg` | Example garden | Forest and Kim Starr | [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/deed.en) | [Starr-081031-0358 Solanum lycopersicum](https://commons.wikimedia.org/wiki/File:Starr-081031-0358-Solanum_lycopersicum-fruit_with_raindrops-Makawao-Maui_(24926602265).jpg) |
| `.../example-tomato-leaf-1.jpg` | Example garden; e2e fixture (downsized) | MerielGJones | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Septoria leaf spot symptoms on tomato leaf](https://commons.wikimedia.org/wiki/File:Septoria_leaf_spot_symptoms_on_tomato_leaf_(Septoria_lycopersici_on_Solanum_lycopersicum_leaf).jpg) |
| `.../example-tomato-leaf-2.jpg` | Example garden | Dr Parthasarathy Seethapathy, Tamil Nadu Agricultural University, Bugwood.org | [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/deed.en) | [Septoria lycopersici leaf spot on tomato leaf](https://commons.wikimedia.org/wiki/File:Septoria_lycopersici_malagutii_leaf_spot_on_tomato_leaf.jpg) |
| `.../example-basil-cover.jpg` | Example garden | Forest and Kim Starr | [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/deed.en) | [Starr-090519-8066 Ocimum basilicum](https://commons.wikimedia.org/wiki/File:Starr-090519-8066-Ocimum_basilicum-leaves-Native_Nursery_Kula-Maui_(24588096799).jpg) |
| `.../example-basil-1.jpg` | Example garden | Forest and Kim Starr | [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/deed.en) | [Starr-080731-9592 Ocimum basilicum](https://commons.wikimedia.org/wiki/File:Starr-080731-9592-Ocimum_basilicum-leaves-makawao-Maui_(24898434276).jpg) |
| `.../example-basil-2.jpg` | Example garden | Forest and Kim Starr | [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/deed.en) | [Starr-080731-9593 Ocimum basilicum](https://commons.wikimedia.org/wiki/File:Starr-080731-9593-Ocimum_basilicum-leaves-makawao-Maui_(24557099149).jpg) |
| `.../example-monstera-cover.jpg` | Example garden | Princesleaf | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [HK SW Leaves with holes](https://commons.wikimedia.org/wiki/File:HK_SW_Leaves_with_holes.JPG) |
| `.../example-monstera-1.jpg` | Example garden | Mokkie | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Fruit Salad Plant (Monstera deliciosa)](https://commons.wikimedia.org/wiki/File:Fruit_Salad_Plant_(Monstera_deliciosa).jpg) |
| `.../example-monstera-2.jpg` | Example garden | AlbeitPK | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Monstera Deliciosa at Cox’s Bazar](https://commons.wikimedia.org/wiki/File:Monstera_Deliciosa_at_Cox%E2%80%99s_Bazar.jpg) |

The example garden is honest about what these photos are: within one example plant, the two
journal photos show different leaves from different photographers, not one plant over time. Example
entries never include analyses.

The reference presentation image supplied with the brief was used only as a visual reference. No part
of it is used as an asset.

## Fonts (bundled locally through Fontsource, SIL Open Font License 1.1)

- **Newsreader** (headings, wordmark), © The Newsreader Project Authors, `@fontsource-variable/newsreader`
- **Source Sans 3** (interface), © Adobe, `@fontsource-variable/source-sans-3`

## Original artwork (this project)

- Logo symbol, full logo, favicon: `frontend/src/assets/brand/*.svg` (editable sources). The full logo's
  wordmark is Newsreader converted to outlines with fontTools. PNG app icons in
  `frontend/public/icons/` are rendered from these SVGs by `npm run icons`.
- Botanical illustrations (`frontend/src/components/Botanical.tsx`) and the line icon set
  (`frontend/src/components/Icon.tsx`) were drawn for this project.

## Care guide content

Summaries in `backend/app/content/care_guide.py` paraphrase extension-service publications
(Clemson HGIC, NC State Extension, UF/IFAS EDIS, UC IPM). Each article links its sources, with the
date each source states and the date the summary was last checked.
