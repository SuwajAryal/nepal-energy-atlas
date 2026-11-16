(() => {
  "use strict";

  const dashboard = document.getElementById("energy-dashboard");
  const report = "https://www.nea.org.np/uploads/shares/td_tender/A%20Year%20In%20Review%20Annual%20Report%202025_2026_compressed.pdf";
  const sources = {
    highlights: ["NEA · p. 148", report + "#page=158"],
    monthly: ["NEA · p. 166", report + "#page=176"],
    trade: ["NEA · p. 158", report + "#page=168"],
    destinations: ["NEA · p. 139", report + "#page=149"],
    capacity: ["NEA · p. 175", report + "#page=185"],
    weather: ["DHM · Seasonal weather", "https://dhm.gov.np/uploads/dhm/climateService/1777360855_cde386661a4216e39437.pdf"],
    allEnergy: ["WECS · table 6.2, p. 84", "https://wecs.gov.np/source/ESR_2024.pdf"]
  };

  // NEA Energy Balance, printed page 166. Values are published whole GWh.
  const months = [
    // BS month, Gregorian span, IPP, NEA subsidiary, run-of-river, storage, NEA solar, imports, exports
    ["Shrawan", "Jul–Aug 2025", 1295, 417, 234, 14, 3, 3, 534],
    ["Bhadra", "Aug–Sep 2025", 1323, 401, 260, 4, 3, 1, 587],
    ["Ashwin", "Sep–Oct 2025", 1254, 463, 245, 1, 3, 1, 708],
    ["Kartik", "Oct–Nov 2025", 1065, 393, 255, 1, 2, 0, 660],
    ["Mangshir", "Nov–Dec 2025", 877, 279, 243, 1, 2, 1, 341],
    ["Poush", "Dec 2025–Jan 2026", 688, 230, 203, 2, 2, 124, 40],
    ["Magh", "Jan–Feb 2026", 527, 174, 160, 1, 2, 252, 1],
    ["Falgun", "Feb–Mar 2026", 501, 160, 134, 3, 3, 273, 13],
    ["Chaitra", "Mar–Apr 2026", 571, 173, 165, 5, 3, 264, 21],
    ["Baishakh", "Apr–May 2026", 770, 260, 217, 31, 3, 128, 140],
    ["Jestha", "May–Jun 2026", 960, 452, 254, 19, 3, 81, 312],
    ["Ashadh", "Jun–Jul 2026", 1339, 519, 291, 9, 3, 27, 582]
  ].map(([label, span, ipp, subsidiary, river, storage, solar, imports, exports]) => (
    { label, span, generation: ipp + subsidiary + river + storage + solar, imports, exports }
  ));

  // Each BS reporting month is grouped by the Gregorian month in which it starts.
  const seasons = [
    ["Monsoon", "Shrawan–Ashwin and Ashadh", [0, 1, 2, 11]],
    ["Post-monsoon", "Kartik–Mangshir", [3, 4]],
    ["Winter", "Poush–Falgun", [5, 6, 7]],
    ["Pre-monsoon", "Chaitra–Jestha", [8, 9, 10]]
  ].map(([label, span, indices]) => indices.reduce((total, index) => {
    for (const key of ["generation", "imports", "exports"]) total[key] += months[index][key];
    return total;
  }, { label, span, generation: 0, imports: 0, exports: 0 }));

  // NEA annual trade series, printed page 158. Fiscal year labels use the end year.
  const years = [
    [2017, 2175, 3], [2018, 2582, 3], [2019, 2813, 35], [2020, 1729, 107],
    [2021, 2806, 38], [2022, 1543, 494], [2023, 1833, 1346], [2024, 1895, 1946],
    [2025, 1681, 2380], [2026, 1171, 3965]
  ].map(([end, imports, exports]) => ({
    label: String(end), span: "FY " + (end - 1) + "/" + String(end).slice(-2) + (end === 2026 ? " · provisional" : ""), imports, exports
  }));
  const annualDomestic = [["NEA plants", 2803], ["NEA subsidiaries", 3826], ["Independent producers", 10825]];
  const annualGeneration = annualDomestic.reduce((total, [, gwh]) => total + gwh, 0);
  const latestTrade = years.at(-1);
  const latestMonth = months.at(-1);
  const series = { generation: "Domestic generation", imports: "Imports", exports: "Exports" };
  const format = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });

  function element(tag, name, text) {
    const item = document.createElement(tag);
    if (name) item.className = name;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function citation(key) {
    const [label, url] = sources[key];
    const link = element("a", "citation", label + " ↗");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    return link;
  }

  function panel(title, heading = "h3") {
    const item = element("section", "energy-card");
    item.append(element(heading, "", title));
    return item;
  }

  function metric(label, value, unit, source, detail) {
    const item = element("article", "energy-metric");
    const figure = element("strong", "", format.format(value));
    figure.append(element("span", "", unit));
    item.append(element("h3", "", label), figure, element("p", "", detail), citation(source));
    return item;
  }

  function factList(values, unit, source) {
    const list = element("dl", "energy-facts");
    for (const [label, value] of values) {
      const row = element("div");
      const figure = element("dd", "", format.format(value) + " " + unit);
      figure.append(citation(source));
      row.append(element("dt", "", label), figure);
      list.append(row);
    }
    return list;
  }

  const context = element("p", "report-context", "Latest full-year NEA report verified · FY 2025/26 (2082/83) · provisional");
  context.append(citation("highlights"));
  const totals = element("div", "energy-totals");
  totals.append(
    metric("Domestic generation", annualGeneration, "GWh", "highlights", "Combined output from NEA, subsidiaries and independent producers"),
    metric("Imported electricity", latestTrade.imports, "GWh", "trade", "Electricity purchased from India"),
    metric("Exported electricity", latestTrade.exports, "GWh", "trade", "Power sold across the border"),
    metric("Net electricity exports", latestTrade.exports - latestTrade.imports, "GWh", "trade", "Exports minus imports")
  );
  dashboard.append(context, totals);
  const recent = element("aside", "energy-recent");
  recent.setAttribute("aria-label", "Most recent verified monthly figures");
  const latest = element("div");
  latest.append(
    element("strong", "", "Latest month in the NEA annual report"),
    element("p", "", latestMonth.label + " 2083 · " + latestMonth.span + " · " +
      format.format(latestMonth.generation) + " GWh generated · " +
      format.format(latestMonth.imports) + " GWh imported · " +
      format.format(latestMonth.exports) + " GWh exported")
  );
  recent.append(latest, citation("monthly"));
  dashboard.append(recent);

  const timeline = panel("When Nepal generates and trades");
  timeline.classList.add("energy-timeline");
  const tools = element("div", "timeline-tools");
  tools.setAttribute("aria-label", "Reporting period");
  const chartHost = element("div", "chart-host");
  const views = {
    monthly: [months, "monthly", "Monthly electricity balance for FY 2025/26", Object.keys(series)],
    seasonal: [seasons, "monthly", "Seasonal groups within FY 2025/26", Object.keys(series)],
    trade: [years, "trade", "Electricity trade by fiscal year", ["imports", "exports"]]
  };
  const buttons = Object.entries({ monthly: "Monthly", seasonal: "By season", trade: "Annual trade" }).map(([key, label]) => {
    const button = element("button", "", label);
    button.type = "button";
    button.dataset.period = key;
    button.addEventListener("click", () => renderPeriod(key));
    return button;
  });
  tools.append(...buttons);
  timeline.append(tools, chartHost);
  dashboard.append(timeline);

  function downloadData(key, rows, columns, source) {
    const [label, url] = sources[source];
    const table = [
      ["Period", "Date range", ...columns.map(column => series[column] + " (GWh)"), "Source", "Source URL"],
      ...rows.map(row => [row.label, row.span, ...columns.map(column => row[column]), label, url])
    ];
    const csv = table.map(row => row.map(cell => '"' + String(cell).replaceAll('"', '""') + '"').join(",")).join("\r\n");
    const download = element("a");
    download.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    download.download = "nepal-electricity-" + key + ".csv";
    download.click();
    setTimeout(() => URL.revokeObjectURL(download.href), 1000);
  }

  function renderPeriod(key) {
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.period === key));
    const [rows, source, title, keys] = views[key];
    const caption = element("div", "chart-caption");
    caption.append(element("h4", "", title + " · GWh"), citation(source));
    const legend = element("div", "series-legend");
    for (const column of keys) legend.append(element("span", "series-" + column, series[column]));
    const max = Math.max(...rows.flatMap(row => keys.map(column => row[column])));
    const tickStep = Math.ceil(max / 4 / 100) * 100;
    const ceiling = tickStep * 4;
    const chart = element("div", "bar-chart");
    chart.style.setProperty("--columns", rows.length);
    const axis = element("div", "chart-axis");
    axis.setAttribute("aria-hidden", "true");
    for (let n = 4; n >= 0; n--) axis.append(element("span", "", format.format(tickStep * n)));
    const plot = element("div", "chart-plot");
    plot.setAttribute("role", "group");
    plot.setAttribute("aria-label", "Select a period to inspect its values");
    const labels = element("div", "chart-labels");
    labels.setAttribute("aria-hidden", "true");
    const reading = element("div", "chart-reading");
    reading.setAttribute("aria-live", "polite");
    let selectedGroup;

    function selectGroup(group, row) {
      selectedGroup?.setAttribute("aria-pressed", "false");
      group.setAttribute("aria-pressed", "true");
      selectedGroup = group;
      const period = element("div", "reading-title");
      period.append(element("strong", "", row.label), element("small", "", row.span));
      const values = element("dl", "reading-values");
      for (const column of keys) {
        const item = element("div");
        item.append(element("dt", "series-" + column, series[column]), element("dd", "", format.format(row[column]) + " GWh"));
        values.append(item);
      }
      reading.replaceChildren(period, values, citation(source));
    }

    for (const row of rows) {
      const group = element("button", "bar-group");
      group.type = "button";
      group.title = row.label + " · " + keys.map(column => series[column] + " " + format.format(row[column]) + " GWh").join(" · ");
      group.setAttribute("aria-label", group.title);
      group.setAttribute("aria-pressed", "false");
      group.addEventListener("click", () => selectGroup(group, row));
      for (const column of keys) {
        const bar = element("span", "bar series-" + column);
        bar.style.height = row[column] / ceiling * 100 + "%";
        group.append(bar);
      }
      plot.append(group);
      labels.append(element("span", "", key === "monthly" ? row.label.slice(0, 3) : row.label));
      if (row === (key === "seasonal" ? rows[0] : rows.at(-1))) selectGroup(group, row);
    }
    chart.append(axis, plot, labels);

    const exact = element("details", "exact-data");
    exact.append(element("summary", "", "Exact values and citations"));
    const scroll = element("div", "energy-table-scroll");
    const table = element("table", "energy-table");
    const head = element("thead");
    const heading = element("tr");
    for (const label of ["Period", ...keys.map(column => series[column] + " (GWh)"), "Source"]) {
      const th = element("th", "", label);
      th.scope = "col";
      heading.append(th);
    }
    head.append(heading);
    const body = element("tbody");
    for (const row of rows) {
      const tr = element("tr");
      const label = element("th", "", row.label);
      label.scope = "row";
      label.append(element("small", "", row.span));
      const ref = element("td");
      ref.append(citation(source));
      tr.append(label, ...keys.map(column => element("td", "", format.format(row[column]))), ref);
      body.append(tr);
    }
    table.append(head, body);
    scroll.append(table);
    exact.append(scroll);
    const utility = element("div", "chart-utility");
    const download = element("button", "download-data", "Download CSV");
    download.type = "button";
    download.addEventListener("click", () => downloadData(key, rows, keys, source));
    utility.append(download);
    const explanation = element("p", "chart-note");
    if (key === "trade") {
      explanation.textContent = "The fiscal year is labeled by its end year. FY 2025/26 trade figures are provisional.";
    } else {
      explanation.textContent = "Domestic generation is the sum of NEA, subsidiary and independent-producer output. The Load Dispatch Centre’s monthly balance uses a different reporting series from the annual highlights.";
    }
    if (key === "seasonal") {
      explanation.append(document.createTextNode(" Whole Nepali reporting months are grouped by their Gregorian start month to approximate the weather seasons. The monsoon group combines months from both ends of the fiscal year. "), citation("weather"));
    }
    const instruction = element("p", "chart-note", "Select a bar group to see its exact values.");
    chartHost.replaceChildren(caption, legend, instruction, chart, reading, utility, exact, explanation);
  }
  renderPeriod("monthly");

  const details = element("div", "energy-detail-grid");
  const production = panel("Who generated the electricity");
  production.append(element("p", "", "Domestic generation · FY 2025/26"), factList(annualDomestic, "GWh", "highlights"));
  production.append(element("h4", "", "Where exports went"), factList([
    ["India", 3817], ["Bangladesh", 148]
  ], "GWh", "destinations"));
  const capacity = panel("Installed capacity by technology");
  capacity.append(element("p", "", "Nameplate capacity · FY 2025/26. MW measures capacity, while GWh measures energy generated."));
  capacity.append(factList([
    ["Hydropower", 3905.902], ["Solar", 154.940], ["Thermal", 53.410], ["Bagasse cogeneration", 6], ["Total installed", 4120.252]
  ], "MW", "capacity"));
  details.append(production, capacity);
  dashboard.append(details);

  const fullEnergy = panel("Beyond electricity");
  fullEnergy.classList.add("broader-energy");
  fullEnergy.append(element("p", "", "Nepal’s wider energy balance includes fuelwood, agricultural residues, dung, petroleum, coal, and renewables. The verified WECS balance below is for FY 2022/23 (2079/80)."));
  fullEnergy.append(factList([
    ["Domestic energy production", 394.540], ["Energy imports", 143.992], ["Energy exports", 4.846], ["Total primary energy supply", 533.606]
  ], "PJ", "allEnergy"));
  fullEnergy.append(element("p", "chart-note", "Converted from the report’s terajoules. Primary supply includes domestic production and imports, with exports and stock changes accounted for."));
  dashboard.append(fullEnergy);
})();
