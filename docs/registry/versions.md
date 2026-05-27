# Registry — Versões Reservadas (write-hot)

> Reservada na Abertura (§4.0 passo "reservar próximo minor"); consumida no Encerramento (§4.3 passo "finalizar entrada CHANGELOG").

| Versão | Issue | Branch | Data reserva | Status |
|--------|-------|--------|--------------|--------|
| 1.43.1 | #183 | `fix/issue-183-plan-studentid-override` | 24/04/2026 | consumida (PR #186 squash `e46f2051`) |
| 1.44.0 | #119 | `feat/issue-119-maturidade-engine` | 23/04/2026 (reservada como 1.43.0) | consumida como 1.44.0 (PR #192) — bump mecânico após #183 consumir 1.43.1 antes do merge |
| 1.45.0 | #188 | `fix/issue-188-feedback-lock-currency-context` | 24/04/2026 | consumida (PR #195 squash `a7b89c89`) |
| 1.44.1 | #191 | `fix/issue-191-compliance-recente-ciclo` | 24/04/2026 | consumida (PR #194 squash `eb4ff2ec`) |
| 1.46.0 | #189 | `feat/issue-189-emotional-engine-real` | 25/04/2026 | consumida (PR #196) |
| 1.46.1 | #197 | `fix/issue-197-review-meeting-links-post-publish` | 25/04/2026 | consumida (PR #198 squash `af9662b0`) |
| 1.47.0 | #201 | `refactor/issue-201-calculate-plan-mechanics` | 26/04/2026 | consumida (PR #202 squash `f5fbd87e`) |
| 1.48.0 | #187 | `feat/issue-187-mep-men` | 27/04/2026 | cancelada (#187 closed em 30/04 sem consumir; trabalho absorvido por #208/PR #209) |
| 1.49.0 | #208 | `feat/issue-208-execution-behavior-sensor` | 29/04/2026 | consumida (PR #209 squash `adb39591`) |
| 1.49.1 | #210 | `chore/issue-210-remove-takeaways-legacy` | 30/04/2026 | consumida (PR #211 squash `2f7a6a78`) |
| 1.50.0 | #219 | `feat/issue-219-mentor-classification` | 01/05/2026 | consumida (PR #222 squash `03689977`) |
| 1.51.0 | #220 | `feat/issue-220-pendency-guard` | 01/05/2026 | consumida (PR #223 squash `20c8c751`) |
| 1.52.0 | #221 | `feat/issue-221-mentor-clear-violations` | 01/05/2026 | consumida (PR #224 squash `af1aa289`) |
| 1.53.0 | #229 | `feat/issue-229-stop-breakeven-hesitation-detectors` | 01/05/2026 | consumida (PR #230 squash `fa23e496`) |
| 1.54.0 | #235 | `feat/issue-235-cycle-consistency-redesign` | 02/05/2026 | consumida (PR #236 squash `ea8e7bff`) |
| 1.55.0 | #237 | `feat/issue-237-contacts-assinaturas` | 02/05/2026 | consumida (PR #238 squash `1ad8198a`) |
| 1.55.1 | #240 | `fix/issue-240-plan-coverage-and-perf-dedup` | 04/05/2026 | consumida (PR #241 squash `ff43c1d1`) |
| 1.55.2 | #242 | `fix/issue-242-parser-stop-semantic` | 04/05/2026 | consumida (PR #244 squash `34642608`) |
| 1.55.3 | #243 | `feat/issue-243-subscription-followup` | 04/05/2026 | consumida (PR #245 squash `fcef6a87`) |
| 1.55.4 | #246 | `feat/issue-246-followup-segment-filters` | 04/05/2026 | consumida (PR #247 squash `fa573da1`) |
| 1.55.5 | #248 | `feat/issue-248-followup-checkbox-redesign` | 04/05/2026 | consumida (PR #249 squash `d1507a8b`) |
| 1.56.0 | #250 | `feat/issue-250-monthly-payments-summary` | 04/05/2026 | consumida (PR #251 squash `2f263a91`) |
| 1.56.1 | #252 | `feat/issue-252-payments-in-month-expand` | 04/05/2026 | consumida (PR #253 squash `4e2a57fa`) |
| 1.56.2 | #254 | `fix/issue-254-payments-cg-rules` | 04/05/2026 | consumida (PR #255 squash `47e07e21`) |
| 1.56.3 | #256 | `fix/issue-256-filter-counters-intersect` | 05/05/2026 | consumida (PR #257 squash `2f1bfe48`) |
| 1.58.0 | #259 | (RESERVA PULADA) | 07/05/2026 | pulada — main avançou pra 1.63.0 antes do #259 mergear; reserva re-tomada em 1.64.0 |
| 1.61.0 | #263 | `feat/issue-263-students-plan-filter` | 07/05/2026 | consumida (PR #265 squash `c00681c2`) |
| 1.61.1 | #266 | `fix/issue-266-subscription-email-overdue` | 11/05/2026 | consumida (PR #268 squash `5a1e5953`) |
| 1.61.2 | #270 | (sem branch — hotfix direto main) | 12/05/2026 | consumida (commit `63e1ddaf`) — reordem getAccessStatus priorizando firstLoginAt |
| 1.61.3 | #271 | `fix/issue-271-firestore-rules-accessstatus` | 12/05/2026 | consumida (PR #272 squash `4b170a1c`) |
| 1.62.0 | #273 | `feat/issue-273-zero7-prop-firm` | 12/05/2026 | consumida (PR #274 squash `7ff80a38`) |
| 1.63.0 | #278 | `feat/issue-278-undersized-evidence` | 22/05/2026 | consumida (PR #279 squash `29492b4f`) |
| 1.64.0 | #259 | `feat/issue-259-cycle-closure` | 24/05/2026 | consumida (PR #264 squash `a390ecf8`) |
| 1.64.1 | #280 | `fix/issue-280-closure-inbox-no-comment` | 24/05/2026 | consumida (PR #281 squash `5dacb7c6`) |
| 1.67.0 | #267 | `fix/issue-267-tactical-bugs` | 27/05/2026 | consumida (PR #283 squash `fdf75671`) |
| 1.66.0 | #282 | `feat/issue-282-metrics-parity` | 26/05/2026 | consumida (PR #284 squash `45c90a38`) |
