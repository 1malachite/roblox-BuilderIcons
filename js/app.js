var FONT_BASE = "https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/refs/heads/roblox/LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons/Font";
var FONT_URLS = {
  reg: FONT_BASE + "/BuilderIcons-Regular.ttf",
  fill: FONT_BASE + "/BuilderIcons-Filled.ttf"
};

var CATEGORY_ORDER = [
  "Social Media", "PlayStation", "Xbox", "Avatar & Body",
  "Clothing & Fashion", "Makeup", "Media Controls", "Communication",
  "Text Formatting", "UI Elements", "Developer", "E-Commerce",
  "Arrows & Navigation", "Other"
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
  { pattern: /^(building-store|gift-|premium|roblox-plus|robux|shopping|tag-sparkle|wallet)/, category: "E-Commerce" }
];

var THEME_STORAGE_KEY = "buildericons-theme";

var categories = {};
var activeTab = "all";
var activeVariant = "both";
var fontObjects = { reg: null, fill: null };
var collapsedSections = {};
var state = {
  activeIconName: null,
  modalIconName: null,
  modalTrigger: null,
  infoIconName: null,
  infoTrigger: null
};

var searchInput = document.getElementById("search");
var tabsEl = document.getElementById("tabs");
var variantToggleEl = document.getElementById("variantToggle");
var contentEl = document.getElementById("content");
var countBadgeEl = document.getElementById("countBadge");
var toastEl = document.getElementById("toast");
var themeToggleEl = document.getElementById("themeToggle");
var implementationToggleEl = document.getElementById("implementationToggle");
var modalEl = document.getElementById("iconModal");
var modalBodyEl = document.getElementById("iconModalBody");
var infoModalEl = document.getElementById("iconInfoModal");
var infoModalBodyEl = document.getElementById("iconInfoModalBody");
var implementationModalEl = document.getElementById("implementationModal");
var implementationModalBodyEl = document.getElementById("implementationModalBody");

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

  for (var featureIndex = 0; featureIndex < gsub.features.length; featureIndex++) {
    if (gsub.features[featureIndex].tag !== "liga") continue;
    var lookupIndexes = gsub.features[featureIndex].feature.lookupListIndexes;

    for (var lookupIndex = 0; lookupIndex < lookupIndexes.length; lookupIndex++) {
      var lookup = gsub.lookups[lookupIndexes[lookupIndex]];
      if (!lookup) continue;

      for (var subtableIndex = 0; subtableIndex < lookup.subtables.length; subtableIndex++) {
        var subtable = lookup.subtables[subtableIndex];
        if (!subtable.ligatureSets) continue;

        for (var setIndex = 0; setIndex < subtable.ligatureSets.length; setIndex++) {
          var coverageGlyphId = subtable.coverage.glyphs
            ? subtable.coverage.glyphs[setIndex]
            : subtable.coverage.ranges
              ? getCoverageGlyphId(subtable.coverage.ranges, setIndex)
              : null;

          if (coverageGlyphId == null) continue;

          var firstGlyph = font.glyphs.get(coverageGlyphId);
          if (!firstGlyph || firstGlyph.unicode == null) continue;

          var firstChar = String.fromCharCode(firstGlyph.unicode);
          for (var ligIndex = 0; ligIndex < subtable.ligatureSets[setIndex].length; ligIndex++) {
            var ligature = subtable.ligatureSets[setIndex][ligIndex];
            var chars = [];

            for (var componentIndex = 0; componentIndex < ligature.components.length; componentIndex++) {
              var glyph = font.glyphs.get(ligature.components[componentIndex]);
              chars.push(glyph && glyph.unicode != null ? String.fromCharCode(glyph.unicode) : "");
            }

            var ligGlyph = font.glyphs.get(ligature.ligGlyph);
            if (ligGlyph && ligGlyph.unicode != null) {
              ligatures[firstChar + chars.join("")] = "0x" + ligGlyph.unicode.toString(16);
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

function showToast(msg) {
  var toastItem = document.createElement("div");
  toastItem.className = "toast-item";
  toastItem.textContent = msg;
  toastEl.appendChild(toastItem);

  requestAnimationFrame(function () {
    toastItem.classList.add("show");
  });

  setTimeout(function () {
    toastItem.classList.remove("show");
    toastItem.classList.add("hide");
    setTimeout(function () {
      if (toastItem.parentNode) {
        toastItem.parentNode.removeChild(toastItem);
      }
    }, 220);
  }, 2200);
}

function cpToHex(cp) {
  return "0x" + parseInt(cp, 16).toString(16).toUpperCase();
}

function cpToUnicode(cp) {
  return "U+" + parseInt(cp, 16).toString(16).toUpperCase().padStart(4, "0");
}

function copyText(text, label) {
  navigator.clipboard.writeText(text).then(function () {
    showToast(label || "Copied");
  }).catch(function () {});
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  var glyph = font.charToGlyph(String.fromCodePoint(parseInt(cp, 16)));
  if (!glyph) return;

  var fontSize = size * 0.7;
  var scale = fontSize / font.unitsPerEm;
  var glyphWidth = glyph.advanceWidth * scale;
  var x = (size - glyphWidth) / 2;
  var ascender = font.ascender * scale;
  var y = (size - fontSize) / 2 + ascender;

  var path = glyph.getPath(x, y, fontSize);
  var path2d = new Path2D(path.toPathData(2));
  ctx.fill(path2d);

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
  var glyph = font.charToGlyph(String.fromCodePoint(parseInt(cp, 16)));
  if (!glyph) return;

  var glyphWidth = glyph.advanceWidth * scale;
  var x = (size - glyphWidth) / 2;
  var ascender = font.ascender * scale;
  var y = (size - fontSize) / 2 + ascender;

  var path = glyph.getPath(x, y, fontSize);
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '"><path d="' + path.toPathData(2) + '" fill="#000000"/></svg>';
  var blob = new Blob([svg], { type: "image/svg+xml" });
  var link = document.createElement("a");
  link.download = icon.name + (variant === "fill" ? "-filled" : "-regular") + ".svg";
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(link.href);
  }, 2000);
  showToast("Downloaded " + link.download);
}

function getShownVariant(icon) {
  if (activeVariant === "fill" && icon.fill) return "fill";
  if (activeVariant === "reg" && icon.reg) return "reg";
  if (icon.reg) return "reg";
  return "fill";
}

function getIconBadgeLabel(icon) {
  if (activeVariant === "reg") return icon.reg ? "Regular" : "Filled";
  if (activeVariant === "fill") return icon.fill ? "Filled" : "Regular";
  if (icon.reg && icon.fill) return "Both";
  if (icon.reg) return "Regular";
  return "Filled";
}

function buildGlyphMarkup(icon, className) {
  var hasReg = !!icon.reg;
  var hasFill = !!icon.fill;
  var regChar = hasReg ? String.fromCodePoint(parseInt(icon.reg, 16)) : "";
  var fillChar = hasFill ? String.fromCodePoint(parseInt(icon.fill, 16)) : "";
  var classes = className ? " " + className : "";

  if (activeVariant === "both") {
    if (hasReg && hasFill) {
      return '<div class="glyphs' + classes + '"><span class="glyph-reg">' + regChar + '</span><div class="divider"></div><span class="glyph-fill">' + fillChar + "</span></div>";
    }
    if (hasReg) {
      return '<div class="glyphs' + classes + '"><span class="glyph-reg glyph-single">' + regChar + "</span></div>";
    }
    return '<div class="glyphs' + classes + '"><span class="glyph-fill glyph-single">' + fillChar + "</span></div>";
  }

  if (activeVariant === "fill" && hasFill) {
    return '<div class="glyphs' + classes + '"><span class="glyph-fill glyph-single">' + fillChar + "</span></div>";
  }

  return '<div class="glyphs' + classes + '"><span class="glyph-reg glyph-single">' + regChar + "</span></div>";
}

function buildIconCard(icon) {
  var badge = "";
  if (icon.reg && !icon.fill) {
    badge = '<div class="badge badge-reg">Regular</div>';
  } else if (!icon.reg && icon.fill) {
    badge = '<div class="badge badge-fill">Filled</div>';
  }

  var badgeLabel = getIconBadgeLabel(icon);

  return (
    '<div class="icon-card" data-icon-name="' + escapeHtml(icon.name) + '" tabindex="0" role="button" aria-label="Inspect ' + escapeHtml(icon.name) + '">' +
      '<button class="icon-name-hitbox" type="button" data-copy-name="' + escapeHtml(icon.name) + '" aria-label="Copy ' + escapeHtml(icon.name) + '"></button>' +
      '<div class="icon-card-core">' +
        badge +
        buildGlyphMarkup(icon, "") +
        '<div class="card-name">' + escapeHtml(icon.name) + "</div>" +
      "</div>" +
      '<div class="icon-card-detail">' +
        '<div class="detail-head">' +
          '<div class="detail-title">' + escapeHtml(icon.name) + "</div>" +
          '<div class="detail-chip">' + badgeLabel + "</div>" +
        "</div>" +
        buildGlyphMarkup(icon, "detail-glyphs") +
        '<div class="icon-actions">' +
          '<button class="icon-action icon-action-label" type="button" data-open-modal="' + escapeHtml(icon.name) + '" aria-label="Open full preview" title="Open full preview">Preview</button>' +
          '<button class="icon-action ghost" type="button" data-open-info="' + escapeHtml(icon.name) + '" aria-label="Open code info" title="Open code info">&lt;/&gt;</button>' +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

function getFilteredIcons(categoryName) {
  var query = searchInput.value.toLowerCase().trim();
  var icons = (categories[categoryName] || []).slice();

  if (query) {
    icons = icons.filter(function (icon) {
      return icon.name.indexOf(query) !== -1;
    });
  }

  if (activeVariant === "reg") {
    icons = icons.filter(function (icon) { return icon.reg; });
  } else if (activeVariant === "fill") {
    icons = icons.filter(function (icon) { return icon.fill; });
  }

  return icons;
}

function updateCardStates() {
  contentEl.querySelectorAll(".icon-card").forEach(function (card) {
    var iconName = card.getAttribute("data-icon-name");
    card.classList.toggle("is-active", iconName === state.activeIconName);
  });
}

function render() {
  var html = "";
  var totalShown = 0;
  var sectionsShown = 0;

  CATEGORY_ORDER.forEach(function (categoryName) {
    if (activeTab !== "all" && activeTab !== categoryName) return;

    var icons = getFilteredIcons(categoryName);
    if (!icons.length) return;

    totalShown += icons.length;
    sectionsShown += 1;

    var isCollapsed = !!collapsedSections[categoryName];
    html +=
      '<section class="category' + (isCollapsed ? " collapsed" : "") + '" data-category="' + escapeHtml(categoryName) + '">' +
        '<button class="category-trigger" type="button" data-category-toggle="' + escapeHtml(categoryName) + '" aria-expanded="' + String(!isCollapsed) + '">' +
          '<div class="category-copy">' +
            '<div class="category-title">' + escapeHtml(categoryName) + "</div>" +
            '<span class="cat-count">' + icons.length + "</span>" +
          "</div>" +
          '<span class="category-arrow" aria-hidden="true"></span>' +
        "</button>" +
        '<div class="icon-grid">' + icons.map(buildIconCard).join("") + "</div>" +
      "</section>";
  });

  if (!html) {
    html = '<div class="no-results">No icons match "' + escapeHtml(searchInput.value || "your filters") + '".</div>';
  }

  contentEl.innerHTML = html;
  countBadgeEl.textContent = totalShown + " icons across " + sectionsShown + " sections";
  updateCardStates();

  if (state.modalIconName) {
    var modalIcon = window._icons[state.modalIconName];
    if (modalIcon) {
      modalBodyEl.innerHTML = getModalMarkup(modalIcon);
    } else {
      closeModal();
    }
  }

  if (state.infoIconName) {
    var infoIcon = window._icons[state.infoIconName];
    if (infoIcon) {
      infoModalBodyEl.innerHTML = getInfoModalMarkup(infoIcon);
    } else {
      closeInfoModal();
    }
  }
}

function renderTabs() {
  var total = 0;
  CATEGORY_ORDER.forEach(function (categoryName) {
    total += (categories[categoryName] || []).length;
  });

  var html = '<button class="tab active" type="button" data-cat="all">All icons (' + total + ")</button>";
  CATEGORY_ORDER.forEach(function (categoryName) {
    var count = (categories[categoryName] || []).length;
    if (!count) return;
    html += '<button class="tab" type="button" data-cat="' + escapeHtml(categoryName) + '">' + escapeHtml(categoryName) + " (" + count + ")</button>";
  });
  tabsEl.innerHTML = html;
}

function renderStats(summary) {
  document.getElementById("stats").innerHTML =
    '<div class="stats-list">' +
      '<div class="stats-item"><span class="stats-dot"></span><span class="stats-label">Total icons</span><b>' + summary.total + '</b></div>' +
      '<div class="stats-item"><span class="stats-dot"></span><span class="stats-label">Shared variants</span><b>' + summary.both + '</b></div>' +
      '<div class="stats-item"><span class="stats-dot"></span><span class="stats-label">Categories</span><b>' + summary.categories + '</b></div>' +
    '</div>';
}

function getModalMarkup(icon) {
  var tags = [];
  if (icon.reg) tags.push('<div class="modal-tag">Regular</div>');
  if (icon.fill) tags.push('<div class="modal-tag">Filled</div>');
  tags.push('<div class="modal-tag">' + escapeHtml(guessCategory(icon.name)) + "</div>");

  return (
    '<div class="modal-layout">' +
      '<div class="modal-stage">' +
        buildGlyphMarkup(icon, "modal-glyphs") +
      "</div>" +
      '<div class="modal-sidebar">' +
        '<div class="modal-heading">' +
          '<p class="meta-kicker">Large Preview</p>' +
          '<h3 id="iconModalTitle">' + escapeHtml(icon.name) + "</h3>" +
          '<p class="modal-copy">Full-scale inspection view for BuilderIcons. Use this panel when you want a clear read on the silhouette, spacing, and weight of the selected glyph.</p>' +
        "</div>" +
        '<div class="modal-tags">' + tags.join("") + "</div>" +
        '<div class="modal-actions">' +
          '<button class="modal-action primary" type="button" data-copy-name="' + escapeHtml(icon.name) + '">Copy name</button>' +
          '<button class="modal-action modal-action-icon" type="button" data-open-info="' + escapeHtml(icon.name) + '" aria-label="Open code info" title="Open code info">&lt;/&gt;</button>' +
          '<button class="modal-action" type="button" data-download-png="' + escapeHtml(icon.name) + '" data-download-variant="' + getShownVariant(icon) + '">Download PNG</button>' +
          '<button class="modal-action" type="button" data-download-svg="' + escapeHtml(icon.name) + '" data-download-variant="' + getShownVariant(icon) + '">Download SVG</button>' +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

function getInfoModalMarkup(icon) {
  var shownVariant = getShownVariant(icon);
  var shownCodepoint = shownVariant === "fill" ? icon.fill : icon.reg;
  if (!shownCodepoint) shownCodepoint = icon.reg || icon.fill;

  return (
    '<div class="info-layout">' +
      '<div>' +
        '<p class="meta-kicker">Code Details</p>' +
        '<h3 id="iconInfoModalTitle">' + escapeHtml(icon.name) + '</h3>' +
        '<p class="info-copy">Compact reference for copying the currently visible codepoint values.</p>' +
      '</div>' +
      '<div class="info-pairs">' +
        '<div class="info-pair">' +
          '<div class="info-label">Hex</div>' +
          '<div class="info-value">' + cpToHex(shownCodepoint) + '</div>' +
          '<button class="info-copy-btn" type="button" data-copy-code="' + escapeHtml(cpToHex(shownCodepoint)) + '">Copy</button>' +
        '</div>' +
        '<div class="info-pair">' +
          '<div class="info-label">Unicode</div>' +
          '<div class="info-value">' + cpToUnicode(shownCodepoint) + '</div>' +
          '<button class="info-copy-btn" type="button" data-copy-code="' + escapeHtml(cpToUnicode(shownCodepoint)) + '">Copy</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function getImplementationModalMarkup() {
  var implementationSource =
    '--// BuilderIcons font\n' +
    'local BuilderIconsFont = "rbxasset://LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons/BuilderIcons.json"\n\n' +
    '--// Set the variant (regular or filled)\n' +
    'local Filled = false\n' +
    'local FontWeight = if Filled then Enum.FontWeight.Bold else Enum.FontWeight.Regular\n\n' +
    '--// Create the font\n' +
    'local BuilderIconsFontFace = Font.new(BuilderIconsFont, FontWeight, Enum.FontStyle.Normal)\n\n' +
    '--// Mock TextLabel\n' +
    'local TextLabel = Instance.new("TextLabel")\n' +
    'TextLabel.FontFace = BuilderIconsFontFace\n' +
    'TextLabel.Text = ""\n' +
    'TextLabel.RichText = ""\n\n' +
    '--// Example 1\n' +
    'TextLabel.Text = "This is an icon: paper-airplane" -- this will replace "paper-airplane" with the paper airplane icon.\n\n' +
    '--// Example 2\n' +
    '--// If you wish to use rich text instead, so that not every text gets replaced with icons, do the following:\n' +
    'TextLabel.Text = `<font family={BuilderIconsFont}>paper-airplane</font> paper-airplane`\n\n' +
    '--// Only the text within the </font> tag will be replaced by an icon.\n' +
    '--// (assuming the font of the text label is somethiing other than the BuilderIcons font)';

  return (
    '<div class="implementation-layout">' +
      '<div>' +
        '<p class="meta-kicker">Implementation</p>' +
        '<h3 id="implementationModalTitle">Luau Example</h3>' +
        '<p class="implementation-copy">Reference snippet for using the BuilderIcons font directly in Roblox UI, including a plain text replacement path and a RichText path.</p>' +
      '</div>' +
      '<div class="code-block">' +
        '<button class="code-copy-btn" type="button" data-copy-implementation="' + escapeHtml(implementationSource) + '" aria-label="Copy implementation code" title="Copy implementation code">⧉</button>' +
        '<pre><code>' +
        '<span class="token-comment">--// BuilderIcons font</span>\n' +
        '<span class="token-keyword">local</span> <span class="token-name">BuilderIconsFont</span> = <span class="token-string">"rbxasset://LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons/BuilderIcons.json"</span>\n\n' +
        '<span class="token-comment">--// Set the variant (regular or filled)</span>\n' +
        '<span class="token-keyword">local</span> <span class="token-name">Filled</span> = <span class="token-boolean">false</span>\n' +
        '<span class="token-keyword">local</span> <span class="token-name">FontWeight</span> = <span class="token-keyword">if</span> <span class="token-name">Filled</span> <span class="token-keyword">then</span> <span class="token-name">Enum</span>.<span class="token-name">FontWeight</span>.<span class="token-name">Bold</span> <span class="token-keyword">else</span> <span class="token-name">Enum</span>.<span class="token-name">FontWeight</span>.<span class="token-name">Regular</span>\n\n' +
        '<span class="token-comment">--// Create the font</span>\n' +
        '<span class="token-keyword">local</span> <span class="token-name">BuilderIconsFontFace</span> = <span class="token-name">Font</span>.<span class="token-name">new</span>(<span class="token-name">BuilderIconsFont</span>, <span class="token-name">FontWeight</span>, <span class="token-name">Enum</span>.<span class="token-name">FontStyle</span>.<span class="token-name">Normal</span>)\n\n' +
        '<span class="token-comment">--// Mock TextLabel</span>\n' +
        '<span class="token-keyword">local</span> <span class="token-name">TextLabel</span> = <span class="token-name">Instance</span>.<span class="token-name">new</span>(<span class="token-string">"TextLabel"</span>)\n' +
        '<span class="token-name">TextLabel</span>.<span class="token-name">FontFace</span> = <span class="token-name">BuilderIconsFontFace</span>\n' +
        '<span class="token-name">TextLabel</span>.<span class="token-name">Text</span> = <span class="token-string">""</span>\n' +
        '<span class="token-name">TextLabel</span>.<span class="token-name">RichText</span> = <span class="token-string">""</span>\n\n' +
        '<span class="token-comment">--// Example 1</span>\n' +
        '<span class="token-name">TextLabel</span>.<span class="token-name">Text</span> = <span class="token-string">"This is an icon: paper-airplane"</span> <span class="token-comment">-- this will replace "paper-airplane" with the paper airplane icon.</span>\n\n' +
        '<span class="token-comment">--// Example 2</span>\n' +
        '<span class="token-comment">--// If you wish to use rich text instead, so that not every text gets replaced with icons, do the following:</span>\n' +
        '<span class="token-name">TextLabel</span>.<span class="token-name">Text</span> = <span class="token-string">`&lt;font family={BuilderIconsFont}&gt;paper-airplane&lt;/font&gt; paper-airplane`</span>\n\n' +
        '<span class="token-comment">--// Only the text within the &lt;/font&gt; tag will be replaced by an icon.</span>\n' +
        '<span class="token-comment">--// (assuming the font of the text label is somethiing other than the BuilderIcons font)</span>' +
      '</code></pre></div>' +
    '</div>'
  );
}

function openModal(iconName, triggerEl) {
  var icon = window._icons[iconName];
  if (!icon) return;

  state.modalIconName = iconName;
  state.modalTrigger = triggerEl || null;
  modalBodyEl.innerHTML = getModalMarkup(icon);
  modalEl.classList.add("is-open");
  modalEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalEl.classList.remove("is-open");
  modalEl.setAttribute("aria-hidden", "true");
  modalBodyEl.innerHTML = "";
  if (!infoModalEl.classList.contains("is-open")) {
    document.body.style.overflow = "";
  }
  state.modalIconName = null;
  if (state.modalTrigger && typeof state.modalTrigger.focus === "function") {
    state.modalTrigger.focus();
  }
  state.modalTrigger = null;
}

function openInfoModal(iconName, triggerEl) {
  var icon = window._icons[iconName];
  if (!icon) return;

  state.infoIconName = iconName;
  state.infoTrigger = triggerEl || null;
  infoModalBodyEl.innerHTML = getInfoModalMarkup(icon);
  infoModalEl.classList.add("is-open");
  infoModalEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeInfoModal() {
  infoModalEl.classList.remove("is-open");
  infoModalEl.setAttribute("aria-hidden", "true");
  infoModalBodyEl.innerHTML = "";
  if (!modalEl.classList.contains("is-open")) {
    document.body.style.overflow = "";
  }
  state.infoIconName = null;
  if (state.infoTrigger && typeof state.infoTrigger.focus === "function") {
    state.infoTrigger.focus();
  }
  state.infoTrigger = null;
}

function openImplementationModal() {
  implementationModalBodyEl.innerHTML = getImplementationModalMarkup();
  implementationModalEl.classList.add("is-open");
  implementationModalEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeImplementationModal() {
  implementationModalEl.classList.remove("is-open");
  implementationModalEl.setAttribute("aria-hidden", "true");
  implementationModalBodyEl.innerHTML = "";
  if (!modalEl.classList.contains("is-open") && !infoModalEl.classList.contains("is-open")) {
    document.body.style.overflow = "";
  }
}

function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeToggleEl.setAttribute("aria-pressed", String(theme === "light"));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (err) {}
}

function initTheme() {
  var storedTheme = null;
  try {
    storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (err) {}

  if (storedTheme !== "dark" && storedTheme !== "light") {
    storedTheme = "dark";
  }
  setTheme(storedTheme);
}

function bindEvents() {
  tabsEl.addEventListener("click", function (event) {
    var tab = event.target.closest("[data-cat]");
    if (!tab) return;

    tabsEl.querySelectorAll(".tab").forEach(function (button) {
      button.classList.remove("active");
    });

    tab.classList.add("active");
    activeTab = tab.getAttribute("data-cat");
    render();
  });

  variantToggleEl.querySelectorAll("button").forEach(function (button) {
    button.addEventListener("click", function () {
      variantToggleEl.querySelectorAll("button").forEach(function (item) {
        item.classList.remove("active");
      });
      button.classList.add("active");
      activeVariant = button.getAttribute("data-v");
      render();
    });
  });

  themeToggleEl.addEventListener("click", function () {
    var nextTheme = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  });

  implementationToggleEl.addEventListener("click", function () {
    openImplementationModal();
  });

  searchInput.addEventListener("input", render);

  contentEl.addEventListener("click", function (event) {
    var toggle = event.target.closest("[data-category-toggle]");
    if (toggle) {
      var categoryName = toggle.getAttribute("data-category-toggle");
      collapsedSections[categoryName] = !collapsedSections[categoryName];
      render();
      return;
    }

    var copyNameButton = event.target.closest("[data-copy-name]");
    if (copyNameButton) {
      copyText(copyNameButton.getAttribute("data-copy-name"), 'Copied name for "' + copyNameButton.getAttribute("data-copy-name") + '"');
      return;
    }

    var openInfoButton = event.target.closest("[data-open-info]");
    if (openInfoButton) {
      openInfoModal(openInfoButton.getAttribute("data-open-info"), openInfoButton);
      return;
    }

    var openModalButton = event.target.closest("[data-open-modal]");
    if (openModalButton) {
      openModal(openModalButton.getAttribute("data-open-modal"), openModalButton);
      return;
    }

    var card = event.target.closest(".icon-card");
    if (!card) return;

    var iconName = card.getAttribute("data-icon-name");
    copyText(iconName, 'Copied name for "' + iconName + '"');
    state.activeIconName = iconName;
    updateCardStates();
  });

  contentEl.addEventListener("mouseover", function (event) {
    var card = event.target.closest(".icon-card");
    if (!card) return;
    state.activeIconName = card.getAttribute("data-icon-name");
    updateCardStates();
  });

  contentEl.addEventListener("mouseout", function (event) {
    var card = event.target.closest(".icon-card");
    if (!card || card.contains(event.relatedTarget)) return;
    state.activeIconName = null;
    updateCardStates();
  });

  contentEl.addEventListener("focusin", function (event) {
    var card = event.target.closest(".icon-card");
    if (!card) return;
    state.activeIconName = card.getAttribute("data-icon-name");
    updateCardStates();
  });

  contentEl.addEventListener("focusout", function (event) {
    var card = event.target.closest(".icon-card");
    if (!card || card.contains(event.relatedTarget)) return;
    state.activeIconName = null;
    updateCardStates();
  });

  modalEl.addEventListener("click", function (event) {
    if (event.target.closest("[data-modal-close]")) {
      closeModal();
      return;
    }

    var copyNameButton = event.target.closest("[data-copy-name]");
    if (copyNameButton) {
      copyText(copyNameButton.getAttribute("data-copy-name"), 'Copied name for "' + copyNameButton.getAttribute("data-copy-name") + '"');
      return;
    }

    var openInfoButton = event.target.closest("[data-open-info]");
    if (openInfoButton) {
      openInfoModal(openInfoButton.getAttribute("data-open-info"), openInfoButton);
      return;
    }

    var pngButton = event.target.closest("[data-download-png]");
    if (pngButton) {
      downloadIconPNG(window._icons[pngButton.getAttribute("data-download-png")], pngButton.getAttribute("data-download-variant"));
      return;
    }

    var svgButton = event.target.closest("[data-download-svg]");
    if (svgButton) {
      downloadIconSVG(window._icons[svgButton.getAttribute("data-download-svg")], svgButton.getAttribute("data-download-variant"));
    }
  });

  infoModalEl.addEventListener("click", function (event) {
    if (event.target.closest("[data-info-close]")) {
      closeInfoModal();
      return;
    }

    var copyCodeButton = event.target.closest("[data-copy-code]");
    if (copyCodeButton) {
      copyText(copyCodeButton.getAttribute("data-copy-code"), 'Copied value "' + copyCodeButton.getAttribute("data-copy-code") + '"');
    }
  });

  implementationModalEl.addEventListener("click", function (event) {
    if (event.target.closest("[data-implementation-close]")) {
      closeImplementationModal();
      return;
    }

    var copyImplementationButton = event.target.closest("[data-copy-implementation]");
    if (copyImplementationButton) {
      copyText(copyImplementationButton.getAttribute("data-copy-implementation"), "Copied implementation snippet");
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && implementationModalEl.classList.contains("is-open")) {
      closeImplementationModal();
      return;
    }

    if (event.key === "Escape" && infoModalEl.classList.contains("is-open")) {
      closeInfoModal();
      return;
    }

    if (event.key === "Escape" && modalEl.classList.contains("is-open")) {
      closeModal();
      return;
    }

    if (event.key === "Escape") {
      state.activeIconName = null;
      updateCardStates();
    }
  });
}

async function init() {
  try {
    initTheme();
    bindEvents();

    var responses = await Promise.all([fetch(FONT_URLS.reg), fetch(FONT_URLS.fill)]);
    if (!responses[0].ok || !responses[1].ok) {
      throw new Error("Font download failed");
    }

    var buffers = await Promise.all([responses[0].arrayBuffer(), responses[1].arrayBuffer()]);
    fontObjects.reg = opentype.parse(buffers[0]);
    fontObjects.fill = opentype.parse(buffers[1]);

    var regIcons = Object.assign({}, extractCmapIcons(fontObjects.reg), extractLigatures(fontObjects.reg));
    var fillIcons = Object.assign({}, extractCmapIcons(fontObjects.fill), extractLigatures(fontObjects.fill));
    var allNames = Array.from(new Set(Object.keys(regIcons).concat(Object.keys(fillIcons)))).sort();

    var categorized = {};
    CATEGORY_ORDER.forEach(function (categoryName) {
      categorized[categoryName] = [];
      collapsedSections[categoryName] = false;
    });

    window._icons = {};

    allNames.forEach(function (name) {
      var icon = { name: name };
      if (regIcons[name]) icon.reg = regIcons[name];
      if (fillIcons[name]) icon.fill = fillIcons[name];

      var categoryName = guessCategory(name);
      categorized[categoryName].push(icon);
      window._icons[name] = icon;
    });

    categories = categorized;

    var both = 0;
    allNames.forEach(function (name) {
      if (regIcons[name] && fillIcons[name]) {
        both += 1;
      }
    });

    renderStats({
      total: allNames.length,
      both: both,
      categories: CATEGORY_ORDER.filter(function (categoryName) {
        return categorized[categoryName] && categorized[categoryName].length;
      }).length
    });

    renderTabs();
    render();
  } catch (err) {
    contentEl.innerHTML = '<div class="no-results" style="color:#ff8e88">Failed to load icons: ' + escapeHtml(err.message) + "</div>";
  }
}

init();