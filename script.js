// script.js — Účinnost: P₀, P, η (2 kroky: Zápis + Výpočet a odpověď)
"use strict";

// ---------- Konstanty a pomocné funkce ----------

const F = { W: 1, kW: 1000, MW: 1_000_000 };

const DIFF = {
  lehka: { p0W: [50, 500], eta: [60, 95] },
  normalni: { p0W: [500, 50000], eta: [35, 90] },
};

const DEVICES = [
  { id: "zarovka", name: "Žárovka" },
  { id: "ledka", name: "LED žárovka" },
  { id: "motor", name: "Elektromotor" },
  { id: "cerpadlo", name: "Čerpadlo" },
  { id: "turbina", name: "Turbína" },
];

let difficulty = "lehka";
let step = 1; // 1 = Zápis, 2 = Výpočet + odpověď

let problem = null;
let stats = { ok: 0, err: 0, accSum: 0, accN: 0 };
let writeState = null;

const STRICT_FLOW = true;
let gates = { writeOk: false, calcOk: false };

const E = {};

function toNum(s) {
  if (s == null) return NaN;
  return Number(String(s).trim().replace(/\s+/g, "").replace(",", "."));
}

function fmtComma(x, d = 3) {
  return Number(x)
    .toFixed(d)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
}

function unitizePower(w) {
  if (w >= 1_000_000) return { v: w / 1_000_000, u: "MW" };
  if (w >= 1000) return { v: w / 1000, u: "kW" };
  return { v: w, u: "W" };
}

function fmtW(w) {
  const u = unitizePower(w);
  return `${fmtComma(u.v)} ${u.u}`;
}

function pick(min, max) {
  return min + Math.random() * (max - min);
}

function pickInt(min, max) {
  return Math.round(pick(min, max));
}

function choose(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- Generování úlohy ----------

function makeProblem() {
  const ranges = DIFF[difficulty] || DIFF.lehka;
  const dev = choose(DEVICES);
  const type = choose(["eta", "P", "P0"]); // neznámá veličina

  let P0W = pickInt(ranges.p0W[0], ranges.p0W[1]); // ve W
  const eta = pickInt(ranges.eta[0], ranges.eta[1]); // v %

  let PW = Math.round(P0W * (eta / 100)); // ve W

  const units = ["W", "kW", "MW"];
  let unitP0, unitP;

  if (difficulty === "lehka") {
    // stejné jednotky, jednodušší
    unitP0 = unitP = "W";
  } else {
    // normální: různé jednotky
    unitP0 = choose(units);
    const rest = units.filter((u) => u !== unitP0);
    unitP = choose(rest.length ? rest : units);
  }

  let P0 = { v: P0W / F[unitP0], u: unitP0 };
  let P = { v: PW / F[unitP], u: unitP };

  // u lehké úrovně trochu "učesat" čísla
  if (difficulty === "lehka") {
    P0.v = Math.round(P0.v);
    P0W = P0.v * F[unitP0];
    PW = Math.round(P0W * (eta / 100));
    P.v = PW / F[unitP];
  }

  let text = "";
  let ask = "";

  if (type === "eta") {
    text =
      `${dev.name} odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}. ` +
      `Užitečný výkon je P = ${fmtComma(P.v)} ${P.u}.`;
    ask = "Urči účinnost zařízení η v procentech.";
  } else if (type === "P") {
    text =
      `${dev.name} pracuje s účinností η = ${eta} %. ` +
      `Odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}. Urči užitečný výkon P.`;
    ask = "Urči užitečný výkon P.";
  } else {
    text =
      `${dev.name} má účinnost η = ${eta} %. ` +
      `Dodává užitečný výkon P = ${fmtComma(P.v)} ${P.u}. Urči celkový příkon P₀.`;
    ask = "Urči celkový příkon P₀.";
  }

  return { device: dev, type, P0W, PW, eta, P0, P, text, ask };
}

// ---------- UI prvky ----------

function bindElements() {
  E.zadaniText = document.getElementById("zadaniText");
  E.content = document.getElementById("content");

  E.btnBack = document.getElementById("btnBack");
  E.btnNext = document.getElementById("btnNext");
  E.btnCheck = document.getElementById("btnCheck");
  E.btnNew = document.getElementById("btnNew");
  E.btnReset = document.getElementById("btnReset");
  E.diffSel = document.getElementById("difficulty");

  E.okCount = document.getElementById("okCount");
  E.errCount = document.getElementById("errCount");
  E.avgAcc = document.getElementById("avgAcc");
}

// ---------- Zadání ----------

function renderZadani() {
  if (!E.zadaniText) return;
  if (!problem) {
    E.zadaniText.innerHTML =
      '<span class="small muted">Klikni na <b>Nová úloha</b> a začni.</span>';
    return;
  }
  E.zadaniText.innerHTML = `<p>${problem.text}</p><p><b>Otázka:</b> ${problem.ask}</p>`;
}

// ---------- Krok 1: Zápis ----------

function renderStep1() {
  if (!E.content) return;
  const S = (html) => (E.content.innerHTML = html);

  S(`
    <h2 class="subtitle">1. Zápis</h2>
    <p class="hint">
      Zapiš hodnoty P₀, P a η ze zadání. Vyber <b>jednu</b> hledanou veličinu.
      U P₀ a P použij stejné jednotky jako v zadání.
    </p>

    <div class="write-row">
      <label class="write-label">P₀ =</label>
      <input id="p0Val" class="input write-input" type="text" inputmode="decimal" placeholder="např. 120">
      <select id="p0Unit" class="input unit-select">
        <option value="">Vyber</option>
        <option>W</option><option>kW</option><option>MW</option>
      </select>
      <label class="unknown-label">
        <input id="p0Chk" type="checkbox"> hledaná veličina
      </label>
    </div>

    <div class="write-row">
      <label class="write-label">P =</label>
      <input id="pVal" class="input write-input" type="text" inputmode="decimal" placeholder="např. 75">
      <select id="pUnit" class="input unit-select">
        <option value="">Vyber</option>
        <option>W</option><option>kW</option><option>MW</option>
      </select>
      <label class="unknown-label">
        <input id="pChk" type="checkbox"> hledaná veličina
      </label>
    </div>

    <div class="write-row eta-row">
      <label class="write-label">η =</label>
      <input id="etaPct" class="input eta-pct" type="text" inputmode="decimal" placeholder="např. 75">
      <span class="eta-eq">% =</span>
      <input id="etaDec" class="input eta-dec" type="text" inputmode="decimal" placeholder="např. 0,75">
      <label class="unknown-label">
        <input id="etaChk" type="checkbox"> hledaná veličina
      </label>
    </div>

    <div id="writeMsg" class="feedback muted"></div>
  `);

  const p0Val = document.getElementById("p0Val");
  const p0Unit = document.getElementById("p0Unit");
  const p0Chk = document.getElementById("p0Chk");

  const pVal = document.getElementById("pVal");
  const pUnit = document.getElementById("pUnit");
  const pChk = document.getElementById("pChk");

  const etaPct = document.getElementById("etaPct");
  const etaDec = document.getElementById("etaDec");
  const etaChk = document.getElementById("etaChk");

  const msgBox = document.getElementById("writeMsg");

  function setRowStatePower(valEl, unitEl, chkEl) {
    const unknown = chkEl.checked;
    if (unknown) {
      valEl.value = "";
      valEl.disabled = true;
      valEl.placeholder = "?";
      unitEl.disabled = false; // i pro hledanou chceme jednotku výsledku
    } else {
      valEl.disabled = false;
      valEl.placeholder = "např. 120";
      unitEl.disabled = false;
    }
  }

  function setRowStateEta() {
    const unknown = etaChk.checked;
    if (unknown) {
      etaPct.value = "";
      etaDec.value = "";
      etaPct.disabled = true;
      etaDec.disabled = true;
      etaPct.placeholder = "?";
      etaDec.placeholder = "?";
    } else {
      etaPct.disabled = false;
      etaDec.disabled = false;
      etaPct.placeholder = "např. 75";
      etaDec.placeholder = "např. 0,75";
    }
  }

  setRowStatePower(p0Val, p0Unit, p0Chk);
  setRowStatePower(pVal, pUnit, pChk);
  setRowStateEta();

  function validateWrite() {
    if (!msgBox || !problem) return;

    const unknowns = [];
    if (p0Chk.checked) unknowns.push("P0");
    if (pChk.checked) unknowns.push("P");
    if (etaChk.checked) unknowns.push("eta");

    if (unknowns.length !== 1) {
      gates.writeOk = false;
      msgBox.textContent = "Zaškrtni přesně jednu hledanou veličinu.";
      writeState = null;
      toggleNext();
      return;
    }

    const typeMap = { P0: "P0", P: "P", eta: "eta" };
    const unknownKey = unknowns[0];
    if (typeMap[unknownKey] !== problem.type) {
      gates.writeOk = false;
      msgBox.textContent = "Hledaná veličina neodpovídá otázce v zadání.";
      writeState = null;
      toggleNext();
      return;
    }

    let ok = true;
    const tolRel = 0.001;

    // P₀
    if (!p0Chk.checked) {
      const v = toNum(p0Val.value);
      const u = p0Unit.value;
      if (!isFinite(v) || !["W", "kW", "MW"].includes(u)) {
        ok = false;
      } else {
        const got = v * F[u];
        const want = problem.P0W;
        if (!(isFinite(got) && Math.abs(got - want) <= Math.max(1e-6, want * tolRel))) {
          ok = false;
        }
      }
    } else {
      if (!["W", "kW", "MW"].includes(p0Unit.value)) ok = false;
    }

    // P
    if (!pChk.checked) {
      const v = toNum(pVal.value);
      const u = pUnit.value;
      if (!isFinite(v) || !["W", "kW", "MW"].includes(u)) {
        ok = false;
      } else {
        const got = v * F[u];
        const want = problem.PW;
        if (!(isFinite(got) && Math.abs(got - want) <= Math.max(1e-6, want * tolRel))) {
          ok = false;
        }
      }
    } else {
      if (!["W", "kW", "MW"].includes(pUnit.value)) ok = false;
    }

    // η
    if (!etaChk.checked) {
      const pct = toNum(etaPct.value);
      const dec = toNum(etaDec.value);
      if (!isFinite(pct) || !isFinite(dec)) {
        ok = false;
      } else {
        if (Math.abs(dec - pct / 100) > 1e-3) ok = false;
        if (Math.abs(pct - problem.eta) > Math.max(1e-6, problem.eta * tolRel)) {
          ok = false;
        }
      }
    }

    gates.writeOk = ok;
    msgBox.textContent = ok
      ? "Zápis odpovídá zadání a převod η je správný."
      : "Zápis není v pořádku — zkontroluj hodnoty, jednotky a převod η.";

    if (ok) {
      writeState = {
        unknown: unknownKey,
        p0: {
          unknown: p0Chk.checked,
          value: p0Chk.checked ? null : toNum(p0Val.value),
          unit: p0Unit.value || "",
        },
        p: {
          unknown: pChk.checked,
          value: pChk.checked ? null : toNum(pVal.value),
          unit: pUnit.value || "",
        },
        eta: {
          unknown: etaChk.checked,
          pct: etaChk.checked ? null : toNum(etaPct.value),
          dec: etaChk.checked ? null : toNum(etaDec.value),
        },
      };
    } else {
      writeState = null;
    }

    toggleNext();
  }

  [
    p0Val,
    p0Unit,
    p0Chk,
    pVal,
    pUnit,
    pChk,
    etaPct,
    etaDec,
    etaChk,
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", validateWrite);
    el.addEventListener("change", () => {
      setRowStatePower(p0Val, p0Unit, p0Chk);
      setRowStatePower(pVal, pUnit, pChk);
      setRowStateEta();
      validateWrite();
    });
  });

  validateWrite();
}

// ---------- Krok 2: Výpočet + odpověď ----------

function renderStep2() {
  if (!E.content || !problem) return;
  const S = (html) => (E.content.innerHTML = html);

  const lines = [];
  if (writeState) {
    if (writeState.p0.unknown) {
      lines.push(`P₀ = ? ${writeState.p0.unit}`.trim());
    } else {
      lines.push(
        `P₀ = ${fmtComma(writeState.p0.value)} ${writeState.p0.unit}`.trim()
      );
    }
    if (writeState.p.unknown) {
      lines.push(`P = ? ${writeState.p.unit}`.trim());
    } else {
      lines.push(
        `P = ${fmtComma(writeState.p.value)} ${writeState.p.unit}`.trim()
      );
    }
    if (writeState.eta.unknown) {
      lines.push("η = ?");
    } else {
      lines.push(
        `η = ${fmtComma(writeState.eta.pct)} % = ${fmtComma(writeState.eta.dec)}`
      );
    }
  } else {
    lines.push(
      `P₀ = ${fmtComma(problem.P0.v)} ${problem.P0.u}`,
      `P = ${fmtComma(problem.P.v)} ${problem.P.u}`,
      `η = ${problem.eta} %`
    );
  }

  const formulaHint =
    problem.type === "eta"
      ? 'např. η = P / P₀'
      : problem.type === "P"
      ? 'např. P = η · P₀'
      : 'např. P₀ = P / (η : 100)';

  const substHint =
    problem.type === "eta"
      ? 'např. η = 64 / 120'
      : problem.type === "P"
      ? 'např. P = 0,75 · 120'
      : 'např. P₀ = 90 / 0,75';

  const template =
    problem.type === "eta"
      ? `${problem.device.name} má účinnost __ %.`
      : problem.type === "P"
      ? `${problem.device.name} má užitečný výkon __.`
      : `${problem.device.name} má příkon __.`;

  let resultBlock = "";
  if (problem.type === "eta") {
    resultBlock = `
      <label>Výsledek — η (%)</label>
      <input id="resVal" class="input" type="text" inputmode="decimal" placeholder="např. 75">
    `;
  } else {
    resultBlock = `
      <label>Výsledek — ${problem.type === "P" ? "P" : "P₀"}</label>
      <div class="write-row">
        <input id="resVal" class="input write-input" type="text" inputmode="decimal" placeholder="hodnota">
        <select id="resUnit" class="input unit-select">
          <option value="">Vyber</option>
          <option>W</option><option>kW</option><option>MW</option>
        </select>
      </div>
    `;
  }

  S(`
    <h2 class="subtitle">2. Výpočet a odpověď</h2>

    <div class="summary-box">
      <div class="summary-title">Shrnutí zápisu</div>
      ${lines.map((t) => `<div class="summary-line">${t}</div>`).join("")}
    </div>

    <div class="tools-bar">
      <button id="btnTriangle" class="btn tool-toggle">Trojúhelník</button>
      <button id="btnCalc" class="btn tool-toggle">Kalkulačka</button>
    </div>
    <div id="toolsPanel" class="tools-panel">
      <div id="trianglePanel" class="tool-panel">
        <img src="ucinnost-vzorec.png" alt="Vzorec účinnosti" class="triangle-img">
      </div>
      <div id="calcPanel" class="tool-panel" style="display:none">
        <div class="calc-display">
          <div id="calcHistory" class="calc-display-history"></div>
          <div id="calcMain" class="calc-display-main">0</div>
        </div>
        <div class="calc-keys">
          <button class="calc-key" data-k="7">7</button>
          <button class="calc-key" data-k="8">8</button>
          <button class="calc-key" data-k="9">9</button>
          <button class="calc-key op" data-k="/">÷</button>

          <button class="calc-key" data-k="4">4</button>
          <button class="calc-key" data-k="5">5</button>
          <button class="calc-key" data-k="6">6</button>
          <button class="calc-key op" data-k="*">×</button>

          <button class="calc-key" data-k="1">1</button>
          <button class="calc-key" data-k="2">2</button>
          <button class="calc-key" data-k="3">3</button>
          <button class="calc-key op" data-k="-">−</button>

          <button class="calc-key" data-k="0">0</button>
          <button class="calc-key" data-k=",">,</button>
          <button class="calc-key op" data-k="C">C</button>
          <button class="calc-key op" data-k="+">+</button>

          <button class="calc-key op" data-k="=" style="grid-column: span 4">=</button>
        </div>
      </div>
    </div>

    <div>
      <label>Vzorec</label>
      <div class="inline-buttons" data-target="formula">
        <button type="button" data-ins="η">η</button>
        <button type="button" data-ins="P">P</button>
        <button type="button" data-ins="P₀">P₀</button>
        <button type="button" data-ins=" · ">·</button>
        <button type="button" data-ins=" / ">/</button>
        <button type="button" data-ins=" : ">:</button>
        <button type="button" data-ins=" = ">=</button>
      </div>
      <input id="formula" class="input" type="text" placeholder="${formulaHint}">
    </div>

    <div>
      <label>Dosaď do vzorce</label>
      <div class="inline-buttons" data-target="subst">
        <button type="button" data-ins="η">η</button>
        <button type="button" data-ins="P">P</button>
        <button type="button" data-ins="P₀">P₀</button>
        <button type="button" data-ins=" · ">·</button>
        <button type="button" data-ins=" / ">/</button>
        <button type="button" data-ins=" : ">:</button>
        <button type="button" data-ins=" = ">=</button>
      </div>
      <input id="subst" class="input" type="text" placeholder="${substHint}">
    </div>

    <div>
      ${resultBlock}
    </div>

    <div>
      <label>Odpověď</label>
      <div class="summary-box">
        ${template.replace("__", '<b id="answerPlaceholder">[doplň výsledek]</b>')}
      </div>
      <div class="answer-line">
        <input id="ansVal" class="input answer-input" type="text" inputmode="decimal" placeholder="výsledek">
        <select id="ansUnit" class="input unit-select">
          <option value="">Vyber</option>
          <option>%</option><option>W</option><option>kW</option><option>MW</option>
        </select>
      </div>
      <div id="autoAnswer" class="feedback muted"></div>
    </div>

    <div id="calcMsg" class="feedback muted"></div>
  `);

  // symbolová tlačítka
  document.querySelectorAll(".inline-buttons").forEach((group) => {
    const targetId = group.getAttribute("data-target");
    group.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        let target = document.activeElement;
        if (!(target && target.id === targetId)) {
          target = document.getElementById(targetId);
        }
        if (!target) return;
        const ins = btn.getAttribute("data-ins") || "";
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        target.value =
          target.value.slice(0, start) + ins + target.value.slice(end);
        const pos = start + ins.length;
        target.focus();
        target.selectionStart = target.selectionEnd = pos;
      });
    });
  });

  // trojúhelník / kalkulačka
  const btnTriangle = document.getElementById("btnTriangle");
  const btnCalc = document.getElementById("btnCalc");
  const trianglePanel = document.getElementById("trianglePanel");
  const calcPanel = document.getElementById("calcPanel");

  function showTriangle() {
    if (!trianglePanel || !calcPanel) return;
    trianglePanel.style.display = "block";
    calcPanel.style.display = "none";
    if (btnTriangle) btnTriangle.classList.add("tool-toggle--active");
    if (btnCalc) btnCalc.classList.remove("tool-toggle--active");
  }

  function showCalc() {
    if (!trianglePanel || !calcPanel) return;
    trianglePanel.style.display = "none";
    calcPanel.style.display = "block";
    if (btnTriangle) btnTriangle.classList.remove("tool-toggle--active");
    if (btnCalc) btnCalc.classList.add("tool-toggle--active");
  }

  if (btnTriangle) btnTriangle.addEventListener("click", showTriangle);
  if (btnCalc) btnCalc.addEventListener("click", showCalc);
  showTriangle();

  // jednoduchá kalkulačka
  const calcMain = document.getElementById("calcMain");
  const calcHistory = document.getElementById("calcHistory");
  let calcBuffer = "";
  let calcLast = "";

  function setCalcDisplay(value) {
    if (calcMain) calcMain.textContent = value;
  }
  function setCalcHistory(value) {
    if (calcHistory) calcHistory.textContent = value;
  }

  document.querySelectorAll(".calc-key").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-k");
      if (!k) return;
      if (k === "C") {
        calcBuffer = "";
        calcLast = "";
        setCalcDisplay("0");
        setCalcHistory("");
        return;
      }
      if (k === "=") {
        try {
          const expr = calcBuffer.replace(/,/g, ".");
          const val = Function(`"use strict"; return (${expr})`)();
          if (typeof val === "number" && isFinite(val)) {
            calcLast = calcBuffer;
            calcBuffer = String(val).replace(".", ",");
            setCalcDisplay(calcBuffer);
            setCalcHistory(calcLast + " =");
          }
        } catch {
          setCalcDisplay("Chyba");
        }
        return;
      }
      calcBuffer += k === "," ? "," : k;
      setCalcDisplay(calcBuffer);
    });
  });

  // validace pro povolení Next (pokud chceš)
  function validateCalc() {
    const resVal = document.getElementById("resVal");
    const resUnit = document.getElementById("resUnit");
    let ok = true;

    if (problem.type === "eta") {
      const v = toNum(resVal?.value);
      if (!isFinite(v)) ok = false;
    } else {
      const v = toNum(resVal?.value);
      const u = resUnit?.value || "";
      if (!isFinite(v) || !["W", "kW", "MW"].includes(u)) ok = false;
    }
    gates.calcOk = ok;
    toggleNext();
  }

  E.content.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", validateCalc);
    el.addEventListener("change", validateCalc);
  });
  validateCalc();
}

// ---------- Hlavní render ----------

function render() {
  renderZadani();
  if (!E.content) return;

  document.querySelectorAll(".step").forEach((el) => {
    const s = Number(el.getAttribute("data-step"));
    el.classList.toggle("active", s === step);
  });

  if (E.btnBack) E.btnBack.disabled = step === 1;
  if (E.btnCheck) E.btnCheck.style.display = step === 2 ? "" : "none";

  if (step === 1) {
    renderStep1();
  } else {
    renderStep2();
  }

  toggleNext();
}

// ---------- Next/Back ----------

function toggleNext() {
  if (!STRICT_FLOW || !E.btnNext) return;
  let allow = true;
  if (step === 1) allow = gates.writeOk;
  E.btnNext.disabled = !allow;
}

// ---------- Statistiky ----------

function setStats() {
  if (E.okCount) E.okCount.textContent = String(stats.ok);
  if (E.errCount) E.errCount.textContent = String(stats.err);
  if (E.avgAcc)
    E.avgAcc.textContent = stats.accN
      ? fmtComma(stats.accSum / stats.accN, 1) + " %"
      : "–";
}

// ---------- Kontrola (krok 2) ----------

function doCheck() {
  if (step !== 2 || !problem) return;

  const box = document.getElementById("calcMsg");
  const ansBox = document.getElementById("autoAnswer");

  if (box) {
    box.textContent = "";
    box.className = "feedback muted";
  }
  if (ansBox) {
    ansBox.textContent = "";
    ansBox.className = "feedback muted";
  }

  const formula = (document.getElementById("formula")?.value || "")
    .replace(/\s+/g, "")
    .replace(/eta/gi, "η");

  let goodFormula = false;
  if (problem.type === "eta") {
    goodFormula = formula === "η=P/P₀" || formula === "η=P:P₀";
  } else if (problem.type === "P") {
    goodFormula = ["P=η·P₀", "P=(η:100)·P₀", "P=η*P₀"].includes(formula);
  } else if (problem.type === "P0") {
    goodFormula =
      formula === "P₀=P/η" ||
      ["P₀=P/(η:100)", "P₀=P:(η:100)"].includes(formula);
  }

  const resVal = document.getElementById("resVal");
  const resUnit = document.getElementById("resUnit");
  const ansVal = document.getElementById("ansVal");
  const ansUnit = document.getElementById("ansUnit");

  let ok = false;
  let acc = 0;
  let msg = "";
  const tolRel = 0.005;

  if (problem.type === "eta") {
    const v = toNum(resVal?.value);
    const tolAbs = 0.6; // ±0,6 procentního bodu
    if (isFinite(v)) {
      const diff = Math.abs(v - problem.eta);
      acc = Math.max(0, 100 - diff);
      ok = diff <= tolAbs;
    }
    msg =
      goodFormula && ok
        ? `Vzorec i výsledek jsou v pořádku. η ≈ ${fmtComma(problem.eta)} %.`
        : !goodFormula
        ? "Vzorec není zapsán správně."
        : `Výsledek nesouhlasí. Očekává se přibližně ${fmtComma(
            problem.eta
          )} %.`;
  } else if (problem.type === "P") {
    const v = toNum(resVal?.value);
    const u = resUnit?.value || "W";
    const got = v * (F[u] || 1);
    const want = problem.PW;
    if (isFinite(got)) {
      acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
      ok = Math.abs(got - want) <= Math.max(1, want * tolRel);
    }
    msg =
      goodFormula && ok
        ? `Vzorec i výsledek jsou v pořádku. P ≈ ${fmtW(want)}.`
        : !goodFormula
        ? "Vzorec není zapsán správně."
        : `Výsledek nesouhlasí. Očekává se přibližně ${fmtW(want)}.`;
  } else if (problem.type === "P0") {
    const v = toNum(resVal?.value);
    const u = resUnit?.value || "W";
    const got = v * (F[u] || 1);
    const want = problem.P0W;
    if (isFinite(got)) {
      acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
      ok = Math.abs(got - want) <= Math.max(1, want * tolRel);
    }
    msg =
      goodFormula && ok
        ? `Vzorec i výsledek jsou v pořádku. P₀ ≈ ${fmtW(want)}.`
        : !goodFormula
        ? "Vzorec není zapsán správně."
        : `Výsledek nesouhlasí. Očekává se přibližně ${fmtW(want)}.`;
  }

  // odpověď musí být dopsaná
  if (ansVal) {
    const t = ansVal.value.trim();
    if (!t) {
      ok = false;
      msg = (msg ? msg + " " : "") + "Doplň výsledek také do odpovědi.";
    }
  }

  if (box) {
    box.textContent = msg || "Doplň chybějící údaje.";
    box.classList.remove("muted");
    box.classList.add(ok ? "success" : "error");
  }

  if (ok) {
    stats.ok++;
    stats.accSum += acc;
    stats.accN++;
  } else {
    stats.err++;
  }
  setStats();

  if (ansBox) {
    let answer = "";
    if (problem.type === "eta") {
      answer = `${problem.device.name} má účinnost přibližně ${fmtComma(
        problem.eta
      )} %.`;
    } else if (problem.type === "P") {
      answer = `${problem.device.name} má užitečný výkon přibližně ${fmtW(
        problem.PW
      )}.`;
    } else {
      answer = `${problem.device.name} má příkon přibližně ${fmtW(
        problem.P0W
      )}.`;
    }
    ansBox.textContent = answer;
    ansBox.classList.remove("muted");
    ansBox.classList.add(ok ? "success" : "error");
  }
}

// ---------- Ovládání a start ----------

function newTask(keepStats = true) {
  problem = makeProblem();
  step = 1;
  writeState = null;
  gates.writeOk = false;
  gates.calcOk = false;
  if (!keepStats) {
    stats = { ok: 0, err: 0, accSum: 0, accN: 0 };
    setStats();
  }
  render();
}

function wire() {
  if (E.btnBack) {
    E.btnBack.addEventListener("click", () => {
      if (step > 1) {
        step = 1;
        render();
      }
    });
  }

  if (E.btnNext) {
    E.btnNext.addEventListener("click", () => {
      if (step === 1 && gates.writeOk) {
        step = 2;
        render();
      }
    });
  }

  if (E.btnCheck) {
    E.btnCheck.addEventListener("click", doCheck);
  }

  if (E.btnNew) {
    E.btnNew.addEventListener("click", () => {
      newTask(true);
    });
  }

  if (E.btnReset) {
    E.btnReset.addEventListener("click", () => {
      newTask(false);
    });
  }

  if (E.diffSel) {
    E.diffSel.value = difficulty;
    E.diffSel.addEventListener("change", () => {
      difficulty = E.diffSel.value || "lehka";
      newTask(true);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
  setStats();
  wire();
  newTask(true);
});
