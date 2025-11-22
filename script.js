// script.js — Účinnost: P₀, P, η (Zápis + Výpočet a odpověď)
"use strict";

// ---------- Pomocné ----------
const F = { W: 1, kW: 1000, MW: 1_000_000 };

const DIFF = {
  lehka: {
    p0W: [50, 500], // základ pro W / kW / MW se přepočítá
    eta: [60, 95],
  },
  normalni: {
    p0W: [500, 50000],
    eta: [35, 90],
  },
};

let difficulty = "lehka";

// krok 1 = Zápis, krok 2 = Výpočet a odpověď
let step = 1;

// aktuální úloha + statistika
let problem = null;
let stats = { ok: 0, err: 0, accSum: 0, accN: 0 };

// stav zápisu z kroku 1 (pro shrnutí)
let writeState = null;

// "zámky" na Next (striktní průchod)
const STRICT_FLOW = true;
let gates = { writeOk: false, calcOk: false };

const toNum = (s) => {
  if (s == null) return NaN;
  return Number(String(s).trim().replace(/\s+/g, "").replace(",", "."));
};
const fmtComma = (x, d = 3) =>
  Number(x).toFixed(d).replace(/\.?0+$/, "").replace(".", ",");

// Výběr náhodných hodnot
const pick = (min, max) => min + Math.random() * (max - min);
const pickInt = (min, max) => Math.round(pick(min, max));
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];

// "Hezké" volby jednotek podle obtížnosti
const units = ["W", "kW", "MW"];

/**
 * Vrátí objekt {value, unit, watts} tak, aby value bylo celé číslo.
 */
function makeNicePower(rangeMin, rangeMax, unit, preferStep = 10) {
  if (unit === "W") {
    const v = pickInt(rangeMin, rangeMax);
    return { value: v, unit: "W", watts: v };
  }
  if (unit === "kW") {
    const minKW = Math.max(1, Math.floor(rangeMin / 1000));
    const maxKW = Math.max(minKW, Math.floor(rangeMax / 1000));
    const v = pickInt(minKW, maxKW);
    return { value: v, unit: "kW", watts: v * 1000 };
  }
  // MW
  const minMW = Math.max(1, Math.floor(rangeMin / 1_000_000));
  const maxMW = Math.max(minMW, Math.floor(rangeMax / 1_000_000));
  const v = pickInt(minMW, maxMW);
  return { value: v, unit: "MW", watts: v * 1_000_000 };
}

// ---------- Reálné rozsahy ----------
const DEVICES = [
  { id: "zarovka", name: "Žárovka", p0W: [5, 150], eta: [5, 25], rod: "f" },
  { id: "ledka", name: "LED žárovka", p0W: [3, 30], eta: [25, 45], rod: "f" },
  { id: "motor", name: "Elektromotor", p0W: [5_000, 500_000], eta: [60, 95], rod: "m" },
  { id: "cerpadlo", name: "Čerpadlo", p0W: [500, 50_000], eta: [40, 80], rod: "n" },
  { id: "turbina", name: "Turbína", p0W: [1_000_000, 50_000_000], eta: [30, 60], rod: "f" },
];

// ---------- Generování úlohy ----------

function makeProblem() {
  const ranges = DIFF[difficulty] || DIFF.lehka;
  const dev = choose(DEVICES);
  const type = choose(["eta", "P", "P0"]); // neznámá veličina

  // 1) Vybereme jednotky příkonu a výkonu podle obtížnosti
  let uP0 = "W";
  let uP = "W";

  if (difficulty === "lehka") {
    // stejné jednotky
    uP0 = uP = choose(units);
  } else {
    // různé jednotky, ale pořád obě "hezké"
    uP0 = choose(units);
    do {
      uP = choose(units);
    } while (uP === uP0);
  }

  // 2) Příkon P0 jako "hezké" číslo v dané jednotce
  const baseRange = dev.p0W || ranges.p0W;
  const P0Nice = makeNicePower(baseRange[0], baseRange[1], uP0);
  const P0W = P0Nice.watts;

  // 3) η (celé procento, v rozmezí)
  const eta = pickInt(
    Math.max(ranges.eta[0], dev.eta[0]),
    Math.min(ranges.eta[1], dev.eta[1])
  );

  // 4) Výkon P (vždy zakládáme na W)
   // výkon zaokrouhlený na celé W a nikdy ne 0
  const PW = Math.max(1, Math.round(P0W * (eta / 100)));


  // P převedeme do "hezkých" jednotek uP
  let PNice;
  if (uP === "W") {
    PNice = { value: PW, unit: "W", watts: PW };
  } else if (uP === "kW") {
    const v = Math.round(PW / 1000);
    PNice = { value: v, unit: "kW", watts: v * 1000 };
  } else {
    const v = Math.round(PW / 1_000_000);
    PNice = { value: v, unit: "MW", watts: v * 1_000_000 };
  }

  const P0 = { v: P0Nice.value, u: uP0 };
  const P = { v: PNice.value, u: uP };

  let text = "",
    ask = "";

  if (type === "eta") {
    text = `${dev.name} odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}. Užitečný výkon je P = ${fmtComma(P.v)} ${P.u}.`;
    ask = "Urči účinnost zařízení η v procentech.";
  } else if (type === "P") {
    text = `${dev.name} pracuje s účinností η = ${eta} %. Odebírá příkon P₀ = ${fmtComma(P0.v)} ${P0.u}. Urči užitečný výkon P.`;
    ask = "Urči užitečný výkon P.";
  } else {
    text = `${dev.name} má účinnost η = ${eta} %. Dodává užitečný výkon P = ${fmtComma(P.v)} ${P.u}. Urči celkový příkon P₀.`;
    ask = "Urči celkový příkon P₀.";
  }

  return { device: dev, type, P0W, PW, eta, P0, P, text, ask };
}

// ---------- UI prvky ----------

const E = {};

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
      '<span class="small muted">Něco se pokazilo, zkuste „Nová úloha“.</span>';
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
<p class="small muted">
  Zapiš dané veličiny ze zadání. Jednu z nich označ jako <b>hledanou</b>.
  U lehké obtížnosti zapisuj P₀ a P ve stejných jednotkách (W, kW nebo MW).
</p>


    <div class="write-row">
      <div class="write-label"><span>P₀</span> =</div>
      <div class="write-main power">
        <input id="p0Val" class="input power-val" type="text" inputmode="decimal" placeholder="111">
        <select id="p0Unit" class="input power-unit select">
          <option value="">Vyber</option>
          <option>W</option><option>kW</option><option>MW</option>
        </select>
      </div>
      <label class="unknown-label">
        <input id="p0Chk" type="checkbox"> hledaná veličina
      </label>
    </div>

    <div class="write-row">
      <div class="write-label"><span>P</span> =</div>
      <div class="write-main power">
        <input id="pVal" class="input power-val" type="text" inputmode="decimal" placeholder="111">
        <select id="pUnit" class="input power-unit select">
          <option value="">Vyber</option>
          <option>W</option><option>kW</option><option>MW</option>
        </select>
      </div>
      <label class="unknown-label">
        <input id="pChk" type="checkbox"> hledaná veličina
      </label>
    </div>

    <div class="write-row">
      <div class="write-label"><span>η</span> =</div>
      <div class="write-main eta">
        <input id="etaPct" class="input eta-pct" type="text" inputmode="decimal" placeholder="např. 75">
        <span class="eta-sign">% =</span>
        <input id="etaDec" class="input eta-dec" type="text" inputmode="decimal" placeholder="např. 0,75">
      </div>
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
    } else {
      valEl.disabled = false;
      valEl.placeholder = "111";
    }
    unitEl.disabled = false; // jednotku vybíráme vždy
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
    if (!msgBox) return;

    // 1) přesně jedna hledaná
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

    // 2) musí odpovídat skutečné neznámé z úlohy
    const typeMap = { P0: "P0", P: "P", eta: "eta" };
    const unknownKey = unknowns[0];
    const problemType = problem.type;
    if (typeMap[unknownKey] !== problemType) {
      gates.writeOk = false;
      msgBox.textContent = "Hledaná veličina neodpovídá otázce v zadání.";
      writeState = null;
      toggleNext();
      return;
    }

    let ok = true;
    const tolRel = 0.001;

    // ----- P₀ -----
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

    // ----- P -----
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

    // ----- η -----
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
      ? "Zápis odpovídá zadání a η je správně převedena na desetinné číslo."
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
      if (el === p0Chk || el === p0Val || el === p0Unit)
        setRowStatePower(p0Val, p0Unit, p0Chk);
      if (el === pChk || el === pVal || el === pUnit)
        setRowStatePower(pVal, pUnit, pChk);
      if (el === etaChk || el === etaPct || el === etaDec) setRowStateEta();
      validateWrite();
    });
  });

  validateWrite();
}

// ---------- Krok 2: Výpočet + odpověď ----------

function renderStep2() {
  if (!E.content) return;
  const S = (html) => (E.content.innerHTML = html);

  // shrnutí zápisu
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
      lines.push(`P = ${fmtComma(writeState.p.value)} ${writeState.p.unit}`);
    }
    if (writeState.eta.unknown) {
      lines.push("η = ?");
    } else {
      lines.push(
        `η = ${fmtComma(writeState.eta.pct)} % = ${fmtComma(
          writeState.eta.dec
        )}`
      );
    }
  }

  const formulaHint =
    problem.type === "eta"
      ? 'η = P / P₀ (povoleno i „η = P : P₀“)'
      : problem.type === "P"
      ? 'P = η · P₀ (η napiš jako 0,75) nebo „P = (η : 100) · P₀“'
      : 'P₀ = P / (η : 100) nebo „P₀ = P : (η : 100)“';

   // 🔧 DOPLNIT TENTO BLOK:
  const template =
    problem.type === "eta"
      ? `Zařízení má účinnost __ %.`
      : problem.type === "P"
      ? `${problem.device.name} má užitečný výkon __.`
      : `${problem.device.name} má příkon __.`;

  // text odpovědi podle zařízení + typu
  const devName = problem.device.name;
  let odpovedPrefix = "";
  let druh = ""; // "příkon", "užitečný výkon", "účinnost"

  if (problem.type === "eta") {
    druh = "účinnost";
    odpovedPrefix = `${devName} má účinnost`;
  } else if (problem.type === "P") {
    druh = "užitečný výkon";
    odpovedPrefix = `${devName} má užitečný výkon`;
  } else {
    druh = "příkon";
    odpovedPrefix = `${devName} má příkon`;
  }

  // blok pro výsledek
  let resultLabel = "";
  let resultUnitHtml = "";
  if (problem.type === "eta") {
    resultLabel = "Výsledek — η (%)";
    resultUnitHtml = "";
  } else if (problem.type === "P") {
    resultLabel = "Výsledek — P";
    resultUnitHtml = `
      <select id="resUnit" class="input select" style="max-width:130px;margin-top:0.35rem;">
        <option value="">Vyber jednotku</option>
        <option>W</option><option>kW</option><option>MW</option>
      </select>
    `;
  } else {
    resultLabel = "Výsledek — P₀";
    resultUnitHtml = `
      <select id="resUnit" class="input select" style="max-width:130px;margin-top:0.35rem;">
        <option value="">Vyber jednotku</option>
        <option>W</option><option>kW</option><option>MW</option>
      </select>
    `;
  }

  S(`
    <h2 class="subtitle">2. Výpočet a odpověď</h2>

    <div class="summary-box">
      <div class="summary-title">Shrnutí zápisu</div>
      ${lines.map((t) => `<div class="summary-line">${t}</div>`).join("")}
    </div>

    <div class="tools-strip">
      <button type="button" id="btnToolTriangle" class="tool-btn">Trojúhelník – vzorec</button>
      <button type="button" id="btnToolCalc" class="tool-btn">Kalkulačka</button>
    </div>
    <div id="toolsPanel" class="tools-panel">
      <div id="trianglePanel" class="tool-view">
        <img src="ucinnost-vzorec.png" alt="Trojúhelník pro vztah P, η, P₀">
      </div>
      <div id="calcPanel" class="tool-view">
        <div class="calc">
          <div class="calc-display">
            <div id="calcMain" class="calc-line-main">0</div>
            <div id="calcSub" class="calc-line-sub">Zadej výraz pomocí tlačítek nebo klávesnice.</div>
          </div>
          <div class="calc-grid">
            <button class="calc-btn fn" data-cmd="C">C</button>
            <button class="calc-btn fn" data-cmd="CE">CE</button>
            <button class="calc-btn fn" data-cmd="copy">COPY</button>
            <button class="calc-btn op" data-val="/">÷</button>

            <button class="calc-btn" data-val="7">7</button>
            <button class="calc-btn" data-val="8">8</button>
            <button class="calc-btn" data-val="9">9</button>
            <button class="calc-btn op" data-val="*">×</button>

            <button class="calc-btn" data-val="4">4</button>
            <button class="calc-btn" data-val="5">5</button>
            <button class="calc-btn" data-val="6">6</button>
            <button class="calc-btn op" data-val="-">−</button>

            <button class="calc-btn" data-val="1">1</button>
            <button class="calc-btn" data-val="2">2</button>
            <button class="calc-btn" data-val="3">3</button>
            <button class="calc-btn op" data-val="+">+</button>

            <button class="calc-btn" data-val="0">0</button>
            <button class="calc-btn" data-val=".">.</button>
            <button class="calc-btn fn" data-cmd="back">⌫</button>
            <button class="calc-btn equals" data-cmd="=">=</button>
          </div>
        </div>
      </div>
    </div>

       <!-- Vzorec -->
    <div style="margin-top:0.4rem;">
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
      <input id="formula" class="input full-input" type="text" placeholder="${formulaHint}">
    </div>

    <!-- Dosaď do vzorce -->
    <div style="margin-top:0.8rem;">
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
      <input id="subst" class="input full-input" type="text" placeholder="např. η = ${fmtComma(problem.PW)} / ${fmtComma(problem.P0W)}">
    </div>


    <!-- Výsledek -->
    <div style="margin-top:0.8rem;">
      <label>${resultLabel}</label>
      <input id="resVal" class="input full-input" type="text" inputmode="decimal" placeholder="číslo">
      ${resultUnitHtml}
    </div>

   <!-- Odpověď -->
<div>
  <label>Odpověď</label>
  <p class="answer-sentence">
    ${template.replace(
      "__",
      '<input id="answerInput" type="text" class="input-inline" inputmode="decimal" placeholder="výsledek">'
    )}
  </p>
  <div id="autoAnswer" class="feedback muted"></div>
</div>


    <div id="calcMsg" class="feedback muted"></div>
  `);

  // nástrojová tlačítka
  const toolsPanel = document.getElementById("toolsPanel");
  const triPanel = document.getElementById("trianglePanel");
  const calcPanel = document.getElementById("calcPanel");
  const btnTri = document.getElementById("btnToolTriangle");
  const btnCalc = document.getElementById("btnToolCalc");

  function showTool(which) {
    if (!toolsPanel) return;
    if (which === "triangle") {
      toolsPanel.classList.add("visible");
      triPanel.classList.add("active");
      calcPanel.classList.remove("active");
      btnTri.classList.add("active");
      btnCalc.classList.remove("active");
    } else if (which === "calc") {
      toolsPanel.classList.add("visible");
      triPanel.classList.remove("active");
      calcPanel.classList.add("active");
      btnTri.classList.remove("active");
      btnCalc.classList.add("active");
    } else {
      toolsPanel.classList.remove("visible");
      triPanel.classList.remove("active");
      calcPanel.classList.remove("active");
      btnTri.classList.remove("active");
      btnCalc.classList.remove("active");
    }
  }

  if (btnTri)
    btnTri.addEventListener("click", () => {
      if (triPanel.classList.contains("active")) showTool(null);
      else showTool("triangle");
    });
  if (btnCalc)
    btnCalc.addEventListener("click", () => {
      if (calcPanel.classList.contains("active")) showTool(null);
      else showTool("calc");
    });

  // kalkulačka – jednoduchý engine
  const calcMain = document.getElementById("calcMain");
  const calcSub = document.getElementById("calcSub");
  let expr = "";

  function updateCalcDisplay(text, sub) {
    if (calcMain) calcMain.textContent = text || "0";
    if (calcSub) calcSub.textContent = sub || "";
  }

  function evalExpr() {
    try {
      // jednoduché vyhodnocení, ne dělání zázraků :)
      // eslint-disable-next-line no-eval
      const res = eval(expr || "0");
      updateCalcDisplay(String(res), expr);
      expr = String(res);
    } catch {
      updateCalcDisplay("Chyba", expr);
    }
  }

  function handleCmd(cmd, val) {
    if (cmd === "C") {
      expr = "";
      updateCalcDisplay("0", "");
    } else if (cmd === "CE") {
      expr = "";
      updateCalcDisplay("0", "");
    } else if (cmd === "back") {
      expr = expr.slice(0, -1);
      updateCalcDisplay(expr || "0", "");
    } else if (cmd === "=") {
      evalExpr();
    } else if (cmd === "copy") {
      if (navigator.clipboard) navigator.clipboard.writeText(calcMain.textContent || "");
      updateCalcDisplay(calcMain.textContent || "0", "Zkopírováno do schránky.");
    } else if (val) {
      expr += val;
      updateCalcDisplay(expr, "");
    }
  }

  E.content.querySelectorAll(".calc-btn").forEach((btn) => {
    const cmd = btn.getAttribute("data-cmd");
    const val = btn.getAttribute("data-val");
    btn.addEventListener("click", () => handleCmd(cmd, val));
  });

    // tlačítka pro vkládání symbolů do vzorce / dosazení
  E.content.querySelectorAll(".inline-buttons").forEach((group) => {
    const targetId = group.getAttribute("data-target");
    group.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        let target = document.activeElement;
        // pokud kurzor není zrovna v cílovém poli, vezmeme ho podle ID
        if (!(target && target.id === targetId)) {
          target = document.getElementById(targetId);
        }
        if (!target) return;

        const ins = btn.getAttribute("data-ins") || "";
        const start = target.selectionStart ?? target.value.length;
        const end   = target.selectionEnd   ?? target.value.length;

        target.value =
          target.value.slice(0, start) +
          ins +
          target.value.slice(end);

        const pos = start + ins.length;
        target.focus();
        target.selectionStart = target.selectionEnd = pos;
      });
    });
  });


  // základní kontrola pro povolení Next
  function validateCalc() {
    let ok = true;
    const resVal = document.getElementById("resVal");
    const resUnit = document.getElementById("resUnit");

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

// ---------- Render hlavní ----------

function render() {
  renderZadani();
  if (!E.content) return;

  document.querySelectorAll(".step").forEach((el) => {
    const s = Number(el.getAttribute("data-step"));
    el.classList.toggle("active", s === step);
  });

  if (E.btnBack) E.btnBack.disabled = step === 1;
  if (E.btnCheck) E.btnCheck.style.display = step === 2 ? "" : "none";

  if (step === 1) renderStep1();
  else renderStep2();

  toggleNext();
}

// ---------- Next/Back ----------

function toggleNext() {
  if (!STRICT_FLOW || !E.btnNext) return;
  let allow = true;
  if (step === 1) allow = gates.writeOk;
  if (step === 2) allow = gates.calcOk;
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
    box.className = "feedback";
  }
  if (ansBox) {
    ansBox.textContent = "";
    ansBox.className = "feedback";
  }

  const formulaRaw = (document.getElementById("formula")?.value || "").trim();
  const substRaw =
    (document.getElementById("subst")?.value || "").trim();
  const formula = formulaRaw.replace(/\s+/g, "").replace(/eta/gi, "η");
  const subst = substRaw;

  // ——— 1) kontrola vzorce ———
  let goodFormula = false;
  if (problem.type === "eta")
    goodFormula = formula === "η=P/P₀" || formula === "η=P:P₀";
  if (problem.type === "P")
    goodFormula =
      formula === "P=η·P₀" ||
      formula === "P=(η:100)·P₀" ||
      formula === "P=η*P₀";
  if (problem.type === "P0")
    goodFormula =
      formula === "P₀=P/η" ||
      formula === "P₀=P/(η:100)" ||
      formula === "P₀=P:(η:100)";

  // ——— 2) kontrola dosazení ———
  let goodSubst = false;
  if (substRaw) {
    const s = substRaw.replace(/\s+/g, "");
    if (problem.type === "eta") {
      // chceme, aby tam byla η, P i P₀
      goodSubst = /η/.test(s) && /P/.test(s) && /P₀/.test(s);
    } else if (problem.type === "P") {
      // P = něco z η a P₀
      goodSubst = /η/.test(s) && /P₀/.test(s);
    } else {
      // P₀ = něco z P a η
      goodSubst = /P/.test(s) && /η/.test(s);
    }
  } else {
    goodSubst = false;
  }

  // ——— 3) číselný výsledek ———
  const resValEl = document.getElementById("resVal");
  const resUnitEl = document.getElementById("resUnit");

  let numericOk = false;
  let acc = 0;
  let msg = "";
  const tolRel = 0.005; // 0,5 %

  if (problem.type === "eta") {
    const v = toNum(resValEl?.value);
    if (isFinite(v)) {
      acc = 100 - Math.min(100, Math.abs(v - problem.eta));
      numericOk =
        Math.abs(v - problem.eta) <=
        Math.max(1e-6, problem.eta * tolRel);
    }
    if (!goodFormula) {
      msg = "Vzorec není zapsán správně.";
    } else if (!goodSubst) {
      msg = "Dosazení do vzorce není zapsáno správně.";
    } else if (!numericOk) {
      msg = `Výsledek nesouhlasí. Očekává se přibližně ${fmtComma(
        problem.eta
      )} %.`;
    } else {
      msg = `Vzorec i výsledek jsou v pořádku. η ≈ ${fmtComma(
        problem.eta
      )} %.`;
    }
  } else if (problem.type === "P") {
    const v = toNum(resValEl?.value);
    const u = resUnitEl?.value || "W";
    const got = v * (F[u] || 1);
    const want = problem.PW;

    if (isFinite(got)) {
      acc =
        100 - Math.min(100, (Math.abs(got - want) / want) * 100);
      numericOk =
        Math.abs(got - want) <= Math.max(1e-6, want * tolRel);
    }

    if (!goodFormula) {
      msg = "Vzorec není zapsán správně.";
    } else if (!goodSubst) {
      msg = "Dosazení do vzorce není zapsáno správně.";
    } else if (!numericOk) {
      msg = `Výsledek nesouhlasí. Očekává se přibližně ${fmtW(
        want
      )}.`;
    } else {
      msg = `Vzorec i výsledek jsou v pořádku. P ≈ ${fmtW(want)}.`;
    }
  } else {
    // type === "P0"
    const v = toNum(resValEl?.value);
    const u = resUnitEl?.value || "W";
    const got = v * (F[u] || 1);
    const want = problem.P0W;

    if (isFinite(got)) {
      acc =
        100 - Math.min(100, (Math.abs(got - want) / want) * 100);
      numericOk =
        Math.abs(got - want) <= Math.max(1e-6, want * tolRel);
    }

    if (!goodFormula) {
      msg = "Vzorec není zapsán správně.";
    } else if (!goodSubst) {
      msg = "Dosazení do vzorce není zapsáno správně.";
    } else if (!numericOk) {
      msg = `Výsledek nesouhlasí. Očekává se přibližně ${fmtW(
        want
      )}.`;
    } else {
      msg = `Vzorec i výsledek jsou v pořádku. P₀ ≈ ${fmtW(want)}.`;
    }
  }

  // ——— 4) slovní odpověď – musí být vyplněná ———
  const ansInput = document.getElementById("answerInput");
  const ansVal = toNum(ansInput?.value);
  const hasAns = isFinite(ansVal);

  if (ansBox) {
    if (!hasAns) {
      ansBox.textContent =
        "Doplň číselný výsledek také do odpovědi.";
      ansBox.classList.add("error");
    } else {
      let answer = "";
      if (problem.type === "eta") {
        answer = `Účinnost ${
          problem.device.name.toLowerCase()
        } je přibližně ${fmtComma(problem.eta)} %.`;
      } else if (problem.type === "P") {
        answer = `Užitečný výkon zařízení je přibližně ${fmtW(
          problem.PW
        )}.`;
      } else {
        answer = `Celkový příkon zařízení je přibližně ${fmtW(
          problem.P0W
        )}.`;
      }
      ansBox.textContent = answer;
      ansBox.classList.add("success");
    }
  }

  // ——— 5) vyhodnocení + statistiky ———
  const ok =
    goodFormula && goodSubst && numericOk && hasAns;

  if (box) {
    box.textContent = msg;
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
}


// ---------- Ovládání ----------

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

// ---------- Start ----------

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
  setStats();
  wire();
  newTask(true); // hned vygeneruj první úlohu
});
