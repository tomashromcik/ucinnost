// Jednotky
const FACTOR = { W:1, kW:1000, MW:1000000 }

const el = (id)=> document.getElementById(id)
const pinVal = el('pinVal')
const pinUnit = el('pinUnit')
const puseVal = el('puseVal')
const puseUnit = el('puseUnit')
const etaOut = el('etaOut')
const lossOut = el('lossOut')
const puseOut = el('puseOut')
const note = el('note')
const year = el('year')
year.textContent = new Date().getFullYear()

function toW(value, unit){ return Number(value||0) * FACTOR[unit] }
function fmtW(w){
  if (w >= 1_000_000) return (w/1_000_000).toFixed(3)+' MW'
  if (w >= 1_000) return (w/1_000).toFixed(3)+' kW'
  return w.toFixed(2)+' W'
}

// Gauge animation
const needle = document.getElementById('needle')
const gaugeText = document.getElementById('gaugeText')

function setGauge(percent){
  const p = Math.max(0, Math.min(100, percent||0))
  const angle = -120 + (p/100)*240
  needle.setAttribute('transform', `translate(100,110) rotate(${angle})`)
  gaugeText.textContent = `η = ${p.toFixed(1)} %`
}

function calculate(){
  const Pin = toW(pinVal.value, pinUnit.value)
  const Puse = toW(puseVal.value, puseUnit.value)
  if (!isFinite(Pin) || Pin <= 0 || !isFinite(Puse) || Puse < 0){
    note.hidden = false
    note.textContent = 'Zadej kladné hodnoty a ujisti se, že P_in > 0.'
    setGauge(0); etaOut.textContent='–'; lossOut.textContent='–'; puseOut.textContent='–'
    return
  }
  note.hidden = true
  const eta = (Puse/Pin)*100
  const loss = Math.max(Pin - Puse, 0)
  setGauge(eta)
  etaOut.textContent = eta.toFixed(1)+' %'
  lossOut.textContent = fmtW(loss)
  puseOut.textContent = fmtW(Puse)
}

// Demo values
function demo(){
  pinUnit.value='kW'; puseUnit.value='kW'
  pinVal.value=200; puseVal.value=150
  calculate()
}

// Reset
function resetAll(){
  pinVal.value=''; puseVal.value=''
  setGauge(0); etaOut.textContent='–'; lossOut.textContent='–'; puseOut.textContent='–'
  note.hidden=true
}

document.getElementById('btnCalc').addEventListener('click', calculate)
document.getElementById('btnDemo').addEventListener('click', demo)
document.getElementById('btnReset').addEventListener('click', resetAll)

// inicializace
setGauge(0)
