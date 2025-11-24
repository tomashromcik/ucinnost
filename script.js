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
    // P₀
    if (writeState.p0.unknown) {
      lines.push(`P₀ = ? ${writeState.p0.unit}`.trim());
    } else {
      lines.push(
        `P₀ = ${fmtComma(writeState.p0.value)} ${writeState.p0.unit}`.trim()
      );
    }
    // P
    if (writeState.p.unknown) {
      lines.push(`P = ? ${writeState.p.unit}`.trim());
    } else {
      lines.push(
        `P = ${fmtComma(writeState.p.value)} ${writeState.p.unit}`.trim()
      );
    }
    // η
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
      `P  = ${fmtComma(problem.P.v)} ${problem.P.u}`,
      `η  = ${problem.eta} %`
    );
  }

  const formulaHint =
    problem.type === "eta"
      ? 'η = P / P₀ (povoleno i „η = P : P₀“)'
      : problem.type === "P"
      ? 'P = η · P₀ (η napiš jako 0,75) nebo „P = (η : 100) · P₀“'
      : 'P₀ = P / (η : 100) nebo „P₀ = P : (η : 100)“';

  // výsledkový blok
  let resultBlock = "";
  if (problem.type === "eta") {
    resultBlock = `
      <label class="section-label">Výsledek — η (%)</label>
      <input id="resVal" class="input wide" type="text" inputmode="decimal" placeholder="např. 75">
    `;
  } else {
    resultBlock = `
      <label class="section-label">Výsledek — ${problem.type === "P" ? "P" : "P₀"}</label>
      <div class="row gap">
        <input id="resVal" class="input wide" type="text" inputmode="decimal" placeholder="hodnota">
        <select id="resUnit" class="input unit-select">
          <option value="">Vyber</option>
          <option>W</option><option>kW</option><option>MW</option>
        </select>
      </div>
    `;
  }

  // šablona odpovědi (věta + pole + výběr jednotky)
  const deviceName =
    problem.device.name === "Turbína"
      ? "Turbína"
      : problem.device.name === "Žárovka" || problem.device.name === "LED žárovka"
      ? "Žárovka"
      : "Zařízení";

  const answerPrefix =
    problem.type === "eta"
      ? `${deviceName} má účinnost `
      : problem.type === "P"
      ? `${deviceName} má užitečný výkon `
      : `${deviceName} má příkon `;

  S(`
    <h2 class="subtitle">2. Výpočet a odpověď</h2>

    <div class="summary-box">
      <div class="summary-title">Shrnutí zápisu</div>
      ${lines.map((t) => `<div class="summary-line">${t}</div>`).join("")}
    </div>

    <!-- Nástroje: trojúhelník + kalkulačka -->
    <div class="tools-row">
      <div class="tools-buttons">
        <button type="button" id="btnTriangle" class="btn-secondary small">Trojúhelník – vzorec</button>
        <button type="button" id="btnCalc" class="btn-secondary small">Kalkulačka</button>
      </div>
    </div>

    <div id="toolsPanel" class="tools-panel" hidden>
      <div id="trianglePanel" class="triangle-panel" hidden>
        <img src="ucinnost-vzorec.png" alt="Pomůcka – trojúhelník η, P, P₀">
      </div>
      <div id="calcPanel" class="calc-panel" hidden>
        <div class="calc-display">
          <div id="calcExpression" class="calc-exp"></div>
          <div id="calcResult" class="calc-res"></div>
        </div>
        <div class="calc-grid">
          ${["7","8","9","4","5","6","1","2","3","0",".",","].map(n => `
            <button type="button" class="key key-num" data-k="${n}">${n}</button>
          `).join("")}
          ${["+", "−", "×", "÷"].map(op => `
            <button type="button" class="key key-op" data-k="${op}">${op}</button>
          `).join("")}
          <button type="button" class="key key-func" data-k="C">C</button>
          <button type="button" class="key key-func" data-k="⌫">⌫</button>
          <button type="button" class="key key-eq" data-k="=">=</button>
        </div>
      </div>
    </div>

    <!-- Vzorec -->
    <div class="section-block">
      <label class="section-label">Vzorec</label>
      <div class="inline-buttons" data-target="formula">
        <button type="button" data-ins="η">η</button>
        <button type="button" data-ins="P">P</button>
        <button type="button" data-ins="P₀">P₀</button>
        <button type="button" data-ins=" · ">·</button>
        <button type="button" data-ins=" / ">/</button>
        <button type="button" data-ins=" : ">:</button>
        <button type="button" data-ins=" = ">=</button>
      </div>
      <input id="formula" class="input wide" type="text" placeholder="${formulaHint}">
    </div>

    <!-- Dosaď do vzorce -->
    <div class="section-block">
      <label class="section-label">Dosaď do vzorce</label>
      <div class="inline-buttons" data-target="subst">
        <button type="button" data-ins="η">η</button>
        <button type="button" data-ins="P">P</button>
        <button type="button" data-ins="P₀">P₀</button>
        <button type="button" data-ins=" · ">·</button>
        <button type="button" data-ins=" / ">/</button>
        <button type="button" data-ins=" : ">:</button>
        <button type="button" data-ins=" = ">=</button>
      </div>
      <input id="subst" class="input wide" type="text" placeholder='např. η = 64 / 120'>
    </div>

    <!-- Výsledek -->
    <div class="section-block">
      ${resultBlock}
    </div>

    <!-- Odpověď -->
    <div class="section-block">
      <label class="section-label">Odpověď</label>
      <div class="summary-box answer-box">
        <span>${answerPrefix}</span>
        <input id="ansVal" class="input answer-input" type="text" inputmode="decimal" placeholder="číslo">
        <select id="ansUnit" class="input unit-select answer-unit">
          <option value="">Vyber</option>
          <option>%</option>
          <option>W</option><option>kW</option><option>MW</option>
        </select>
        <span>.</span>
      </div>
    </div>

    <div id="calcMsg" class="feedback muted"></div>
  `);

  // --- pomocný panel: trojúhelník / kalkulačka ---
const helperPanel     = document.getElementById("helperPanel");
const helperTriangle  = document.getElementById("helperTriangle");
const helperCalc      = document.getElementById("helperCalc");
const btnTriangle     = document.getElementById("btnTriangle");
const btnCalc         = document.getElementById("btnCalc");

function showHelper(which) {
  if (!helperPanel || !helperTriangle || !helperCalc) return;

  helperPanel.classList.add("helper-panel--visible");

  if (which === "triangle") {
    helperTriangle.style.display = "block";
    helperCalc.style.display     = "none";
  } else if (which === "calc") {
    helperTriangle.style.display = "none";
    helperCalc.style.display     = "block";
  }
}

function hideHelper() {
  if (!helperPanel) return;
  helperPanel.classList.remove("helper-panel--visible");
}

// kliknutí na tlačítka
if (btnTriangle) {
  btnTriangle.onclick = () => showHelper("triangle");
}
if (btnCalc) {
  btnCalc.onclick = () => showHelper("calc");
}

// případné tlačítko „zavřít“ v panelu
const helperClose = document.getElementById("helperClose");
if (helperClose) {
  helperClose.onclick = hideHelper;
}


  // kalkulačka + trojúhelník – jednoduché přepínání panelů
  const toolsPanel = document.getElementById("toolsPanel");
  const triPanel   = document.getElementById("trianglePanel");
  const calcPanel  = document.getElementById("calcPanel");

  const btnTriangle = document.getElementById("btnTriangle");
  const btnCalc     = document.getElementById("btnCalc");

  function showPanel(which) {
    if (!toolsPanel) return;
    toolsPanel.hidden = false;
    if (which === "triangle") {
      triPanel.hidden  = false;
      calcPanel.hidden = true;
    } else if (which === "calc") {
      triPanel.hidden  = true;
      calcPanel.hidden = false;
    } else {
      toolsPanel.hidden = true;
    }
  }
  if (btnTriangle) btnTriangle.addEventListener("click", () => showPanel(triPanel.hidden ? "triangle" : "none"));
  if (btnCalc)     btnCalc.addEventListener("click", () => showPanel(calcPanel.hidden ? "calc" : "none"));

  // (volitelné) jednoduchá kalkulačka – jen spojování znaků, výpočet s eval náhradou
  if (calcPanel) {
    const expEl = document.getElementById("calcExpression");
    const resEl = document.getElementById("calcResult");
    let exp = "";

    function renderExp() {
      if (expEl) expEl.textContent = exp;
    }
    function setResult(v) {
      if (resEl) resEl.textContent = v;
    }
    calcPanel.querySelectorAll(".key").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-k");
        if (!k) return;
        if (k === "C") {
          exp = "";
          setResult("");
        } else if (k === "⌫") {
          exp = exp.slice(0, -1);
        } else if (k === "=") {
          try {
            const js = exp
              .replace(/×/g, "*")
              .replace(/÷/g, "/")
              .replace(/,/g, ".")
              .replace(/−/g, "-");
            const val = Function(`"use strict";return (${js})`)();
            if (typeof val === "number" && isFinite(val)) {
              setResult(String(val).replace(".", ","));
            } else {
              setResult("?");
            }
          } catch {
            setResult("chyba");
          }
        } else {
          exp += k;
        }
        renderExp();
      });
    });
  }

  // základní validace pro enable/disable Next (pokud používáš STRICT_FLOW)
  function validateCalc() {
    let ok = true;
    const resVal  = document.getElementById("resVal");
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

// ---------- Kontrola (krok 2) ----------

function doCheck() {
  if (step !== 2 || !problem) return;

  const box    = document.getElementById("calcMsg");
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
  }
  if (problem.type === "P") {
    goodFormula = [
      "P=η·P₀",
      "P=(η:100)·P₀",
      "P=η*P₀",
    ].includes(formula);
  }
  if (problem.type === "P0") {
    goodFormula =
      formula === "P₀=P/η" ||
      ["P₀=P/(η:100)", "P₀=P:(η:100)"].includes(formula);
  }

  const resVal  = document.getElementById("resVal");
  const resUnit = document.getElementById("resUnit");

  let ok  = false;
  let acc = 0;
  let msg = "";
  const tolRel = 0.005; // 0,5 %

  if (problem.type === "eta") {
    const v = toNum(resVal?.value);
    if (isFinite(v)) {
      acc = 100 - Math.min(100, Math.abs(v - problem.eta));
      ok  = Math.abs(v - problem.eta) <= Math.max(1e-6, problem.eta * tolRel);
    }
    msg =
      goodFormula && ok
        ? `Vzorec i výsledek jsou v pořádku. η ≈ ${fmtComma(problem.eta)} %.`
        : !goodFormula
        ? "Vzorec není zapsán správně."
        : `Výsledek nesouhlasí. Očekává se přibližně ${fmtComma(problem.eta)} %.`;
  } else if (problem.type === "P") {
    const v = toNum(resVal?.value);
    const u = resUnit?.value || "W";
    const got  = v * (F[u] || 1);
    const want = problem.PW;
    if (isFinite(got)) {
      acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
      ok  = Math.abs(got - want) <= Math.max(1e-6, want * tolRel);
    }
    msg =
      goodFormula && ok
        ? `Vzorec i výsledek jsou v pořádku. P ≈ ${fmtW(want)}.`
        : !goodFormula
        ? "Vzorec není zapsán správně."
        : `Výsledek nesouhlasí. Očekává se přibližně ${fmtW(want)}.`;
  } else {
    const v = toNum(resVal?.value);
    const u = resUnit?.value || "W";
    const got  = v * (F[u] || 1);
    const want = problem.P0W;
    if (isFinite(got)) {
      acc = 100 - Math.min(100, (Math.abs(got - want) / want) * 100);
      ok  = Math.abs(got - want) <= Math.max(1e-6, want * tolRel);
    }
    msg =
      goodFormula && ok
        ? `Vzorec i výsledek jsou v pořádku. P₀ ≈ ${fmtW(want)}.`
        : !goodFormula
        ? "Vzorec není zapsán správně."
        : `Výsledek nesouhlasí. Očekává se přibližně ${fmtW(want)}.`;
  }

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

  // automaticky generovaná slovní odpověď
  if (ansBox) {
    let answer = "";
    if (problem.type === "eta") {
      answer = `Účinnost ${problem.device.name.toLowerCase()} je přibližně ${fmtComma(
        problem.eta
      )} %.`;
    } else if (problem.type === "P") {
      answer = `Užitečný výkon zařízení je přibližně ${fmtW(problem.PW)}.`;
    } else {
      answer = `Celkový příkon zařízení je přibližně ${fmtW(problem.P0W)}.`;
    }
    ansBox.textContent = answer;
    ansBox.classList.add(ok ? "success" : "error");
  }
}

// ---------- Ovládání ----------



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
