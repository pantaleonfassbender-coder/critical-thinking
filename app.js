/* app.js — router, data and views.

   Unlike the sibling apparatuses, this one carries the text itself: the book is
   openly licensed, so nothing has to be held back and nothing has to be opened
   from the reader's own copy. Search, reading and retrieval all run against
   data/text.json in the browser. */
import { renderDialogue } from "./dialogue.js";

export const D = {};
const view = document.getElementById("view");

export const esc = s => String(s ?? "").replace(/[&<>"']/g, m =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
export const nf = n => new Intl.NumberFormat("en-GB").format(n);
const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const HUE = ["#c9a227", "#9db8a4", "#c07a5a", "#a89bc4", "#7fa9c9", "#c9968f",
             "#8fb3a0", "#b9a06a", "#a0b6c9", "#c4a0b4", "#93a97f", "#c98f6a"];
const partColor = i => HUE[i % HUE.length];
const sachParts = () => (D.parts || []).filter(p => !p.apparat);
const chapOf = n => (D.chapters || []).find(c => String(c.n) === String(n));

/* ------------------------------------------------------------ search */
const STOP = new Set(("the a an and or but of to in on at by for with from as is are was were be " +
  "been being it its this that these those he she they we you your his her their our not no so " +
  "such then than there here which who what when where while if because will would can could may " +
  "do does did have has had more most much many other same very just only even all any both each " +
  "one two three about after before during between through however although thus therefore").split(" "));
const tok = s => (s.toLowerCase().match(/[a-z][a-z'\-]{1,}/g) || []);
let INDEX = null;

function buildIndex() {
  INDEX = new Map();
  for (const c of D.chapters) {
    const t = D.text[String(c.n)];
    if (!t) continue;
    for (const w of new Set(tok(t))) {
      if (w.length < 3) continue;
      let a = INDEX.get(w); if (!a) INDEX.set(w, (a = []));
      a.push(c.n);
    }
  }
}
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function search(q, limit = 240) {
  if (!INDEX) buildIndex();
  const terms = tok(q).filter(t => t.length > 2);
  if (!terms.length) return [];
  let cand = null;
  for (const t of terms) {
    const s = new Set(INDEX.get(t) || []);
    cand = cand === null ? s : new Set([...cand].filter(x => s.has(x)));
    if (!cand.size) break;
  }
  const rx = new RegExp("(" + q.trim().split(/\s+/).map(escRe).join("\\s+") + ")", "gi");
  const out = [];
  for (const n of [...(cand || [])].sort((a, b) => a - b)) {
    const c = chapOf(n);
    const txt = (D.text[String(n)] || "").replace(/\s+/g, " ");
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(txt))) {
      out.push({
        l: txt.slice(Math.max(0, m.index - 60), m.index), k: m[0],
        r: txt.slice(m.index + m[0].length, m.index + m[0].length + 60),
        chap: c,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Passages for the dialogue: paragraph-sized chunks scored by BM25-ish overlap. */
export function retrieve(query, k = 10) {
  const q = tok(query).filter(t => t.length > 2 && !STOP.has(t));
  if (!q.length) return [];
  const scored = [];
  for (const c of D.chapters) {
    if (c.apparat) continue;
    const t = D.text[String(c.n)] || "";
    for (const para of t.split(/\n{2,}/)) {
      const clean = para.replace(/\s+/g, " ").trim();
      if (clean.length < 160) continue;
      const words = tok(clean);
      if (!words.length) continue;
      const set = new Set(words);
      let s = 0;
      for (const w of q) if (set.has(w)) s += 1 + Math.min(2, words.filter(x => x === w).length / 8);
      if (s > 0) scored.push({ chap: c, text: clean.slice(0, 1200), score: +s.toFixed(2) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const perChap = new Map(), out = [];
  for (const s of scored) {
    const used = perChap.get(s.chap.n) || 0;
    if (used >= 2) continue;
    perChap.set(s.chap.n, used + 1);
    out.push(s);
    if (out.length >= k) break;
  }
  return out;
}

/* --------------------------------------------------------------- boot */
async function boot() {
  const names = ["korpus", "parts", "chapters", "text", "terms", "keyness",
                 "glossary", "attributions", "h5p"];
  const res = await Promise.all(names.map(n => fetch(`data/${n}.json`).then(r => r.json())));
  names.forEach((n, i) => D[n] = res[i]);
  window.addEventListener("hashchange", route);
  route();
}

const ROUTES = {
  overview: viewOverview, contents: viewContents, read: viewRead, search: viewSearch,
  glossary: viewGlossary, vocabulary: viewVocabulary, attributions: viewAttributions,
  method: viewMethod, privacy: viewPrivacy, imprint: viewImprint,
  dialogue: a => renderDialogue(view, a),
};
function route() {
  const h = (location.hash || "#/overview").slice(2).split("/");
  const name = (h[0] || "overview").split("?")[0];
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("active", a.dataset.v === name));
  view.innerHTML = ""; window.scrollTo(0, 0);
  (ROUTES[name] || viewOverview)(h.slice(1));
}

export function chapChip(c) {
  if (!c) return "";
  return `<a class="cite" href="#/read/${c.n}" title="${esc(c.teil_titel)}">${esc(c.titel)}${c.seite_von ? `, p. ${c.seite_von}` : ""}</a>`;
}
function partBars(values, { height = 44, labels = false } = {}) {
  const ps = sachParts();
  const max = Math.max(1, ...values);
  return `<div class="volbars" style="--h:${height}px">${values.map((v, i) => `
    <div class="vb" title="${esc(ps[i].titel)} · ${nf(v)}">
      <i style="height:${Math.round(v / max * height)}px;background:${partColor(i)}"></i>
      ${labels ? `<span>${i + 1}</span>` : ""}</div>`).join("")}</div>`;
}

/* ============================================================ OVERVIEW */
function viewOverview() {
  const k = D.korpus;
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Open textbook</span>
      <h1>Critical Thinking in Academic Research</h1>
      <p class="lede">Cindy Gruwell and Robin Ewing's introduction for undergraduates: what critical
      thinking is, what gets in its way, how an argument is built and taken apart, and how the whole of it
      bears on finding, judging and citing sources. Twelve parts, ${nf(k.kapitel)} short chapters, about two
      hundred printed pages.</p></div>

    <div class="statebox ok" style="margin-bottom:1.4rem">
      <strong>This apparatus carries the text itself.</strong> The book is licensed CC BY-SA 4.0, so unlike
      the usual case there is nothing to hold back and nothing for you to supply: read it here, search every
      word of it, and take passages with you. What the licence asks in return is attribution and that
      anything built on it stays as open — which is why every chapter's own attribution is reproduced under
      <a href="#/attributions">Attributions</a>.
    </div>

    <div class="grid g4" style="margin-bottom:1.6rem">
      <div class="kpi"><b>${k.teile}</b><span>parts</span></div>
      <div class="kpi"><b>${nf(k.kapitel)}</b><span>chapters</span></div>
      <div class="kpi"><b>${nf(k.printed_to)}</b><span>printed pages</span></div>
      <div class="kpi"><b>${nf(k.tokens)}</b><span>running words</span></div>
      <div class="kpi"><b>${nf(k.glossar)}</b><span>glossary terms</span></div>
      <div class="kpi"><b>${nf(k.h5p)}</b><span>interactive exercises</span></div>
    </div>

    <div class="grid g2" style="margin-bottom:2rem">
      <div class="card">
        <span class="tag">Read it</span>
        <h3>The whole book</h3>
        <p style="font-size:.92rem;color:var(--fg2)">Every chapter, in order, with printed page numbers
        kept so that a passage can be cited. The ${nf(k.h5p)} interactive exercises cannot be reproduced in
        a static text; each one is linked to where it lives on Pressbooks.</p>
        <p><a class="btn" href="#/contents">Contents →</a></p>
      </div>
      <div class="card">
        <span class="tag">Work with it</span>
        <h3>Search, glossary, dialogue</h3>
        <p style="font-size:.92rem;color:var(--fg2)">Full-text search across all twelve parts with the
        chapter and page on every hit; the book's ${nf(k.glossar)}-term glossary as a list you can filter;
        and a dialogue that answers only from passages it retrieves, with the chapter named.</p>
        <p><a class="btn" href="#/search">Search the text →</a></p>
      </div>
    </div>

    <h2>The twelve parts</h2>
    <div class="grid g3" id="plist" style="margin-bottom:2.2rem"></div>

    <div class="chartbox">
      <span class="tag">Extent by part, in running words</span>
      ${partBars(sachParts().map(p => (D.chapters.filter(c => c.teil === p.n)
        .reduce((s, c) => s + c.tokens, 0))), { height: 74, labels: true })}
      <p class="fine">The weight sits in the middle: sources, their types and how to search for them take up
      more than the conceptual opening on thinking and argument.</p>
    </div>
  </div>`));

  const pl = view.querySelector("#plist");
  sachParts().forEach((p, i) => {
    const chs = D.chapters.filter(c => c.teil === p.n);
    const first = chs[0];
    const card = el(`<div class="workcard" style="border-top:3px solid ${partColor(i)}">
      <h3>${esc(p.titel)}</h3>
      <p class="fine" style="margin:.2rem 0 0">${chs.length} chapters ·
        ${nf(chs.reduce((s, c) => s + c.tokens, 0))} words</p>
    </div>`);
    card.onclick = () => location.hash = first ? `#/read/${first.n}` : "#/contents";
    pl.append(card);
  });
}

/* ============================================================ CONTENTS */
function viewContents() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Contents</span>
      <h1>The book, part by part</h1>
      <p class="lede">${nf(D.chapters.filter(c => !c.apparat).length)} chapters across twelve parts, plus the
      glossary and works cited. Printed page numbers are the book's own.</p></div>
    <div id="toc"></div>
  </div>`));
  const box = view.querySelector("#toc");
  for (const p of D.parts) {
    const chs = D.chapters.filter(c => c.teil === p.n);
    if (!chs.length) continue;
    box.append(el(`<div class="panel">
      <h2>${esc(p.titel)}</h2>
      <ul class="toclist">${chs.map(c => `<li>
        <a href="#/read/${c.n}">${esc(c.titel)}</a>
        <span class="fine">${c.seite_von ? `p. ${c.seite_von}` : ""}${c.h5p ? ` · ${c.h5p} exercise${c.h5p === 1 ? "" : "s"}` : ""}</span>
      </li>`).join("")}</ul></div>`));
  }
}

/** The PDF gives line breaks, not paragraph breaks, and the line length varies
    wildly: a callout box wraps at twenty characters where body text wraps at
    eighty. Any rule keyed to line length therefore misreads one or the other --
    the first attempt treated every short line as a heading and produced a
    hundred fragments. So lines are simply joined, and a paragraph closes at a
    sentence end once enough has accumulated to be worth reading as one. */
function paragraphs(text) {
  const out = [];
  let cur = "";
  for (const raw of text.split("\n")) {
    const ln = raw.trim();
    if (!ln) { if (cur) { out.push(cur); cur = ""; } continue; }
    cur = cur ? cur + " " + ln : ln;
    if (cur.length >= 180 && /[.!?]["')\]]?$/.test(ln)) { out.push(cur); cur = ""; }
  }
  if (cur) out.push(cur);
  return out.filter(p => p.trim());
}


/* ================================================================ READ */
function viewRead(args) {
  const n = args && args[0] ? +args[0] : (D.chapters.find(c => !c.apparat) || {}).n;
  const c = chapOf(n);
  if (!c) { location.hash = "#/contents"; return; }
  const i = D.chapters.indexOf(c);
  const prev = D.chapters[i - 1], next = D.chapters[i + 1];
  const links = D.h5p.filter(h => h.kapitel === c.n);
  const body = paragraphs(D.text[String(c.n)] || "");

  view.append(el(`<div>
    <div class="viewhead"><span class="tag">${esc(c.teil_titel)}</span>
      <h1>${esc(c.titel)}</h1>
      <p class="lede">${c.seite_von ? `Printed pages ${c.seite_von}–${c.seite_bis} · ` : ""}${nf(c.tokens)} words</p></div>

    <div class="reader">${body.map(p =>
      `<p>${esc(p.replace(/\s*\n\s*/g, " ").trim())}</p>`).join("")}</div>

    ${links.length ? `<div class="panel"><h2>Interactive exercises</h2>
      <p class="readable">This chapter contains ${links.length} H5P exercise${links.length === 1 ? "" : "s"}
      that the print version excludes and a static page cannot reproduce. ${links.length === 1 ? "It lives" : "They live"}
      on Pressbooks:</p>
      <ul class="toclist">${links.map((h, j) => `<li>
        <a href="${esc(h.url)}" target="_blank" rel="noopener">Exercise ${j + 1}</a>
        <span class="fine h5plink">minnstate.pressbooks.pub</span></li>`).join("")}</ul>
    </div>` : ""}

    <div class="chapnav">
      ${prev ? `<a href="#/read/${prev.n}">← ${esc(prev.titel)}</a>` : "<span></span>"}
      ${next ? `<a href="#/read/${next.n}" style="text-align:right">${esc(next.titel)} →</a>` : "<span></span>"}
    </div>
  </div>`));
}

/* ============================================================== SEARCH */
function viewSearch() {
  const pre = new URLSearchParams((location.hash.split("?")[1] || "")).get("q") || "";
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Search</span>
      <h1>Every word of the book</h1>
      <p class="lede">Full text, searched in your browser. Each hit names the chapter and the printed page,
      so a passage can be found again in any copy.</p></div>
    <div class="toolbar"><input type="search" id="q" placeholder="A word or phrase…" value="${esc(pre)}" autocomplete="off"></div>
    <div id="dist"></div><div id="out"></div>
  </div>`));
  const q = view.querySelector("#q"), out = view.querySelector("#out"), dist = view.querySelector("#dist");
  const draw = () => {
    const t = q.value.trim();
    if (t.length < 2) { out.innerHTML = ""; dist.innerHTML = ""; return; }
    const hits = search(t);
    const per = {};
    for (const h of hits) per[h.chap.teil] = (per[h.chap.teil] || 0) + 1;
    dist.innerHTML = `<div class="chartbox"><span class="tag">Where the term occurs</span>
      ${partBars(sachParts().map(p => per[p.n] || 0), { height: 52, labels: true })}</div>`;
    out.innerHTML = hits.length
      ? `<p class="fine">${hits.length}${hits.length >= 240 ? " (first 240)" : ""} occurrences</p>
         <table class="kwic"><tbody>${hits.map(h => `<tr>
           <td class="l">${esc(h.l)}</td><td class="k">${esc(h.k)}</td>
           <td class="r">${esc(h.r)}</td><td class="c">${chapChip(h.chap)}</td></tr>`).join("")}</tbody></table>`
      : `<p class="fine">No occurrence.</p>`;
  };
  q.oninput = debounce(draw, 200);
  if (pre) draw();
}

/* ============================================================ GLOSSARY */
function viewGlossary() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Glossary</span>
      <h1>The book's own glossary</h1>
      <p class="lede">${nf(D.glossary.length)} terms as the authors define them. The definitions are theirs,
      reproduced under the licence, not paraphrased here.</p></div>
    <div class="toolbar"><input type="search" id="gq" placeholder="Find a term…" autocomplete="off"></div>
    <div id="gl" class="glosslist"></div><p class="fine" id="gc"></p>
  </div>`));
  const q = view.querySelector("#gq"), list = view.querySelector("#gl"), cnt = view.querySelector("#gc");
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    const rows = D.glossary.filter(g => !t || (g.begriff + " " + g.definition).toLowerCase().includes(t));
    list.innerHTML = rows.map(g => `<div class="gl">
      <b>${esc(g.begriff)}</b>
      <span>${esc(g.definition)}</span>
      <a class="chip sm" href="#/search?q=${encodeURIComponent(g.begriff)}">find in text</a></div>`).join("");
    cnt.textContent = `${rows.length} of ${D.glossary.length} terms`;
  };
  q.oninput = debounce(draw, 120); draw();
}

/* ========================================================== VOCABULARY */
function viewVocabulary() {
  const entries = Object.entries(D.terms).sort((a, b) => b[1].f - a[1].f);
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Vocabulary</span>
      <h1>Where the words sit</h1>
      <p class="lede">The ${entries.length} most frequent content words and their spread across the twelve
      parts. A flat profile is a word the book leans on throughout; a spike belongs to one argument.</p></div>
    <div class="toolbar"><input type="search" id="tq" placeholder="Find a word…" autocomplete="off"></div>
    <div id="tl" class="termlist"></div>
  </div>`));
  const q = view.querySelector("#tq"), list = view.querySelector("#tl");
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    list.innerHTML = entries.filter(([w]) => !t || w.includes(t)).slice(0, 100).map(([w, d]) =>
      `<div class="termrow"><div class="th">
        <a class="tw" href="#/search?q=${encodeURIComponent(w)}">${esc(w)}</a>
        <span class="fine">${nf(d.f)} occurrences · ${d.teile} of 12 parts</span></div>
        ${partBars(d.dist)}</div>`).join("");
  };
  q.oninput = debounce(draw, 120); draw();
}

/* ======================================================= ATTRIBUTIONS */
function viewAttributions() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Attributions</span>
      <h1>Who wrote what, and under which licence</h1>
      <p class="lede">The book is itself an adaptation: most parts are built from other open materials,
      and each carries its own statement of source, author, licence and the changes made. Reproducing them
      is not a courtesy — it is the condition on which the text may be used at all.</p></div>

    <div class="panel"><h2>The book as a whole</h2>
      <p class="readable"><em>Critical Thinking in Academic Research — Second Edition</em> © 2022 by Cindy
      Gruwell and Robin Ewing, published by Minnesota State Colleges and Universities, is licensed under a
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">Creative
      Commons Attribution-ShareAlike 4.0 International License</a>, except where otherwise noted. The
      edition indexed here is the print export of
      <a href="https://minnstate.pressbooks.pub/ctar2/" target="_blank" rel="noopener">minnstate.pressbooks.pub/ctar2</a>.</p>
      <p class="readable">This apparatus is an adaptation of that book and is released under the same
      licence. Anything you build on it must be too — that is what ShareAlike means, and it is the reason
      the text could be included here in full.</p>
    </div>

    <h2>Chapter by chapter</h2>
    <div id="al"></div>
  </div>`));
  const box = view.querySelector("#al");
  box.innerHTML = D.attributions.map(a => `<div class="attr">
    <h3>${esc(a.teil_titel)}${a.lizenzen && a.lizenzen.length
      ? a.lizenzen.map(l => `<span class="lic">${esc(l)}</span>`).join("") : ""}</h3>
    <p>${esc(a.text)}</p>
    <p class="fine" style="margin-top:.4rem">printed p. ${a.seite || "—"}</p>
  </div>`).join("");
}

/* ============================================================== METHOD */
function viewMethod() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Transparency</span>
      <h1>Method, sources and limits</h1>
      <p class="lede">What was done to the text, and where this apparatus does not carry.</p></div>

    <div class="panel"><h2>Why the text is here at all</h2>
      <p class="readable">Every other apparatus in this family ships derived data only, because the books
      they index are in copyright and their text may not be redistributed. This one is different: the book
      is an open educational resource under CC BY-SA 4.0, and redistribution — including adaptation — is
      exactly what that licence permits. So the text is here in full, searchable, and the reader needs to
      supply nothing.</p>
      <p class="readable">The obligations that come with it are met rather than assumed: the authors are
      named throughout, the licence is stated on every page of this site, each chapter's own attribution is
      reproduced under <a href="#/attributions">Attributions</a>, and this apparatus is released under the
      same licence.</p>
    </div>

    <div class="panel"><h2>Source and extraction</h2>
      <p class="readable">The source is the print export of the second edition, generated by Pressbooks in
      August 2025: 223 PDF pages carrying printed pages 1 to ${nf(D.korpus.printed_to)}. Structure comes
      from the file's own bookmarks — twelve parts and ${nf(D.chapters.length)} chapters, none without a
      target page — and printed page numbers from the footer, which gives them on every page.</p>
      <p class="readable">The typesetting scatters spaces inside words: the title page reads
      <span class="mono">CIND Y GRUW ELL</span> and <span class="mono">MINNESO TA</span>. Repair runs
      against the book's own vocabulary — two fragments are joined only where the whole is a word the book
      uses and at least one fragment is not. Headings come out clean; the body text will still hold cases
      that were not worth chasing, and search normalises rather than repairing, so a word broken in the
      original may be missed.</p>
    </div>

    <div class="panel"><h2>What is not here</h2>
      <p class="readable">The book's ${nf(D.korpus.h5p)} <strong>interactive exercises</strong> — the
      knowledge checks that ask you to sort, match or answer — are H5P elements. The print export excludes
      them and a static page cannot reproduce them. Every one is linked to its place on Pressbooks from the
      chapter it belongs to, so nothing is silently dropped, but working through them means going to the
      original.</p>
      <p class="readable">Images and diagrams are likewise not reproduced. What is here is the running text,
      the glossary, the works cited and the structure.</p>
    </div>

    <div class="panel"><h2>The glossary</h2>
      <p class="readable">The glossary is printed as alternating lines of term and definition, with no
      typographic distinction that survives extraction. It was parsed on two signals together: the entries
      run alphabetically, and term and definition strictly alternate. Neither alone suffices — a short
      definition beginning with a capital can sort after the preceding term and break a purely alphabetical
      rule, which is what the first attempt did. ${nf(D.korpus.glossar)} terms came out; the definitions are
      the authors' own words, not paraphrases.</p>
    </div>

    <div class="panel"><h2>Counts</h2>
      <p class="readable">Counts cover the twelve substantive parts; the contents, glossary, works cited and
      author biographies are indexed for structure but excluded from the statistics. Keyness is
      log-likelihood against the rest of the book. At ${nf(D.korpus.tokens)} words this is a small corpus by
      the standards of such measures: single occurrences move the numbers, and nothing here should be
      reported as a finding about instructional prose in general.</p>
    </div>

    <div class="panel"><h2>Known limits</h2>
      <ul style="color:var(--fg2);font-size:.93rem">
        <li>Search runs over the extracted text. A phrase broken across a page boundary may be missed.</li>
        <li>Page numbers are the printed ones of this export. The Pressbooks web version paginates
          differently and has no page numbers at all.</li>
        <li>The dialogue answers only from passages it retrieves from this text. It is a language model and
          can misread; the chapter it names can and should be checked.</li>
        <li>One chapter attribution carries no explicit licence string in the original. It is shown as
          printed rather than completed by guesswork.</li>
      </ul>
    </div>
  </div>`));
}

/* ===================================================== PRIVACY, IMPRINT */
function viewPrivacy() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Privacy</span>
      <h1>Privacy notice</h1>
      <p class="lede">What this site does with data, at the level of detail at which it is actually true.
      Every claim below describes code you can read in this page's source.</p></div>

    <div class="panel"><h2>Who is responsible</h2>
      <p class="readable">Operated by a private individual from the United States; details in the
      <a href="#/imprint">legal notice</a>. A personal project, not run on behalf of any institution,
      employer or publisher, and not on behalf of the authors of the book. Because it is reachable from the
      European Economic Area, this notice is written to satisfy the GDPR as well as United States law;
      where the GDPR applies, the operator is the controller within the meaning of Article 4(7).</p>
    </div>

    <div class="panel"><h2>What this site is, technically</h2>
      <p class="readable">Static files with one server function. No accounts, no login, no contact form, no
      newsletter. <strong>No cookies whatsoever</strong>, no analytics, no tag manager, no advertising, no
      session recording, and nothing written to local storage or IndexedDB. <strong>Nothing is loaded from
      third-party servers</strong> — no fonts, no scripts, no images. Opening a page contacts exactly one
      host: the one in your address bar. Reading and searching the book involve no network traffic at all
      beyond fetching the text once.</p>
    </div>

    <div class="panel"><h2>Server logs</h2>
      <p class="readable">Hosting is by Netlify, whose infrastructure records the requests it serves — IP
      address, timestamp, URL, status, bytes, user-agent and referrer. Unavoidable in delivering a website
      and the only server-side collection here; it serves operation and security, is not analysed by the
      operator, and is retained per Netlify's own periods. Legal basis: Article 6(1)(f) GDPR. The site is
      operated and hosted in the United States, so for readers in the EEA this is processing outside the
      EEA.</p>
    </div>

    <div class="panel"><h2>The dialogue — the one thing that sends data outward</h2>
      <p class="readable">Everything else runs locally. When you submit a question it sends: your question,
      truncated at 4,000 characters; at most ten passages retrieved from the book, each truncated at 1,200
      characters, with the chapter they come from; and at most the last six turns of the conversation.
      Nothing about you is added, and no part of your browsing is included.</p>
      <p class="readable">The request goes to Anthropic's model through Netlify's AI Gateway, so there are
      two recipients, both in the United States: Netlify Inc. and Anthropic PBC. The answer returns to your
      browser and is written nowhere: the function keeps no log, no database and no copy, and its responses
      carry <span class="mono">cache-control: no-store</span>. Legal basis: Article 6(1)(b) and (f) GDPR.
      Reading, searching, the glossary and the vocabulary never leave your browser.</p>
      <p class="readable">Do not paste personal information or anything concerning identifiable third
      parties into the question field. Nothing here requires it, and the operator has no way to retrieve or
      delete it once sent.</p>
    </div>

    <div class="panel"><h2>Rights of readers in the European Economic Area</h2>
      <p class="readable">Where the GDPR applies you have the rights of access (Art. 15), rectification
      (Art. 16), erasure (Art. 17), restriction (Art. 18), portability (Art. 20) and objection (Art. 21),
      and the right to complain to a supervisory authority under Article 77. Requests go to the address in
      the <a href="#/imprint">legal notice</a>. The answer will be short: apart from the server logs nothing
      about you is held here.</p>
      <p class="readable">No representative in the Union has been designated under Article 27, on the
      exemption in Article 27(2)(a): the processing is occasional, involves no large-scale processing of
      special categories of data, and is unlikely to result in a risk to the rights and freedoms of natural
      persons.</p>
    </div>

    <div class="panel"><h2>Notice for California residents</h2>
      <p class="readable">Under CalOPPA (Cal. Bus. &amp; Prof. Code §§ 22575–22579): the information
      collected is network activity information in the form of the server logs above. No name, postal
      address, email address or telephone number is collected — there is no field for them. Text you submit
      in the dialogue is transmitted to the model provider and is not retained by this site. Recipients are
      Netlify Inc. and Anthropic PBC; nothing is sold, rented or shared for marketing. No accounts and no
      stored profiles, so no record to review or amend. <strong>Do Not Track:</strong> this site does not
      track visitors over time or across third-party sites and so does not change behaviour on the signal —
      there is no tracking to disable, and no third-party content is loaded. Material changes are posted
      here with a revised date.</p>
    </div>

    <div class="panel"><h2>Children · Changes</h2>
      <p class="readable">A study aid addressed to students and other adult readers; not directed to
      children, and no information is knowingly collected from them. Effective 15 August 2026. Where this
      notice and the site's behaviour ever diverge, the notice is wrong and will be corrected — the
      description follows the code, not the other way round.</p>
    </div>
  </div>`));
}

function viewImprint() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Legal notice</span>
      <h1>Legal notice</h1>
      <p class="lede">Who operates this site, and how to reach them.</p></div>
    <div class="panel"><h2>Operator</h2>
      <p class="readable">Dr. Pantaleon Fassbender<br>16751 NE 5th Street<br>Williston, FL 32696<br>United States</p>
      <p class="readable">Email: <a href="mailto:pantaleonfassbender@gmail.com">pantaleonfassbender@gmail.com</a></p>
      <p class="readable">A personal project, operated and hosted in the United States by a private
      individual, not on behalf of any institution, employer or publisher. No company behind it, no
      advertising, no sponsorship. Responsible for the content: Dr. Pantaleon Fassbender, at the address
      above.</p>
    </div>
    <div class="panel"><h2>The book, and this adaptation</h2>
      <p class="readable"><em>Critical Thinking in Academic Research — Second Edition</em> © 2022 by Cindy
      Gruwell and Robin Ewing, Minnesota State Colleges and Universities, is licensed
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA
      4.0</a>, except where otherwise noted; the per-chapter statements are under
      <a href="#/attributions">Attributions</a>. This apparatus reproduces and rearranges that text, which
      makes it an adaptation, and it is released under the same licence.</p>
      <p class="readable">It is an <strong>independent project</strong>, not endorsed by or affiliated with
      the authors, Minnesota State Colleges and Universities, or Pressbooks. Errors introduced by extraction
      and reformatting are the operator's, not the authors'. If you find one, or if the authors would like
      anything changed or removed, write to the address above.</p>
    </div>
    <div class="panel"><h2>No warranty</h2>
      <p class="readable">Offered free of charge and without warranty of any kind. The text was extracted
      mechanically from a PDF and may differ in small ways from the original; the interactive exercises are
      not reproduced; the dialogue is generated by a language model and can be wrong. The limits are set out
      under <a href="#/method">Method</a>, and they are part of the tool rather than a disclaimer beside it.
      For teaching or citation, check against
      <a href="https://minnstate.pressbooks.pub/ctar2/" target="_blank" rel="noopener">the book itself</a>.</p>
    </div>
  </div>`));
}

boot();
