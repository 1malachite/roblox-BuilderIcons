var FONT_BASE = "https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/refs/heads/roblox/LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons/Font";
var FONT_URLS = {
  reg: FONT_BASE + "/BuilderIcons-Regular.ttf",
  fill: FONT_BASE + "/BuilderIcons-Filled.ttf",
};

var CATEGORY_ORDER = [
  "Social Media", "PlayStation", "Xbox", "Avatar & Body",
  "Clothing & Fashion", "Makeup", "Media Controls", "Communication",
  "Text Formatting", "UI Elements", "Developer", "E-Commerce",
  "Arrows & Navigation", "Other",
];

var PATTERNS = [
  { pattern: /^(amazon|android|apple|discord|facebook|figma|github|guilded|instagram|linkedin|messenger|meta|microsoft|slack|tencent|tik-tok|twitch|twitter|we-chat|whatsapp|youtube)/, category: "Social Media" },
  { pattern: /^playstation|^ps[0-9-]|^ps-/, category: "PlayStation" },
  { pattern: /^xbox/, category: "Xbox" },
  { pattern: /^(arm|beard|dot-frame|eyebrow|eyelash|face-|head-|leg|lips|lipstick|nose|person|torso)/, category: "Avatar & Body" },
  { pattern: /^(backpack|belt|bow-tie|butterfly-wing|clothes|dress|glasses|hat-|helmet|hoodie|jacket|mirror-standing|necklace|pants|purse|shirt|shoe|shorts|skirt|sweater|tshirt|vest|wings)/, category: "Clothing & Fashion" },
  { pattern: /^(blush|compact-makeup|cosmetic|eye-with-eyeliner|eyeshadow|makeup|mascara|nail-polish|two-makeup)/, category: "Makeup" },
  { pattern: /^(audio-wave|fast-forward|frame-record|frame-soundwave|loop|music|pause|play|record|rewind|shuffle|skip|speaker|stop-large|stop-small|stop-media|volume)/, category: "Media Controls" },
  { pattern: /^(envelope|headphones|microphone|paper-airplane|phone|speech|video-camera)/, category: "Communication" },
  { pattern: /^(four-bars-horizontal|list-bulleted|list-numbered|paragraph|quotation|text-)/, category: "Text Formatting" },
  { pattern: /^(arrow|caret-small|chevron|dual-arrows|three-chevrons|two-arrows)/, category: "Arrows & Navigation" },
  { pattern: /^(check|checkmark-square|circle-check|circle-i$|circle-minus|circle-play|circle-plus|circle-question|circle-slash|circle-three-dots|circle-x$|crop|frame-collapsed|frame-corners|frame-expanded|grid$|minus$|minus-small|nine-dots|picture-in-picture|plus-large|plus-small|sidebar|six-dots|square-check|square-minus|squares-grid|stacked-squares|three-bars|three-dots|three-horizontal|three-sliders|three-stacked|two-stacked|two-switches|x$|x-small)/, category: "UI Elements" },
  { pattern: /^(code|controller|cube-question|cube-vertex|gear|generic-dpad|hack-week|hammer-code|keyboard|lab-beaker|nexus|ro-gro|speedometer|square-bar-graph|square-code|studio|teletype)/, category: "Developer" },
  { pattern: /^(building-store|gift-|premium|roblox-plus|robux|shopping|tag-sparkle|wallet)/, category: "E-Commerce" },
];

function guessCategory(name) {
  for (var i = 0; i < PATTERNS.length; i++) {
    if (PATTERNS[i].pattern.test(name)) return PATTERNS[i].category;
  }
  return "Other";
}

function extractLigatures(font) {
  var ligatures = {};
  var gsub = font.tables.gsub;
  if (!gsub) return ligatures;
  for (var f = 0; f < gsub.features.length; f++) {
    if (gsub.features[f].tag !== "liga") continue;
    var lookupIndexes = gsub.features[f].feature.lookupListIndexes;
    for (var li = 0; li < lookupIndexes.length; li++) {
      var lookup = gsub.lookups[lookupIndexes[li]];
      if (!lookup) continue;
      for (var s = 0; s < lookup.subtables.length; s++) {
        var subtable = lookup.subtables[s];
        if (!subtable.ligatureSets) continue;
        for (var i = 0; i < subtable.ligatureSets.length; i++) {
          var coverageGlyphId = subtable.coverage.glyphs
            ? subtable.coverage.glyphs[i]
            : subtable.coverage.ranges
              ? getCoverageGlyphId(subtable.coverage.ranges, i)
              : null;
          if (coverageGlyphId == null) continue;
          var firstGlyph = font.glyphs.get(coverageGlyphId);
          if (!firstGlyph) continue;
          var firstChar = String.fromCharCode(firstGlyph.unicode);
          for (var j = 0; j < subtable.ligatureSets[i].length; j++) {
            var lig = subtable.ligatureSets[i][j];
            var chars = [];
            for (var k = 0; k < lig.components.length; k++) {
              var g = font.glyphs.get(lig.components[k]);
              chars.push(g ? String.fromCharCode(g.unicode) : "");
            }
            var name = firstChar + chars.join("");
            var ligGlyph = font.glyphs.get(lig.ligGlyph);
            if (ligGlyph && ligGlyph.unicode) {
              ligatures[name] = "0x" + ligGlyph.unicode.toString(16);
            }
          }
        }
      }
    }
  }
  return ligatures;
}

function getCoverageGlyphId(ranges, index) {
  var count = 0;
  for (var i = 0; i < ranges.length; i++) {
    var rangeSize = ranges[i].end - ranges[i].start + 1;
    if (index < count + rangeSize) return ranges[i].start + (index - count);
    count += rangeSize;
  }
  return null;
}

function extractCmapIcons(font) {
  var icons = {};
  for (var cp = 0xf100; cp <= 0xf400; cp++) {
    var glyph = font.charToGlyph(String.fromCodePoint(cp));
    if (glyph && glyph.index !== 0 && glyph.name) {
      icons[glyph.name] = "0x" + cp.toString(16);
    }
  }
  return icons;
}

var categories = {};
var activeTab = "all";
var activeVariant = "both";
var fontObjects = { reg: null, fill: null };

var searchInput = document.getElementById("search");
var tabsEl = document.getElementById("tabs");
var variantToggleEl = document.getElementById("variantToggle");
var contentEl = document.getElementById("content");
var countBadgeEl = document.getElementById("countBadge");
var toastEl = document.getElementById("toast");
var toastTimer = null;

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
}

function cpToHex(cp) {
  return "0x" + parseInt(cp, 16).toString(16).toUpperCase();
}

function cpToUnicode(cp) {
  return "U+" + parseInt(cp, 16).toString(16).toUpperCase().padStart(4, "0");
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(function () {});
}

function downloadIconPNG(icon, variant, size) {
  size = size || 512;
  var font = variant === "fill" ? fontObjects.fill : fontObjects.reg;
  var cp = variant === "fill" ? icon.fill : icon.reg;
  if (!font || !cp) return;

  var canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";

  var glyph = font.charToGlyph(String.fromCodePoint(parseInt(cp)));
  if (!glyph) return;

  var fontSize = size * 0.7;
  var scale = fontSize / font.unitsPerEm;
  var glyphWidth = glyph.advanceWidth * scale;
  var x = (size - glyphWidth) / 2;
  var ascender = font.ascender * scale;
  var y = (size - fontSize) / 2 + ascender;

  var path = glyph.getPath(x, y, fontSize);
  var p2d = new Path2D(path.toPathData(2));
  ctx.fill(p2d);

  var link = document.createElement("a");
  link.download = icon.name + (variant === "fill" ? "-filled" : "-regular") + ".png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("Downloaded " + link.download);
}

function downloadIconSVG(icon, variant) {
  var font = variant === "fill" ? fontObjects.fill : fontObjects.reg;
  var cp = variant === "fill" ? icon.fill : icon.reg;
  if (!font || !cp) return;

  var size = 512;
  var fontSize = size * 0.7;
  var scale = fontSize / font.unitsPerEm;

  var glyph = font.charToGlyph(String.fromCodePoint(parseInt(cp)));
  if (!glyph) return;

  var glyphWidth = glyph.advanceWidth * scale;
  var x = (size - glyphWidth) / 2;
  var ascender = font.ascender * scale;
  var y = (size - fontSize) / 2 + ascender;

  var path = glyph.getPath(x, y, fontSize);
  var pathData = path.toPathData(2);
  var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '"><path d="' + pathData + '" fill="#000"/></svg>';
  var blob = new Blob([svgStr], { type: "image/svg+xml" });
  var link = document.createElement("a");
  link.download = icon.name + (variant === "fill" ? "-filled" : "-regular") + ".svg";
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);
  showToast("Downloaded " + link.download);
}

function buildIconCard(icon) {
  var hasReg = !!icon.reg;
  var hasFill = !!icon.fill;
  var regChar = hasReg ? String.fromCodePoint(parseInt(icon.reg)) : "";
  var fillChar = hasFill ? String.fromCodePoint(parseInt(icon.fill)) : "";
  var escapedName = icon.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  var badge = "";
  if (hasReg && !hasFill) badge = '<div class="badge badge-reg">R</div>';
  if (!hasReg && hasFill) badge = '<div class="badge badge-fill">F</div>';

  var glyphs = "";
  if (activeVariant === "both") {
    if (hasReg && hasFill) {
      glyphs = '<span class="glyph-reg">' + regChar + '</span><div class="divider"></div><span class="glyph-fill">' + fillChar + '</span>';
    } else if (hasReg) {
      glyphs = '<span class="glyph-reg glyph-single">' + regChar + '</span>';
    } else {
      glyphs = '<span class="glyph-fill glyph-single">' + fillChar + '</span>';
    }
  } else if (activeVariant === "reg" && hasReg) {
    glyphs = '<span class="glyph-reg glyph-single">' + regChar + '</span>';
  } else if (activeVariant === "fill" && hasFill) {
    glyphs = '<span class="glyph-fill glyph-single">' + fillChar + '</span>';
  }

  var shownVariant = (activeVariant === "fill" && hasFill) ? "fill" : "reg";
  var shownCp = shownVariant === "fill" ? icon.fill : icon.reg;
  if (!shownCp && hasFill) shownCp = icon.fill;
  if (!shownCp && hasReg) shownCp = icon.reg;

  var cpHex = shownCp ? cpToHex(shownCp) : "—";
  var uni = shownCp ? cpToUnicode(shownCp) : "—";
  var dlVariant = (activeVariant === "fill" && hasFill) ? "fill" : (hasReg ? "reg" : "fill");

  var hoverOverlay =
    '<div class="card-hover-overlay">' +
      '<div class="hover-meta">' +
        '<span class="hover-meta-label">Code</span> <span>' + cpHex + '</span>' +
        '&nbsp;<span class="hover-meta-label">Unicode</span> <span>' + uni + '</span>' +
      '</div>' +
      '<div class="hover-actions">' +
        '<button class="hover-btn copy-name-btn" onclick="event.stopPropagation();copyText(\'' + escapedName + '\');showToast(\'Copied name\')">Name</button>' +
        '<button class="hover-btn" onclick="event.stopPropagation();copyText(\'' + cpHex + '\');showToast(\'Copied codepoint\')">Code</button>' +
        '<button class="hover-btn" onclick="event.stopPropagation();downloadIconPNG(window._icons[\'' + escapedName + '\'],\'' + dlVariant + '\')">PNG</button>' +
        '<button class="hover-btn" onclick="event.stopPropagation();downloadIconSVG(window._icons[\'' + escapedName + '\'],\'' + dlVariant + '\')">SVG</button>' +
      '</div>' +
    '</div>';

  return (
    '<div class="icon-card" onclick="copyText(\'' + escapedName + '\');showToast(\'Copied: ' + escapedName + '\')" title="' + icon.name + '">' +
      badge +
      '<div class="glyphs">' + glyphs + '</div>' +
      '<div class="card-name">' + icon.name + '</div>' +
      hoverOverlay +
    '</div>'
  );
}

function render() {
  var query = searchInput.value.toLowerCase().trim();
  var html = "";
  var totalShown = 0;

  CATEGORY_ORDER.forEach(function (cat) {
    if (activeTab !== "all" && activeTab !== cat) return;
    var icons = (categories[cat] || []).slice();
    if (query) icons = icons.filter(function (ic) { return ic.name.includes(query); });
    if (activeVariant === "reg") icons = icons.filter(function (ic) { return ic.reg; });
    if (activeVariant === "fill") icons = icons.filter(function (ic) { return ic.fill; });
    if (!icons.length) return;
    totalShown += icons.length;
    html +=
      '<div class="category">' +
        '<div class="category-title">' + cat + ' <span class="cat-count">' + icons.length + '</span></div>' +
        '<div class="icon-grid">' + icons.map(buildIconCard).join("") + '</div>' +
      '</div>';
  });

  if (!html) {
    html = '<div class="no-results">No icons found for "' + searchInput.value + '"</div>';
  }

  contentEl.innerHTML = html;
  countBadgeEl.textContent = totalShown + " icons shown";
}

function renderTabs() {
  var total = 0;
  CATEGORY_ORDER.forEach(function (cat) { total += (categories[cat] || []).length; });
  var html = '<div class="tab active" data-cat="all">All (' + total + ')</div>';
  CATEGORY_ORDER.forEach(function (cat) {
    var count = (categories[cat] || []).length;
    if (count) html += '<div class="tab" data-cat="' + cat + '">' + cat + ' (' + count + ')</div>';
  });
  tabsEl.innerHTML = html;
  tabsEl.querySelectorAll(".tab").forEach(function (tab) {
    tab.onclick = function () {
      tabsEl.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      activeTab = tab.dataset.cat;
      render();
    };
  });
}

variantToggleEl.querySelectorAll("button").forEach(function (btn) {
  btn.onclick = function () {
    variantToggleEl.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    activeVariant = btn.dataset.v;
    render();
  };
});

searchInput.addEventListener("input", render);

async function init() {
  try {
    var responses = await Promise.all([fetch(FONT_URLS.reg), fetch(FONT_URLS.fill)]);
    if (!responses[0].ok || !responses[1].ok) throw new Error("Font download failed");
    var buffers = await Promise.all([responses[0].arrayBuffer(), responses[1].arrayBuffer()]);

    fontObjects.reg = opentype.parse(buffers[0]);
    fontObjects.fill = opentype.parse(buffers[1]);

    var regIcons = Object.assign({}, extractCmapIcons(fontObjects.reg), extractLigatures(fontObjects.reg));
    var fillIcons = Object.assign({}, extractCmapIcons(fontObjects.fill), extractLigatures(fontObjects.fill));
    var allNames = Array.from(new Set([...Object.keys(regIcons), ...Object.keys(fillIcons)])).sort();

    var categorized = {};
    CATEGORY_ORDER.forEach(function (cat) { categorized[cat] = []; });

    window._icons = {};
    allNames.forEach(function (name) {
      var icon = { name: name };
      if (regIcons[name]) icon.reg = regIcons[name];
      if (fillIcons[name]) icon.fill = fillIcons[name];
      var cat = guessCategory(name);
      if (!categorized[cat]) categorized[cat] = [];
      categorized[cat].push(icon);
      window._icons[name] = icon;
    });
    categories = categorized;

    var both = 0, regOnly = 0, fillOnly = 0;
    allNames.forEach(function (name) {
      var hasR = !!regIcons[name], hasF = !!fillIcons[name];
      if (hasR && hasF) both++;
      else if (hasR) regOnly++;
      else fillOnly++;
    });

    document.getElementById("stats").innerHTML =
      '<div class="stat"><b>' + allNames.length + '</b> total</div>' +
      '<div class="stat"><b>' + both + '</b> both variants</div>' +
      '<div class="stat"><b>' + regOnly + '</b> regular only</div>' +
      '<div class="stat"><b>' + fillOnly + '</b> filled only</div>';

    renderTabs();
    render();
  } catch (err) {
    contentEl.innerHTML =
      '<div class="no-results" style="color:#ef4444">Failed to load icons: ' + err.message + '</div>';
  }
}

init();