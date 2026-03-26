/* =========================================================
   Gifnof ver.4 main.js
   - Safe on every page (home / base / song / etc.)
   - Features run only when required elements exist
========================================================= */
const BASE_PATH = window.location.hostname.endsWith("github.io")
  ? `/${window.location.pathname.split("/")[1]}/`
  : "/";
console.log("main.js loaded ✅");

// =========================================================
// Boot: run once when DOM is ready
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  initTopToggles();        // ARTIST / RANK / COLUMN
  initSongPage();          // Song page only
  initDegreeFormatting();  // degree 表記整形（.degree があるページだけ）
  // renderSongsSafe();     // 必要になったらON
});

// =========================================================
// 0) Nav Panels Toggle (ARTIST / RANK / COLUMN)
// =========================================================
function initTopToggles() {
  const pairs = [
    ["artistToggle", "artist-panel"],
    ["rankToggle", "rank-panel"],
    ["columnToggle", "column-panel"],
  ];

  for (const [toggleId, panelId] of pairs) {
    const toggle = document.getElementById(toggleId);
    const panel = document.getElementById(panelId);

    // Page may not have these → skip safely
    if (!toggle || !panel) continue;

    toggle.addEventListener("click", (e) => {
      e.preventDefault();

      const willOpen = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", willOpen);

      toggle.setAttribute("aria-expanded", String(willOpen));
      panel.setAttribute("aria-hidden", String(!willOpen));
    });
  }
}

function highlight(text, query) {
  if (!text) return "";

  const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reg = new RegExp(`(${q})`, "ig");

  return text.replace(reg, "<mark>$1</mark>");
}


// =========================================================
// 1) Song Page: Degree ⇄ Chord Names + Modulation Marking
//    Runs only if #toggle-notation AND .song-section exist
// =========================================================

// ------------------------
// (1) 表示安定化（改行/余計な空白を整理）
// ------------------------
function normalizeChords(raw) {
  return String(raw || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length)
    .join("\n");
}

// ------------------------
// (1-2) 「→」の前後だけスペース（/はそのまま）
// ------------------------
function formatArrows(str) {
  return String(str || "")
    .replace(/\s*→\s*/g, " → ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

// ------------------------
// (2) クロマチックスケール
// ------------------------
const CHROMATIC_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const CHROMATIC_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const FLAT_KEYS = ["F","Bb","Eb","Ab","Db","Gb","Cb"];

function getNoteIndex(note) {
  const upper = String(note || "").toUpperCase();
  const map = {
    "C":0, "C#":1, "DB":1,
    "D":2, "D#":3, "EB":3,
    "E":4,
    "F":5, "F#":6, "GB":6,
    "G":7, "G#":8, "AB":8,
    "A":9, "A#":10, "BB":10,
    "B":11, "CB":11
  };
  return map[upper] ?? 0;
}

function indexToNote(index, useFlat) {
  const i = (index + 12) % 12;
  return useFlat ? CHROMATIC_FLAT[i] : CHROMATIC_SHARP[i];
}

// ------------------------
// (3) ローマ数字処理
// ------------------------
const ROMAN_MAP = { "Ⅰ":0,"Ⅱ":2,"Ⅲ":4,"Ⅳ":5,"Ⅴ":7,"Ⅵ":9,"Ⅶ":11 };

function normalizeQuality(q) {
  if (!q) return "";
  return String(q)
    .replace(/７/g, "7")
    .replace(/９/g, "9")
    .replace(/６/g, "6")
    .replace(/major7/gi, "maj7")
    .replace(/maj７/gi, "maj7")
    .replace(/sus\s*4/gi, "sus4")
    .replace(/sus\s*2/gi, "sus2")
    .replace(/°/g, "dim")
    .replace(/aug/gi, "aug")
    .replace(/dim/gi, "dim")
    .replace(/\s+/g, "");
}

function convertToken(token, key) {
  const match = String(token).match(/^([♭#]?)([ⅠⅡⅢⅣⅤⅥⅦ])(.*)$/);
  if (!match) return token;

  const accidental = match[1];
  const roman = match[2];
  const qualityRaw = match[3] || "";

  let semitone = ROMAN_MAP[roman];

  if (accidental === "♭") semitone -= 1;
  if (accidental === "#") semitone += 1;

  const baseIndex = getNoteIndex(key);
  const finalIndex = baseIndex + semitone;

  const useFlat = FLAT_KEYS.includes(key);
  const note = indexToNote(finalIndex, useFlat);

  const quality = normalizeQuality(qualityRaw);
  return note + quality;
}

function convertText(text, key) {
  return String(text).replace(
    /([♭#]?)([ⅠⅡⅢⅣⅤⅥⅦ])([^\/\s→]*)/g,
    (full, accidental, roman, tail) => convertToken(accidental + roman + tail, key)
  );
}

// ------------------------
// (4) JSONメタ読み取り & KEY抽出
// ------------------------
function getSongMeta() {
  const el = document.querySelector(".song-meta");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    console.warn("song-meta JSON parse failed:", e);
    return null;
  }
}

function getKeyFromKeyText(keyText) {
  const m = String(keyText || "").match(/KEY:\s*([A-G])\s*([b#♭♯]?)/);
  if (!m) return null;
  return m[1] + (m[2] || "");
}

function normalizeKeyName(k) {
  return String(k || "").replace(/♭/g, "b").replace(/♯/g, "#").trim();
}

// ------------------------
// (5) Song page initializer (safe)
// ------------------------
function initSongPage() {
  const toggleBtn = document.getElementById("toggle-notation");
  const sections = document.querySelectorAll(".song-section");

  // Song-specific elements not found → do nothing
  if (!toggleBtn || sections.length === 0) return;

  let showingDegree = true;

  // 5-1: normalize chords + store originals
  sections.forEach((section) => {
    const chords = section.querySelector(".chords");
    if (!chords) return;

    const raw = normalizeChords(chords.textContent);
    chords.dataset.original = formatArrows(raw);
    chords.textContent = chords.dataset.original;
  });

  // 5-2: mark modulated sections
  (function markNonMainKeySections() {
    const meta = getSongMeta();
    const mainKey = normalizeKeyName(meta?.keys?.main || null);
    if (!mainKey) return;

    sections.forEach((section) => {
      const keyEl = section.querySelector(".section-key");
      if (!keyEl) return;

      const sectionKey = normalizeKeyName(getKeyFromKeyText(keyEl.textContent));
      if (!sectionKey) return;

      if (sectionKey !== mainKey) {
        section.classList.add("modulated");
        keyEl.classList.add("modulated-key");
        keyEl.dataset.keyRole = "modulated";
      } else {
        keyEl.dataset.keyRole = "main";
        section.classList.remove("modulated");
        keyEl.classList.remove("modulated-key");
      }
    });
  })();

  // 5-3: toggle handler
  toggleBtn.addEventListener("click", () => {
    sections.forEach((section) => {
      const keyText = section.querySelector(".section-key")?.textContent || "";
      const keyMatch = keyText.match(/KEY:\s*([A-G][b#]?)/);
      const key = keyMatch ? keyMatch[1] : "C";

      const chords = section.querySelector(".chords");
      if (!chords) return;

      if (showingDegree) {
        chords.textContent = formatArrows(convertText(chords.dataset.original || "", key));
      } else {
        chords.textContent = chords.dataset.original || "";
      }
    });

    showingDegree = !showingDegree;
    toggleBtn.textContent = showingDegree ? "Show Chord Names" : "Show Roman Numerals";
  });
}

// =========================================================
// 2) Degree formatting (for .degree blocks)
// =========================================================
function initDegreeFormatting() {
  const els = document.querySelectorAll(".degree");
  if (els.length === 0) return;

  els.forEach((el) => {
    let t = el.textContent;

    t = String(t || "")
      .replace(/\s*→\s*/g, " → ")
      .replace(/\s*\/\s*/g, " / ")
      .replace(/\s+/g, " ")
      .trim();

    el.textContent = t;
  });
}

// =========================================================
// 3) (Optional) Song list rendering on pages that have #song-list
// =========================================================
function renderSongsSafe() {
  const songList = document.getElementById("song-list");
  if (!songList) return;
  // songList.innerHTML = "<p class='muted'>Song list will appear here.</p>";
}
document.addEventListener("DOMContentLoaded", () => {
  const shareLink = document.getElementById("share-x");
  if (!shareLink) return;

  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(document.title);

  shareLink.href = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
});
async function loadQuickPicks(){

  const res = await fetch(`${BASE_PATH}songs.json`);
  const songs = await res.json();
  const container = document.getElementById("quick-picks");

  container.innerHTML = "";

  for(let i=0;i<3;i++){
    const song = songs[Math.floor(Math.random()*songs.length)];

    container.innerHTML += `
      <a class="mini-card card" href="${song.url}">
        <h3>${song.title}</h3>
        <p>${song.artist} / Degree</p>
      </a>
    `;
  }
}

loadQuickPicks();

// ===== Search =====
let allSongs = [];

const searchInput = document.getElementById("site-search");
const resultsBox = document.getElementById("search-results");

function normalizeText(text) {
  return (text || "").toString().trim().toLowerCase();
}

function buildSearchText(song) {
  return [
    song.title || "",
    song.artist || "",
    song.composer || "",
    song.lyricist || "",
    song.arranger || "",
     (song.tags || []).join(" ")
  ].join(" ");
}

if (searchInput && resultsBox) {
  fetch(`${BASE_PATH}songs.json`)

    .then(response => {
      if (!response.ok) {
        throw new Error("songs.json could not be loaded");
      }
      return response.json();
    })
    .then(data => {
      allSongs = data;
    })
    .catch(error => {
      console.error("Search data load error:", error);
      resultsBox.innerHTML = `<p class="search-message">Search data could not be loaded.</p>`;
    });

  function searchSongs(keyword) {
    const q = normalizeText(keyword);

    if (q.length < 2) return [];

    return allSongs.filter(song => {
      return normalizeText(buildSearchText(song)).includes(q);
    }).slice(0, 5);
    
  }
  

  function searchSongs(keyword) {
  const q = normalizeText(keyword);

  if (q.length < 2) return [];

  return allSongs.filter(song => {
    return normalizeText(buildSearchText(song)).includes(q);
  });
}


function renderResults(results, keyword) {
  resultsBox.innerHTML = "";

  if (!keyword || normalizeText(keyword).length < 2) {
    return;
  }

  if (results.length === 0) {
    resultsBox.innerHTML = `<p class="search-message">No results found.</p>`;
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "search-results-list";

  // サジェストは最大5件
  const visibleResults = results.slice(0, 5);

  visibleResults.forEach(song => {
    const li = document.createElement("li");
    li.className = "search-result-item";

    const link = document.createElement("a");
    link.href = song.url;
    link.className = "search-result-link";

    link.innerHTML = `
      <span class="search-song-title">${song.title}</span>
      <span class="search-song-artist">${song.artist}</span>
    `;

    li.appendChild(link);
    ul.appendChild(li);
  });

  // 5件以上ある場合は "See all results" を表示
  if (results.length > 5) {
    const moreLi = document.createElement("li");
    moreLi.className = "search-result-item";

    const moreLink = document.createElement("a");
    moreLink.href = `/search.html?q=${encodeURIComponent(keyword)}`;
    moreLink.className = "search-result-link";
    moreLink.textContent = `See all ${results.length} results`;

    moreLi.appendChild(moreLink);
    ul.appendChild(moreLi);
  }

  resultsBox.appendChild(ul);
}

  searchInput.addEventListener("input", () => {
    const keyword = searchInput.value;
    const results = searchSongs(keyword);
    renderResults(results, keyword);
  });
}
function buildSearchText(song) {
  return [
    song.title || "",
    song.artist || "",
    song.composer || "",
    song.lyricist || "",
    song.arranger || "",
    (song.tags || []).join(" ")
  ].join(" ");
}

function searchSongs(keyword) {
  const q = normalizeText(keyword);

  if (q.length < 2) return [];

  return allSongs.filter(song => {
    const searchText = normalizeText(buildSearchText(song));
    return searchText.includes(q);
  });
}

function renderResults(results, keyword) {
  resultsBox.innerHTML = "";

  if (!keyword || normalizeText(keyword).length < 2) {
    return;
  }

  if (results.length === 0) {
    resultsBox.innerHTML = `<p class="search-message">No results found.</p>`;
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "search-results-list";

  results.forEach(song => {
    const li = document.createElement("li");
    li.className = "search-result-item";

    const link = document.createElement("a");
    link.href = song.url;
    link.className = "search-result-link";

    link.innerHTML = `
      <span class="search-song-title">${song.title}</span>
      <span class="search-song-artist">${song.artist}</span>
    `;

    li.appendChild(link);
    ul.appendChild(li);
  });

  resultsBox.appendChild(ul);
}



// ===== Search Page =====
const searchPageInput = document.getElementById("search-page-input");
const searchQueryText = document.getElementById("search-query");
const searchCountText = document.getElementById("search-count");
const searchResultsPageList = document.getElementById("search-results-page-list");

if (searchPageInput && searchQueryText && searchCountText && searchResultsPageList) {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") || "";

  searchPageInput.value = query;

  fetch(`${BASE_PATH}songs.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error("songs.json could not be loaded");
      }
      return response.json();
    })
    .then(data => {
      const normalizedQuery = query.trim().toLowerCase();

      if (!normalizedQuery) {
        searchQueryText.textContent = "";
        searchCountText.textContent = "Type a song title or artist name to start searching.";
        searchResultsPageList.innerHTML = "";
        return;
      }

function buildSearchText(song) {
  return [
    song.title || "",
    song.artist || "",
    song.composer || "",
    song.lyricist || "",
    song.arranger || "",
    (song.tags || []).join(" ")
  ].join(" ").toLowerCase();
}

// 本検索
const results = data.filter(song => {
  return buildSearchText(song).includes(normalizedQuery);
});



      searchQueryText.textContent = `Results for "${query}"`;
      searchCountText.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;

      if (results.length === 0) {
        searchResultsPageList.innerHTML = `
          <p class="search-empty">No results found.</p>
        `;
        return;
      }

const html = results.map(song => {

  const q = query.toLowerCase();
  const hits = [];

  if ((song.artist || "").toLowerCase().includes(q)) {
    hits.push("Artist");
  }

  if ((song.composer || "").toLowerCase().includes(q)) {
    hits.push("Composer");
  }

  if ((song.lyricist || "").toLowerCase().includes(q)) {
    hits.push("Lyricist");
  }

  if ((song.arranger || "").toLowerCase().includes(q)) {
    hits.push("Arranger");
  }

  const matchedTag = (song.tags || []).find(tag =>
    String(tag).toLowerCase().includes(q)
  );

  if (matchedTag) {
    hits.push(`Tag · ${matchedTag}`);
  }

  const hitLabel = hits.join(" · ");

  return `
    <a class="search-page-result card" href="${song.url}">
      <h2 class="search-page-result-title">${song.title}</h2>
      <p class="search-page-result-artist">${song.artist}</p>
      ${hitLabel ? `<p class="search-page-result-meta">${hitLabel}</p>` : ""}
    </a>
  `;

}).join("");

      searchResultsPageList.innerHTML = html;
    })
    .catch(error => {
      console.error("Search page load error:", error);
      searchQueryText.textContent = "Search error";
      searchCountText.textContent = "Could not load search data.";
      searchResultsPageList.innerHTML = "";
    });
}
let selectedIndex = -1;

searchInput.addEventListener("keydown", (e) => {
  const items = document.querySelectorAll(".search-result-link");

  // IME変換中は無視
  if (e.isComposing || e.keyCode === 229) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();

    if (items.length === 0) return;

    selectedIndex++;
    if (selectedIndex >= items.length) selectedIndex = 0;
  }

  else if (e.key === "ArrowUp") {
    e.preventDefault();

    if (items.length === 0) return;

    selectedIndex--;
    if (selectedIndex < 0) selectedIndex = items.length - 1;
  }

  else if (e.key === "Enter") {
    e.preventDefault();

    // サジェストを選択中ならそのページへ
    if (selectedIndex >= 0 && items[selectedIndex]) {
      window.location.href = items[selectedIndex].href;
      return;
    }

    // 選択中がなければ通常の検索結果ページへ
    const keyword = searchInput.value.trim();
    if (!keyword) return;

    window.location.href = `/search.html?q=${encodeURIComponent(keyword)}`;
  }

  items.forEach((el, i) => {
    el.classList.toggle("selected", i === selectedIndex);
  });
});
// ------------------------
// Tag page: load songs by tag slug
// ------------------------
(function renderTagPageSongs() {
  const listEl = document.querySelector("#tag-song-list");
  if (!listEl) return; // タグページ以外では何もしない

  // 例: /tags/pre-chorus-3.html -> pre-chorus-3
  const path = window.location.pathname;
  const match = path.match(/\/tags\/([^/]+)\.html$/);
  if (!match) return;

  const currentTagSlug = match[1];

  fetch(`${BASE_PATH}songs.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch songs.json: ${res.status}`);
      return res.json();
    })
    .then((songs) => {
      const matchedSongs = songs.filter((song) =>
        Array.isArray(song.tags) && song.tags.includes(currentTagSlug)
      );

      if (matchedSongs.length === 0) {
        listEl.innerHTML = `<li class="empty-state">No songs found for this tag yet.</li>`;
        return;
      }

      const html = matchedSongs
        .map((song) => {
          const title = song.title || "Untitled";
          const artist = song.artist || "Unknown Artist";
          const url = song.url || "#";

          return `
            <li>
              <a href="${url}">${title}</a>
              <span class="meta"> / ${artist}</span>
            </li>
          `;
        })
        .join("");

      listEl.innerHTML = html;
    })
    .catch((err) => {
      console.error("Tag page rendering failed:", err);
      listEl.innerHTML = `<li class="empty-state">Failed to load songs.</li>`;
    });
})();
const tagLabels = {
  "1-7": "Ⅰ7",
  "1-to-3": "Ⅰ→Ⅲ",
  "2-to-5": "Ⅱ→Ⅴ",
  "2m-to-3m-to-4m": "Ⅱm→Ⅲm→Ⅳm",
  "4-to-5-to-6m": "Ⅳ→Ⅴ→Ⅵm",
  "4m": "Ⅳm",
  "4536": "4536",
  "7dim-to-3": "Ⅶdim→Ⅲ",
  "augmented": "Augmented",
  "canon-progression": "Pachelbel-progression / Canon-progression",
  "flat-7": "♭Ⅶ",
  "marusa-progression": "Marusa Progression",
  "non-diatonic-junkies": "Non-Diatonic Junkies",
  "pre-chorus-3": "Pre-Chorus Ⅲ",
  "sharp-4dim": "♯Ⅳdim",
  "sus4": "sus4",
  "flat6-to-flat7": "♭Ⅵ→♭Ⅶ→Ⅰ",
  "diatonic-only":"Diatonic Only"
};

fetch('${BASE_PATH}songs.json')
  .then(response => response.json())
  .then(songs => {
    const tagCounts = {};

    songs.forEach(song => {
      if (!song.tags || !Array.isArray(song.tags)) return;

      song.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const tagList = document.getElementById('tag-list');
    if (!tagList) return;

    const tagDescriptions = {
  "flat-7": "Adds a strong rock flavor with a non-diatonic pull.",
  "sharp-4dim": "Diminished chord used as a passing chord with tension.",
  "4536": "A versatile emotional flow widely used across J-POP, from ballads to up-tempo songs.",
  "augmented": "A floating tension that often appears as the minor root drops by a semitone.",
  "canon-progression": "A timeless progression known for its smooth and emotional movement.",
  "1-to-3": "An unexpected lift that makes the moment feel brighter.",
  "1-7": "A familiar brightness colored with a subtle, bittersweet tension.",
  "2-to-5": "A familiar step that feels entirely new the moment it turns major.",
  "2m-to-3m-to-4m": "A gentle betrayal that avoids the major path, leading perfectly into IVm.",
"4m": "A borrowed minor chord that deepens emotion with a touch of melancholy.",
"4-to-5-to-6m": "A straightforward rise that unexpectedly makes the emotion dance.",
"marusa-progression": "A smooth city-pop progression, named after \"Marunouchi Sadistic\" in Japan.",
"pre-chorus-3": "A trigger chord that ignites the emotion right before the chorus, launching it at full intensity.",
"sus4": "A suspended sound that feels neither major nor minor, gently resonating with a subtle, in-between emotion.",
"7dim-to-3": "A tense, unstable motion that suddenly resolves into a striking brightness.",
"flat6-to-flat7": "A bold, all-major rise that drives into an overwhelming sense of brightness.",
"non-diatonic-junkies": "A collection of irresistible sounds that don’t quite fit the rules."









};

const sortedTags = Object.keys(tagLabels).sort((a, b) => {
  const labelA = tagLabels[a];
  const labelB = tagLabels[b];
  return labelA.localeCompare(labelB, 'en', { numeric: true });
});

tagList.innerHTML = sortedTags.map(tag => {
  const label = tagLabels[tag];
  const count = tagCounts[tag] || 0;
  const description = tagDescriptions[tag] || "";

  return `
  <a href="/tags/${tag}.html" class="list-item">
    <div class="tag-left">
      <span class="name">${label}</span>
      ${description ? `<span class="tag-desc">${description}</span>` : ""}
    </div>
    <span class="artist-count">${count}</span>
  </a>
`;
}).join('');
  })
  .catch(error => {
    console.error('Failed to load songs.json:', error);
  });