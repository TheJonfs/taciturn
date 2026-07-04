// Formation UI — the scoped celestial stylesheet (TABA M2).
//
// Injected once via a <style> element by the formation screens. Every rule is
// scoped under `.tf-root` so it can't leak into the rest of the app. Ports the
// aesthetic of `docs/TABADesign/formation-roster.html` +
// `formation-celestial-2.html`: void-blue panels, brass accents, serif display
// type, domain colours (phys/mag/hyb). The star-chart/aggregate/training rules
// are added as their commits land.
//
// Kept as a string constant (not a .css import) so it travels with the
// components without a build-time CSS pipeline dependency, and so the whole
// formation skin lives in one greppable place.

export const FORMATION_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap');

.tf-root{
  --void:#0c1024; --panel:#141a36; --mist:#1b2247; --line:#2a3260; --line2:#404b80;
  --star:#eee9dd; --star2:#98a1c8; --star3:#5f6997;
  --brass:#d8b26c; --brass2:#8f7644;
  --phys:#e2965f; --mag:#a88fe4; --hyb:#5fc4ae;
  --serif:'Cormorant Garamond',Georgia,serif;
  --sans:system-ui,'Segoe UI',Roboto,sans-serif;
  --mono:'SF Mono',ui-monospace,Consolas,monospace;
  position:relative; width:100%; height:100%; min-height:100%; overflow-y:auto; overflow-x:hidden;
  background:var(--void); color:var(--star); font-family:var(--sans); line-height:1.5;
  background-image:radial-gradient(1200px 700px at 50% -5%,rgba(120,110,200,.12),transparent 60%),radial-gradient(800px 500px at 88% 95%,rgba(95,196,174,.05),transparent 60%);
}
.tf-root *{box-sizing:border-box;margin:0;padding:0}
.tf-sky{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
.tf-wrap{max-width:1020px;margin:0 auto;position:relative;z-index:1;padding:30px 22px 70px}

.tf-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:6px}
.tf-head h1{font-family:var(--serif);font-size:38px;font-weight:600;letter-spacing:.01em;line-height:1}
.tf-s{font-size:15px;color:var(--star3);letter-spacing:.22em;text-transform:uppercase;font-family:var(--sans);font-weight:400;display:block;margin-bottom:6px}
.tf-summ{font-size:13px;color:var(--star2);text-align:right}
.tf-summ b{color:var(--brass);font-family:var(--mono)}

.tf-filters{display:flex;flex-direction:column;gap:9px;margin:18px 0 22px}
.tf-frow{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.tf-grp{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--star3);width:42px;flex:none}
.tf-chip{font-size:12.5px;padding:6px 14px;border-radius:20px;border:1px solid var(--line);background:var(--panel);color:var(--star2);cursor:pointer;transition:.12s;display:inline-flex;align-items:center;gap:6px;font-family:inherit}
.tf-chip:hover{border-color:var(--line2);color:var(--star)}
.tf-chip.on{border-color:var(--brass2);color:var(--brass);background:rgba(216,178,108,.08)}
.tf-chip i{width:8px;height:8px;border-radius:2px;display:inline-block}

.tf-back{background:none;border:none;font-family:var(--sans);font-size:12px;color:var(--star3);letter-spacing:.14em;text-transform:uppercase;cursor:pointer;margin-bottom:14px;display:inline-block;padding:0}
.tf-back:hover{color:var(--star2)}

.tf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(224px,1fr));gap:15px}
.tf-empty{color:var(--star3);font-size:14px;padding:30px 0;text-align:center}
.tf-card{background:linear-gradient(180deg,var(--panel),#0f1430);border:1px solid var(--line);border-radius:14px;padding:16px 16px 14px;cursor:pointer;position:relative;transition:transform .11s,border-color .13s;overflow:hidden}
.tf-card:hover{transform:translateY(-3px);border-color:var(--dc)}
.tf-card:focus-visible{outline:none;border-color:var(--dc);box-shadow:0 0 0 2px rgba(216,178,108,.4)}
.tf-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--dc);opacity:.75}
.tf-top{display:flex;gap:13px;align-items:center}
.tf-port{width:60px;height:70px;border-radius:9px;flex:none;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:30px;font-weight:600;color:var(--dc);background:linear-gradient(155deg,color-mix(in srgb,var(--dc) 22%,#1a2038),#141a30);border:1.5px solid var(--dc);position:relative}
.tf-aura{position:absolute;inset:-8px;border-radius:12px;pointer-events:none}
.tf-glint{position:absolute;top:-6px;left:38px;display:flex;align-items:center;gap:3px;background:#141a30;border:1px solid var(--brass2);border-radius:11px;padding:2px 7px 2px 5px;box-shadow:0 0 10px -2px var(--brass);z-index:2}
.tf-glint svg{filter:drop-shadow(0 0 3px var(--brass));animation:tf-tw 2.6s ease-in-out infinite}
.tf-glint b{font-family:var(--mono);font-size:10.5px;color:var(--brass);font-weight:500}
@keyframes tf-tw{0%,100%{opacity:.85}50%{opacity:.45}}
.tf-who{min-width:0;flex:1}
.tf-nm{font-family:var(--serif);font-size:20px;font-weight:600;line-height:1.05;display:flex;align-items:center;gap:6px}
.tf-crest{color:var(--brass);flex:none;display:inline-flex}
.tf-cl{font-size:12.5px;margin-top:2px}
.tf-cl .c{font-weight:500}
.tf-cl .lv{color:var(--star3)}
.tf-foot{display:flex;align-items:center;justify-content:space-between;margin-top:13px;padding-top:11px;border-top:1px solid var(--line)}
.tf-trace{display:flex;align-items:center;gap:5px;height:14px}
.tf-uniq{font-size:9.5px;color:var(--brass);letter-spacing:.1em;text-transform:uppercase}
`;
