(() => {
  "use strict";

  const get = (id) => document.getElementById(id);
  const geo = window.ATLAS_GEOGRAPHY;
  const data = window.ATLAS_PROJECTS;
  const projects = [...(data?.projects ?? []), ...(window.ATLAS_OTHER_PROJECTS ?? [])];
  const map = get("map");
  const surface = get("map-surface");
  const markers = get("markers");
  const list = get("project-list");
  const detail = get("project-detail");
  const search = get("project-search");
  const fitResults = get("fit-results");
  const clearFilters = get("clear-filters");
  const statusButtons = [...document.querySelectorAll("[data-filter]")];
  const maxZoom = 16;
  const svgNS = "http://www.w3.org/2000/svg";
  const number = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
  const statusLabels = { operating: "Operating", development: "In development", other: "Other status" };
  const technologies = {
    hydro: ["Hydropower", "hydro"], solar: ["Solar", "sun"], bioenergy: ["Bioenergy", "leaf"],
    wind: ["Wind + solar", "wind"], thermal: ["Thermal", "bolt"]
  };
  const solarSources = {
    operating: "https://doed.gov.np/pages/powerplantssolar/",
    development: "https://doed.gov.np/pages/clsolar/"
  };
  const sources = {
    operating: "https://doed.gov.np/pages/powerplantsmorethan1/",
    development: "https://doed.gov.np/pages/clhydromorethan1/",
    construction: "https://giwmscdnone.gov.np/media/pdf_upload/%E0%A4%AA%E0%A4%B0%E0%A4%BF%E0%A4%AF%E0%A5%8B%E0%A4%9C%E0%A4%A8%E0%A4%BE%E0%A4%B9%E0%A4%B0%E0%A5%81%E0%A4%95%E0%A5%8B%20%E0%A4%B5%E0%A4%BF%E0%A4%B5%E0%A4%B0%E0%A4%A3%20pdf_24mtewu.pdf"
  };

  let filter = "all";
  const technology = get("technology");
  let matches = projects;
  let selection = null;
  let selectionTrigger = null;
  let terrain = true;
  let frame = 0;
  let drag = null;
  let width = 0;
  let height = 0;
  let scaleX = 1;
  let scaleY = 1;
  let zoom = 1;
  let center = geo ? [geo.width / 2, geo.height / 2] : [0, 0];

  function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  }

  function svg(tag, attrs = {}) {
    const element = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  }

  function icon(name) {
    const element = svg("svg", { "aria-hidden": "true" });
    element.append(svg("use", { href: "#" + name }));
    return element;
  }

  function capacity(project) {
    return project.capacityLabel || number.format(project.mw) + " MW";
  }

  function districts(project) {
    const values = Array.from(project.area.matchAll(/\(([^()]+)\)/g), ([, name]) => name.trim());
    return [...new Set(values)].join(" · ") || project.area || project.river || "Nepal";
  }

  function searchKey(value) {
    return value.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  function matchScore(project, query) {
    if (project.searchName === query) return 3;
    if (project.searchName.startsWith(query)) return 2;
    return project.searchName.includes(query) ? 1 : 0;
  }

  function summary() {
    const mapped = projects.filter((project) => project.point).length;
    const counts = [[mapped, "Mapped projects"], [projects.length - mapped, "Directory only"]];
    get("overview").replaceChildren(...counts.map(([count, label]) => {
      const metric = node("div", "metric");
      metric.append(node("strong", "", data ? number.format(count) : "—"), node("small", "", label));
      return metric;
    }));
    if (data) {
      const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(data.date + "T00:00:00Z"));
      get("snapshot").textContent = "DoED registers accessed " + date + ". Hydropower coverage is for projects over 1 MW. Solar and cogeneration use their own registers. Wind–solar and thermal coverage is limited to the cited records.";
    }
  }

  function renderList() {
    get("result-count").textContent = data ? number.format(matches.length) + (matches.length === 1 ? " project" : " projects") : "";
    fitResults.disabled = !matches.some((project) => project.point);
    list.replaceChildren();
    if (!matches.length) {
      list.append(node("p", "empty", data ? "No projects match these filters." : "Project records could not be loaded."));
      return;
    }
    const rows = document.createDocumentFragment();
    for (const project of matches) {
      const row = node("button", "project-row");
      row.type = "button";
      row.dataset.projectId = project.id;
      if (selection === project) row.setAttribute("aria-current", "true");
      row.setAttribute("aria-label", [project.name, project.stage || statusLabels[project.status], capacity(project)].join(", "));
      const text = node("span");
      const [label, glyph] = technologies[project.tech];
      const symbol = node("span", "row-glyph tech-" + project.tech + " " + project.status);
      symbol.append(icon(glyph));
      const location = districts(project);
      const subtitle = [label, location === "Nepal" ? "" : location, project.stage || statusLabels[project.status],
        project.point ? "" : "Directory only"].filter(Boolean).join(" · ");
      text.append(node("strong", "", project.name), node("small", "", subtitle));
      row.append(symbol, text, node("strong", "capacity", capacity(project)));
      if (project.capacityLabel) row.classList.add("hybrid-row");
      row.addEventListener("click", () => {
        chooseProject(project, row, true);
        if (window.matchMedia("(max-width: 740px)").matches) {
          get("map").scrollIntoView({ block: "start" });
        }
      });
      rows.append(row);
    }
    list.append(rows);
  }

  function updateFilters() {
    const query = searchKey(search.value);
    const words = query ? query.split(" ") : [];
    matches = projects.filter((project) => (filter === "all" || project.status === filter)
      && (technology.value === "all" || project.tech === technology.value)
      && words.every((word) => project.searchText.includes(word)));
    if (query) matches.sort((a, b) => matchScore(b, query) - matchScore(a, query));
    if (selection && !matches.includes(selection)) closeDetail(false);
    clearFilters.hidden = !search.value && filter === "all" && technology.value === "all";
    renderList();
    list.scrollTop = 0;
    redraw();
  }

  function setStatus(value) {
    filter = value;
    for (const button of statusButtons) button.setAttribute("aria-pressed", button.dataset.filter === value);
    updateFilters();
  }

  function closeDetail(restoreFocus) {
    const priorProject = selection;
    selection = null;
    detail.hidden = true;
    list.querySelector("[aria-current]")?.removeAttribute("aria-current");
    if (restoreFocus) {
      if (selectionTrigger?.isConnected) selectionTrigger.focus();
      else {
        const pin = [...markers.children].find((marker) => marker.dataset.marker === priorProject?.id);
        (pin ?? map).focus({ preventScroll: true });
      }
    }
    selectionTrigger = null;
    redraw();
  }

  function chooseProject(project, trigger, focusMap) {
    selection = project;
    selectionTrigger = trigger;
    detail.replaceChildren();
    const close = node("button", "icon-button");
    close.type = "button";
    close.setAttribute("aria-label", "Close project");
    close.append(icon("close"));
    close.addEventListener("click", () => closeDetail(true));
    const status = node("span", "status-pill");
    status.append(icon(technologies[project.tech][1]), document.createTextNode(project.stage || statusLabels[project.status]));
    const title = node("h2", "", project.name);
    const facts = node("dl", "facts");
    const values = [
      ["Rated capacity", capacity(project)], ["Energy source", technologies[project.tech][0]], ["River", project.river],
      ["DoED licence", /^\d/.test(project.license) && !project.license.includes("_") ? project.license : ""],
      project.status === "operating" ? ["Commercial operation (BS)", project.cod] : ["Licence issued (BS)", project.date],
      ["Map location", project.point ? project.lat.toFixed(3) + "° N, " + project.lon.toFixed(3) + "° E" : "Coordinates unavailable in source"]
    ];
    for (const [label, value] of values) {
      if (!value || value === "0000-00-00") continue;
      const fact = node("div");
      fact.append(node("dt", "", label), node("dd", "", value));
      facts.append(fact);
    }
    const official = project.source || (project.tech === "solar" ? solarSources[project.status] : sources[project.status]);
    const isRegister = official.includes("doed.gov.np/");
    const source = node("a", "source-project", isRegister ? "DoED project record" : "Original project source");
    source.href = isRegister ? official + "#:~:text=" + encodeURIComponent(project.name).replaceAll("-", "%2D") : official;
    source.target = "_blank";
    source.rel = "noopener";
    source.append(icon("external"));
    const links = node("div", "project-links");
    links.append(source);
    if (project.point) {
      const google = node("a", "source-project", "Open area in Google Maps");
      google.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(project.lat + "," + project.lon);
      google.target = "_blank";
      google.rel = "noopener";
      google.append(icon("external"));
      links.append(google);
    }
    const permalink = new URL(window.location.href);
    permalink.searchParams.set("project", project.id);
    permalink.hash = "project-map";
    const share = node("a", "source-project", "Project permalink");
    share.href = permalink.href;
    links.append(share);
    detail.append(close, status, title, node("p", "", districts(project)), facts, links);
    if (project.ibnConstruction) {
      const confirmation = node("a", "source-project", "Investment Board Nepal report");
      confirmation.href = sources.construction;
      confirmation.target = "_blank";
      confirmation.rel = "noopener";
      confirmation.append(icon("external"));
      detail.append(node("p", "", "Listed as under construction by Investment Board Nepal."), confirmation);
    } else if (project.status === "development") detail.append(node("p", "", "Construction licence listed by DoED."));
    detail.hidden = false;
    list.querySelector("[aria-current]")?.removeAttribute("aria-current");
    list.querySelector('[data-project-id="' + project.id + '"]')?.setAttribute("aria-current", "true");
    if (focusMap && project.point) {
      zoom = Math.max(zoom, 1.8);
      center = [...project.point];
    }
    redraw();
    detail.focus({ preventScroll: true });
  }

  function mercatorY(lat) {
    return (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2;
  }

  function projectPoint(lon, lat) {
    const [west, south, east, north] = geo.bounds;
    const top = mercatorY(north);
    return [(lon - west) / (east - west) * geo.width, (mercatorY(lat) - top) / (mercatorY(south) - top) * geo.height];
  }

  function drawBasemap() {
    surface.style.width = geo.width + "px";
    surface.style.height = geo.height + "px";
    const basemap = get("basemap");
    basemap.setAttribute("viewBox", "0 0 " + geo.width + " " + geo.height);
    const path = geo.rings.map((ring) => "M" + ring.map((point) => point.join(",")).join("L") + "Z").join("");
    const relief = svg("image", { class: "relief", href: "relief.webp", width: geo.width, height: geo.height });
    relief.addEventListener("error", () => {
      terrain = false;
      get("terrain-toggle").disabled = true;
      setTerrain();
    });
    basemap.append(
      svg("rect", { fill: "#d5cdb2", width: geo.width, height: geo.height }),
      svg("path", { d: path, class: "flat-country", fill: "#b3b68d", "fill-rule": "evenodd" }),
      relief
    );
    const grid = svg("g", { class: "map-grid" });
    for (let lon = 80; lon <= 88; lon++) {
      const [x] = projectPoint(lon, 28);
      grid.append(svg("line", { x1: x, x2: x, y1: 0, y2: geo.height }));
    }
    for (let lat = 26; lat <= 30; lat++) {
      const [, y] = projectPoint(84, lat);
      grid.append(svg("line", { x1: 0, x2: geo.width, y1: y, y2: y }));
    }
    basemap.append(grid, svg("path", { class: "country-boundary", d: path }));
    for (const [label, lon, lat] of [["CHINA", 86.20, 29.93], ["INDIA", 82.14, 26.94], ["NEPAL", 83.68, 28.85]]) {
      const [x, y] = projectPoint(lon, lat);
      const word = svg("text", { x, y, class: "map-word" + (label === "NEPAL" ? " country-label" : "") });
      word.textContent = label;
      basemap.append(word);
    }
  }

  function resize() {
    width = map.clientWidth;
    height = map.clientHeight;
    scaleX = width / geo.width;
    scaleY = Math.min(height / geo.height, scaleX * 1.67);
    redraw();
  }

  function fit() {
    zoom = 1;
    center = [geo.width / 2, geo.height / 2];
    redraw();
  }

  function fitMatchingProjects() {
    const points = matches.flatMap((project) => project.point ? [project.point] : []);
    if (!points.length || !width || !height) return;
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const west = Math.min(...xs);
    const east = Math.max(...xs);
    const north = Math.min(...ys);
    const south = Math.max(...ys);
    center = [(west + east) / 2, (north + south) / 2];
    zoom = Math.max(1, Math.min(6, width * .78 / ((east - west) * scaleX),
      height * .68 / ((south - north) * scaleY)));
    redraw();
  }

  function setZoom(next, x = width / 2, y = height / 2) {
    const target = Math.max(1, Math.min(maxZoom, next));
    if (target === zoom) return;
    center[0] += (x - width / 2) / scaleX * (1 / zoom - 1 / target);
    center[1] += (y - height / 2) / scaleY * (1 / zoom - 1 / target);
    zoom = target;
    redraw();
  }

  function redraw() {
    if (!geo || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (width && height) renderMap();
    });
  }

  function renderMap() {
    const sx = scaleX * zoom;
    const sy = scaleY * zoom;
    const insetX = Math.min(geo.width / 2, width / (2 * sx));
    const insetY = Math.min(geo.height / 2, height / (2 * sy));
    center[0] = Math.min(geo.width - insetX, Math.max(insetX, center[0]));
    center[1] = Math.min(geo.height - insetY, Math.max(insetY, center[1]));
    const tx = width / 2 - center[0] * sx;
    const ty = height / 2 - center[1] * sy;
    surface.style.transform = "matrix(" + [sx, 0, 0, sy, tx, ty].join(",") + ")";
    get("zoom-in").disabled = zoom >= maxZoom;
    get("zoom-out").disabled = zoom <= 1;

    const cell = zoom < 2 ? 43 : zoom < 6 ? 34 : 22;
    const groups = new Map();
    for (const project of matches) {
      if (!project.point) continue;
      const x = project.point[0] * sx + tx;
      const y = project.point[1] * sy + ty;
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
      const key = project === selection ? "selected" : zoom >= maxZoom ? "point-" + project.id
        : Math.floor(x / cell) + "," + Math.floor(y / cell);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ project, x, y });
    }

    const previous = document.activeElement?.dataset.marker;
    const pins = document.createDocumentFragment();
    for (const [key, group] of groups) {
      const { project } = group[0];
      const count = group.length;
      const cluster = count > 1;
      const mixedTech = group.some(({ project: entry }) => entry.tech !== project.tech);
      const mixedStatus = group.some(({ project: entry }) => entry.status !== project.status);
      const marker = node("button", "marker " + (mixedTech ? "tech-mixed" : "tech-" + project.tech)
        + " " + (mixedStatus ? "status-mixed" : project.status)
        + (cluster ? " cluster" : " glyph") + (project === selection ? " selected" : ""), cluster ? count : "");
      if (!cluster) marker.append(icon(technologies[project.tech][1]));
      marker.type = "button";
      marker.dataset.marker = cluster ? "cell-" + key : project.id;
      const x = group.reduce((sum, entry) => sum + entry.x, 0) / count;
      const y = group.reduce((sum, entry) => sum + entry.y, 0) / count;
      marker.style.left = x + "px";
      marker.style.top = y + "px";
      marker.title = cluster ? count + " projects · Zoom in" : [project.name, statusLabels[project.status], capacity(project)].join(" · ");
      marker.setAttribute("aria-label", marker.title);
      marker.addEventListener("click", () => {
        if (cluster) {
          center = [(x - tx) / sx, (y - ty) / sy];
          setZoom(zoom * 2);
          map.focus({ preventScroll: true });
        } else chooseProject(project, marker, false);
      });
      pins.append(marker);
    }
    markers.replaceChildren(pins);
    if (previous) {
      const active = [...markers.children].find((marker) => marker.dataset.marker === previous);
      (active ?? map).focus({ preventScroll: true });
    }
  }

  function setTerrain() {
    surface.classList.toggle("flat", !terrain);
    get("terrain-toggle").setAttribute("aria-pressed", terrain);
    get("map-mode").textContent = terrain ? "SHADED RELIEF" : "BOUNDARY MAP";
  }

  function mapInput() {
    get("zoom-in").addEventListener("click", () => setZoom(zoom * 1.55));
    get("zoom-out").addEventListener("click", () => setZoom(zoom / 1.55));
    get("reset-map").addEventListener("click", fit);
    get("terrain-toggle").addEventListener("click", () => { terrain = !terrain; setTerrain(); });
    map.addEventListener("wheel", (event) => {
      if (event.ctrlKey || event.metaKey || !map.matches(":focus-within")) return;
      event.preventDefault();
      const rect = map.getBoundingClientRect();
      setZoom(zoom * Math.exp(Math.max(-160, Math.min(160, -event.deltaY)) * .004), event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });
    map.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button") || drag) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      if (event.pointerType !== "touch") map.focus({ preventScroll: true });
      map.setPointerCapture(event.pointerId);
      map.classList.add("dragging");
    });
    map.addEventListener("pointermove", (event) => {
      if (drag?.id !== event.pointerId) return;
      center[0] -= (event.clientX - drag.x) / (scaleX * zoom);
      center[1] -= (event.clientY - drag.y) / (scaleY * zoom);
      drag.x = event.clientX;
      drag.y = event.clientY;
      redraw();
    });
    map.addEventListener("lostpointercapture", () => {
      drag = null;
      map.classList.remove("dragging");
    });
    map.addEventListener("keydown", (event) => {
      const steps = { ArrowLeft: [-55, 0], ArrowRight: [55, 0], ArrowUp: [0, -55], ArrowDown: [0, 55] };
      if (event.key === "+" || event.key === "=") setZoom(zoom * 1.55);
      else if (event.key === "-") setZoom(zoom / 1.55);
      else if (event.key === "Home") fit();
      else if (steps[event.key]) {
        center[0] += steps[event.key][0] / (scaleX * zoom);
        center[1] += steps[event.key][1] / (scaleY * zoom);
        redraw();
      } else return;
      event.preventDefault();
    });
  }

  const sourcesDialog = get("sources-dialog");
  get("open-sources").addEventListener("click", () => sourcesDialog.showModal());
  get("directory-sources").addEventListener("click", () => sourcesDialog.showModal());
  detail.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetail(true);
  });
  for (const project of projects) {
    project.tech ??= "hydro";
    project.searchName = searchKey(project.name);
    project.searchText = searchKey([project.name, project.river, project.area, technologies[project.tech][0], project.license].join(" "));
    if (geo && Number.isFinite(project.lon) && Number.isFinite(project.lat)) project.point = projectPoint(project.lon, project.lat);
  }
  projects.sort((a, b) => b.mw - a.mw || a.name.localeCompare(b.name));
  summary();
  renderList();
  search.addEventListener("input", updateFilters);
  technology.addEventListener("change", updateFilters);
  for (const button of statusButtons) button.addEventListener("click", () => setStatus(button.dataset.filter));
  clearFilters.addEventListener("click", () => {
    search.value = "";
    technology.value = "all";
    setStatus("all");
    search.focus();
  });
  fitResults.addEventListener("click", () => {
    fitMatchingProjects();
    if (window.matchMedia("(max-width: 740px)").matches) map.scrollIntoView({ block: "start" });
    map.focus({ preventScroll: true });
  });
  if (geo) {
    drawBasemap();
    mapInput();
    new ResizeObserver(resize).observe(map);
  } else {
    get("map-error").hidden = false;
    document.querySelectorAll(".zoom-controls button, #terrain-toggle").forEach((button) => { button.disabled = true; });
  }
  const linkedId = new URLSearchParams(window.location.search).get("project");
  const linkedProject = linkedId && projects.find((project) => project.id === linkedId);
  if (linkedProject) chooseProject(linkedProject, null, true);
})();
