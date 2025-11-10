import React, { useMemo, useState } from 'react'
</div>
<p className="text-sm text-gray-300">Stejný tvar platí i pro energie (E), zde pracujeme s výkony.</p>
</div>
)}
{active===3 && (
<div className="card p-4 space-y-4">
<h3 className="text-lg font-semibold">4. Dosaď a vypočítej</h3>
<p className="text-sm text-gray-400">Dosazení: η = {PuseW.toFixed(2)} / {PinW.toFixed(2)} × 100 %</p>
<EfficiencyGauge value={isFinite(eta)? eta : 0} />
<div className="grid sm:grid-cols-3 gap-3">
<div className="card p-3"><div className="text-xs text-gray-400">Účinnost</div><div className="text-xl font-semibold">{isFinite(eta)? eta.toFixed(1): '–'} %</div></div>
<div className="card p-3"><div className="text-xs text-gray-400">Ztrátový výkon</div><div className="text-xl font-semibold">{formatPower(Math.max(PinW-PuseW,0))}</div></div>
<div className="card p-3"><div className="text-xs text-gray-400">Užitečný výkon</div><div className="text-xl font-semibold">{formatPower(PuseW)}</div></div>
</div>
</div>
)}
{active===4 && (
<div className="card p-4 space-y-2">
<h3 className="text-lg font-semibold">5. Vyhodnocení</h3>
<p className="text-sm text-gray-300">Účinnost vychází <b>{eta.toFixed(1)} %</b>. Čím blíže ke 100 %, tím menší ztráty.</p>
<p className="text-xs text-gray-400">Tip: Změň vstupy a sleduj, jak se mění ukazatel.</p>
</div>
)}
</motion.div>
</AnimatePresence>


<div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
<div className="text-xs text-gray-400">Vzorec: η = P_užit / P_in × 100 %</div>
<div className="flex gap-2">
<button className="btn" onClick={()=> setActive(v=> Math.max(0,v-1))}>Zpět</button>
{active<4 ? (
<button className="btn btn-primary" onClick={()=> setActive(v=> Math.min(4,v+1))}>Pokračovat →</button>
) : (
<a className="btn btn-primary" href="#">Dokončit</a>
)}
</div>
</div>
</section>
</main>


<footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-gray-400">
© {new Date().getFullYear()} Učební app – účinnost (W / kW / MW). Demo pro GitHub Pages.
</footer>
</div>
</MotionConfig>
)
}
