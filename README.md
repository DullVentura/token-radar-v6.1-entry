# Token Radar v6.1

Hybrid multi-file token launch radar for make.fun competition `token-radar-01`.

- **Ranking:** point-estimate v5 — implied = valueIfLaunches × P(launch | age, category).
- **Intervals & verdicts:** model v6 — Ridge log-linear ln(FDV/TVL), λ=10, P calibrated by Empirical Bayes Beta-Binomial, P10–P90 from LOO residual quantiles per category.
- **Dashboard:** multi-file (`dashboard/index.html` 9.380 byte + `styles.css` + `app.js` = 45.177 byte ≤ 65.536 dossier cap), `data.json` at output root, detail view with farm plans (6 steps × 198 rows), backtest SVG, integrity strip.
- **Numbers (replicated live from the sealed snapshot every run):** pool v6 $1.114.005.922, pool v5 $1.273.129.188, verdicts v6 61/45/92, v5 63/52/83, range holds 66/92 = 71,7%, LOO median v6 ×3,44 / v5 ×3,29, Top-20 v6 15/20 / v5 17/20, watchlist 40/40.

Run: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json`
