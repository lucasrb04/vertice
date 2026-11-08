# Ranking extensions for PostgreSQL vs built-in ts_rank (RUM, ParadeDB pg_search, VectorChord-BM25, Tiger Data pg_textsearch) for a tiny self-hosted Brazilian-Portuguese catalog

(Research date: 2026-11-02. Version claims are as seen in sources fetched on this date; many pages did not show release dates.)

## 1. What does each add over ts_rank? Portuguese stemming and fuzzy matching?

### Takeaway
All BM25 options add IDF, term-frequency saturation and length normalisation, which ts_rank lacks. Portuguese stemming: ParadeDB (Snowball `stemmer=portuguese`) and pg_textsearch (via any installed PG text search config, so `portuguese` should work, unverified) are viable; VectorChord-BM25 is only tested on English. Fuzzy: only ParadeDB has it natively (edit distance up to 2); pg_textsearch explicitly has none (use pg_trgm). RUM adds positional/index-side ranking, not BM25.

### Cited Findings
- ts_rank lacks inverse document frequency, term-frequency saturation and document-length normalisation, and has no efficient top-k path (must score every matching row) — [Tiger Data blog](https://tigerdata.com/blog/pg-textsearch-bm25-full-text-search-postgres) (vendor of a competing extension; no quantitative ts_rank benchmarks given)
- ts_rank = term frequency only; ts_rank_cd adds proximity; neither has saturation or length normalisation against the corpus average; author's view that built-in may be "somewhat worse" is tentative, and built-in "may still be adequate" when simplicity matters — [Evan Schwartz](https://emschwartz.me/comparing-full-text-search-algorithms-bm25-tf-idf-and-postgres/)
- Postgres handles unimportant words via stopword dictionaries rather than collection-wide statistics — [summary of same source via search](https://emschwartz.me/comparing-full-text-search-algorithms-bm25-tf-idf-and-postgres/)
- ParadeDB pg_search: BM25 full-text, faceted and hybrid search, built on Tantivy (Rust) via pgrx — [PGXN pg_search 0.18.0](https://pgxn.org/dist/pg_search/0.18.0)
- ParadeDB stemming: append stemmer option to tokenizer, e.g. `pdb.simple('stemmer=portuguese')`; Portuguese is in the supported list (arabic, czech, danish, dutch, english, finnish, french, german, greek, hungarian, italian, norwegian, polish, portuguese, romanian, russian, spanish, swedish, tamil, turkish); Snowball-based — [ParadeDB stemming docs](https://www.paradedb.com/docs/documentation/token-filters/stemming.md) (found via search snippet; page not read in full)
- ParadeDB fuzzy: `'runing shose'::pdb.fuzzy(2)` on match (`|||`, `&&&`) and term (`===`) queries; max edit distance 2; supports transpositions, fuzzy prefix; poor for CJK — [pg_search 0.25.3 fuzzy docs](https://api.pgxn.org/src/pg_search/pg_search-0.25.3/docs/documentation/full-text/fuzzy.mdx). Highlighting unsupported when fuzzy distance > 0 (legacy docs) — [pg_search 0.20.1 match docs](https://api.pgxn.org/src/pg_search/pg_search-0.20.1/docs/legacy/advanced/full-text/match.mdx)
- pg_textsearch: each index takes a `text_config` (PostgreSQL text search configuration); examples use english, german, french; Portuguese not mentioned in README but design implies any installed config works. Queries must use the same config — [pg_textsearch GitHub](https://github.com/timescale/pg_textsearch)
- pg_textsearch 1.0 limitations: no phrase queries (positions not stored), OR-only semantics at 1.0, no highlighting (use ts_headline), no expression indexing, single column per index, no fuzzy/typo tolerance (suggests pg_trgm) — [Tiger Data blog](https://tigerdata.com/blog/pg-textsearch-bm25-full-text-search-postgres). README for v1.5.1 lists boolean tsquery filtering with `&`, `|`, `!`, phrase and prefix `:*` as filters, so some 1.0 limits may have since been lifted — [GitHub](https://github.com/timescale/pg_textsearch)
- VectorChord-BM25: tokenization via separate pg_tokenizer.rs; pre-trained models (`bert` English), custom models trained on corpus, Jieba (Chinese), Lindera (Japanese); "only English has been tested"; results capped by `bm25_catalog.bm25_limit` (default 100) — [VectorChord-bm25 GitHub](https://github.com/tensorchord/VectorChord-bm25) (redirects to supervc-stack org)
- VectorChord blog 0.2 mentions LLM-based multilingual tokenizers (Gemma2, LLMLingua2) — [VectorChord blog](https://blog.vectorchord.ai/vectorchord-bm25-introducing-pgtokenizera-standalone-multilingual-tokenizer-for-advanced-search); preloaded models use ~100MB (gemma2b) to ~200MB (llmlingua2) RAM — [GitHub](https://github.com/tensorchord/VectorChord-bm25)
- RUM: GIN-like index storing positions/extra info in posting tree; faster ranking (no heap fetch for positions), faster phrase search, ordering by timestamp; `<=>` operator. TF/IDF listed as TODO (not implemented), so it is NOT BM25 — [postgrespro/rum](https://github.com/postgrespro/rum)

### Inferences
- For Portuguese, the practical path to stemming without any extension is the built-in `portuguese` Snowball config + `unaccent`; BM25 extensions add ranking quality only, except ParadeDB which also adds fuzzy.
- Only ParadeDB gives native typo tolerance; with other options, pg_trgm (already in the project's stack per CLAUDE.md) covers fuzzy.
- RUM is a poor fit: no IDF, so it doesn't fix the ranking weakness that motivates BM25.

### Gaps
- No independent test of Portuguese quality for any extension; ParadeDB's Portuguese stemmer rules/behaviour not documented in what I found.
- Whether pg_textsearch actually works with the `portuguese` config not confirmed in docs (inference).
- VectorChord-BM25 latest tokenizer language list not verified upstream.

## 2. Licensing, PG16 support, maturity (2026), Docker, ARM, memory, upgrade burden

### Takeaway
Licensing: RUM and pg_textsearch are permissive (PostgreSQL-style); ParadeDB community is AGPLv3 (commercial for enterprise); VectorChord-BM25 is AGPLv3 or ELv2. PG16: ParadeDB supports it; RUM supports it; pg_textsearch does NOT (17 and 18 only); VectorChord-BM25 unclear (examples PG17/18). Since the project uses Postgres 16, pg_textsearch would require upgrading to 17+.

### Cited Findings
- pg_textsearch: PostgreSQL License; supports PostgreSQL 17 and 18 (19 best effort); v1.5.1 is the latest on README; prebuilt Linux binaries for amd64 and arm64; requires `shared_preload_libraries` + restart; `memory_limit` default 2GB (approximate budget); no Docker image mentioned — [GitHub](https://github.com/timescale/pg_textsearch); [Tiger Data blog](https://tigerdata.com/blog/pg-textsearch-bm25-full-text-search-postgres)
- pg_textsearch 1.0 GA announced 2026-04-03 (postgresql.org news), preview Oct 2025; blog dated Mar 31, 2026 — [postgresql.org](https://www.postgresql.org/about/news/pg_textsearch-v10-3264); [Tiger Data blog](https://tigerdata.com/blog/pg-textsearch-bm25-full-text-search-postgres). Original open-source release timing reported as late 2025 / early 2026 — [It's FOSS](https://itsfoss.com/news/tiger-data-pg-textsearch/)
- pg_textsearch known limitations include RLS statistics leakage, partition-local stats, no PREPARE TRANSACTION after BM25 index creation, README release note fixes "concurrent spill/merge corruption" in 1.5.1 (indicates young codebase) — [GitHub](https://github.com/timescale/pg_textsearch)
- pg_textsearch benchmarks (vendor, MS-MARCO, PG17): index 17GB vs 23GB for ParadeDB at 138M passages; build slower (17m37s vs 8m55s); 2.3x lower p50 latency; authors state they did not benchmark memory-constrained or write-heavy setups — [Tiger Data blog](https://tigerdata.com/blog/pg-textsearch-bm25-full-text-search-postgres)
- ParadeDB pg_search: AGPLv3 on PGXN for releases 0.16.4 to 0.21.0, plus commercial licence; ParadeDB Enterprise is commercial — [PGXN](https://pgxn.org/dist/pg_search/0.21.0); [ParadeDB GitHub](https://github.com/paradedb/paradedb)
- ParadeDB supports PG 14+ with prebuilt binaries (per PGXN description); Dockerfiles for PG16 exist (postgres:16-trixie base), choose .deb per CPU architecture with both amd64 and arm64 checksums, install v0.25.0 in newest PG16 Dockerfile seen; preload `pg_search` in shared_preload_libraries; image on Docker Hub `paradedb/paradedb` — [Dockerfile.official-16 0.25.1](https://api.pgxn.org/src/pg_search/pg_search-0.25.1/docker/Dockerfile.official-16); [PGXN](https://pgxn.org/dist/pg_search/0.16.4); [GitHub](https://github.com/paradedb/paradedb)
- pg_search version string is still 0.x (0.25.3 seen in PGXN docs), i.e. pre-1.0 versioning with frequent releases — [PGXN docs 0.25.3](https://api.pgxn.org/src/pg_search/pg_search-0.25.3/docs/documentation/full-text/fuzzy.mdx)
- VectorChord-BM25: dual AGPLv3 / Elastic License v2; Docker `tensorchord/vchord-suite` tags `pg18-latest`, `pg17-20250414`; no ARM mention; Releases empty; 92 commits, 381 stars, 4 open issues — [GitHub](https://github.com/tensorchord/VectorChord-bm25). Pigsty lists vchord_bm25 0.3.0 AGPL-3.0, pg_tokenizer 0.1.1 Apache-2.0 — [Pigsty](https://pigsty.io/ext/e/vchord_bm25/)
- RUM: "license similar to PostgreSQL"; PG 12+; 608 commits; slower build and insert than GIN due to extra info and generic WAL — [postgrespro/rum](https://github.com/postgrespro/rum). Packaged for PG16/17 (v1.3.14/1.3.15) in PGDG and Alpine has aarch64 package — [Pigsty RUM](https://pigsty.io/ext/e/rum/); [Alpine aarch64](https://pkgs.alpinelinux.org/package/v3.17/community/aarch64/postgresql-rum)

### Inferences
- AGPL for ParadeDB/VectorChord matters mainly if you modify and offer the extension as a network service; using it unmodified as a DB component of a university app is probably low-risk, but legal interpretation is not verified here.
- Any extension means a custom Docker image (not stock `postgres:16`) and a rebuild/upgrade step per extension release and per PG major; ParadeDB's pre-1.0 versions and pg_textsearch's recent corruption fixes imply nontrivial upgrade/churn risk for a solo developer. Memory use at a few thousand docs should be negligible for all (sources only give large-scale numbers).
- ARM: ParadeDB and pg_textsearch have arm64 artifacts; VectorChord-BM25 ARM unconfirmed.

### Gaps
- Official ParadeDB install/versions page and a clear maturity statement not retrieved (docs URLs 404/not stated).
- Memory footprint for ParadeDB/small corpora not found.
- Current release dates for pg_search, VectorChord-BM25 and RUM not shown on fetched pages.

## 3. At hundreds to a few thousand documents, is BM25 worth it? When is ts_rank good enough?

### Takeaway
I found no independent evidence quantifying relevance gain at this scale. Sources agree ts_rank lacks IDF and top-k efficiency, but the performance case applies to millions of documents; for a few thousand rows scoring all matches is trivial and the main concern is relevance quality, where a vendor-neutral source says built-in may be adequate.

### Cited Findings
- Built-in Postgres search "may still be adequate" for systems already on Postgres where simplicity matters more than ranking quality; author's claim that it is worse than BM25 is tentative/unmeasured — [Evan Schwartz](https://emschwartz.me/comparing-full-text-search-algorithms-bm25-tf-idf-and-postgres/)
- ts_rank's disadvantages (full scoring of all matches, quality degradation as corpus grows) are asserted by BM25 vendors — [Tiger Data blog](https://tigerdata.com/blog/pg-textsearch-bm25-full-text-search-postgres); Lakebase docs (via search summary, not read directly) — [Microsoft Learn](https://learn.microsoft.com/en-za/azure/databricks/oltp/projects/lakebase-text)
- Benchmarks found are at 8.8M to 138M passages, none under 100k docs — [Tiger Data blog](https://tigerdata.com/blog/pg-textsearch-bm25-full-text-search-postgres)

### Inferences
- With hundreds to low thousands of short documents, latency is irrelevant; the real differentiators are IDF (rare-term weighting) and typo tolerance. Cheaper alternatives with no new extension: weighted `setweight` (title A, tags B, body C), `ts_rank_cd` with normalization flag (e.g. 32 or 1/2), `portuguese` + `unaccent` config, and `pg_trgm` similarity for typos/prefix. Optionally a tiny app-level IDF reweight or reciprocal-rank-fusion of tsvector and trigram scores.
- If an extension is wanted anyway, ParadeDB is the only one that is PG16-compatible, has a documented Portuguese stemmer and built-in fuzzy, but is AGPL, pre-1.0 and needs a custom image; pg_textsearch has the best licence but requires PG17+ and lacks fuzzy. Recommendation direction: default to built-in FTS + pg_trgm; BM25 is optional and likely not worth the operational cost at this scale.

### Gaps
- No independent relevance evaluation (e.g. nDCG) of ts_rank vs BM25 on small or Portuguese corpora found.
- Not verified: ts_rank normalization flags behaviour in practice (general PostgreSQL docs, not fetched in this session).
