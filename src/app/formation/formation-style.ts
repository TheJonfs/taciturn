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
  --phys:#e2965f; --mag:#a88fe4; --hyb:#5fc4ae; --lock:#3d456e; --afford:#7fc08c;
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
/* Portrait filling an avatar frame (roster card + dossier seal). object-position
   top keeps the face when a taller portrait is cover-cropped into the frame. */
.tf-face{width:100%;height:100%;object-fit:cover;object-position:top center;border-radius:inherit;display:block}
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

/* ---- Dossier (View 2) ---- */
.tf-doss-wrap{max-width:940px}
.tf-doss{display:flex;gap:18px;align-items:center;background:linear-gradient(180deg,var(--panel),var(--void));border:1px solid var(--line);border-radius:16px;padding:16px 22px}
.tf-seal{width:64px;height:64px;border-radius:50%;flex:none;background:var(--mist);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:31px;font-weight:600;border:1.5px solid}
.tf-doss-who{flex:1;min-width:0}
.tf-doss-name{font-family:var(--serif);font-size:29px;font-weight:600;line-height:1.05}
.tf-doss-sub{font-size:12.5px;color:var(--star2);margin-top:2px}
.tf-doss-stats{display:flex;gap:16px;margin-top:11px;flex-wrap:wrap}
.tf-stat{font-size:10px;color:var(--star3);letter-spacing:.1em;text-transform:uppercase}
.tf-stat b{display:block;font-family:var(--mono);font-size:15px;color:var(--star);font-weight:500;margin-top:1px}
.tf-purse{text-align:right;flex:none}
.tf-purse-lab{font-size:10px;color:var(--star3);letter-spacing:.11em;text-transform:uppercase}
.tf-purse-val{font-family:var(--mono);font-size:25px;color:var(--brass);font-weight:500;margin-top:1px}
.tf-purse-val .u{font-size:12px;color:var(--brass2)}
.tf-purse-inv{font-size:10.5px;color:var(--star3);font-family:var(--mono);margin-top:3px}

.tf-tabs{display:flex;gap:2px;margin:20px 0 8px;border-bottom:1px solid var(--line)}
.tf-tab{font-family:var(--serif);font-size:19px;font-weight:600;color:var(--star3);padding:7px 18px 12px;cursor:pointer;background:none;border:none;position:relative;letter-spacing:.02em}
.tf-tab:hover{color:var(--star2)}
.tf-tab.on{color:var(--star)}
.tf-tab.on::after{content:"";position:absolute;left:14px;right:14px;bottom:-1px;height:2px;background:var(--brass)}
.tf-tab.dis{color:var(--lock, #3d456e);cursor:default}
.tf-tab-m{font-family:var(--sans);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#3d456e;margin-left:6px;vertical-align:2px}
.tf-panel{margin-top:6px}
.tf-panel svg{width:100%;height:auto;display:block}

.tf-cap{font-size:11.5px;color:var(--star3);text-align:center;margin-top:4px;letter-spacing:.01em}
.tf-cap b{color:var(--star2);font-weight:400}
.tf-starg.pick{cursor:pointer}
.tf-lbl{font-family:var(--serif);font-size:15px;font-weight:600;text-anchor:middle}
.tf-jpt{font-family:var(--mono);font-size:10.5px;text-anchor:middle;fill:var(--star3)}
.tf-why{font-size:10px;text-anchor:middle;fill:var(--brass2)}
.tf-band{font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;fill:var(--star3)}
.tf-dom{font-family:var(--serif);font-size:15px;font-weight:600;text-anchor:middle}
@keyframes tf-ignite{0%{opacity:.2;transform:scale(.3)}60%{opacity:1;transform:scale(1.4)}100%{transform:scale(1)}}
.tf-newly{transform-box:fill-box;transform-origin:center;animation:tf-ignite .75s ease}

.tf-aggr{display:flex;gap:12px;margin-top:14px;flex-wrap:wrap}
.tf-agg{flex:1;min-width:150px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 13px}
.tf-agg-t{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--star3)}
.tf-agg-note{color:var(--star3);text-transform:none;letter-spacing:0}
.tf-agg-nx{font-size:10px;color:var(--star3);margin-top:7px}
.tf-slot{margin-top:8px}
.tf-sl{display:flex;justify-content:space-between;font-size:11px;font-family:var(--mono)}
.tf-sl span:first-child{color:var(--star2);font-family:var(--sans)}
.tf-sl .ok{color:var(--afford, #7fc08c)}
.tf-sl .sh{color:var(--brass)}
.tf-bar{height:3px;border-radius:2px;background:var(--line);margin-top:4px;overflow:hidden}
.tf-bar i{display:block;height:100%;border-radius:2px}

.tf-note{font-size:13px;color:var(--star2);background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:13px 15px;line-height:1.6}
.tf-note b{color:var(--star)}

/* ---- Training (JP-spend) ---- */
.tf-train-head{font-size:12px;color:var(--star3);margin:2px 0 4px}
.tf-train-head b{color:var(--brass);font-family:var(--mono)}
.tf-train-note{color:var(--hyb)}
.tf-sec{margin-top:16px}
.tf-sech{display:flex;align-items:baseline;gap:10px;margin-bottom:2px}
.tf-sech h3{font-family:var(--serif);font-size:20px;font-weight:600}
.tf-sech p{font-size:12px;color:var(--star3)}
.tf-abil{display:flex;align-items:center;gap:13px;padding:11px 2px;border-bottom:1px solid var(--line)}
.tf-abil:last-child{border-bottom:none}
.tf-aico{width:30px;height:30px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center;background:var(--mist);color:var(--star3);border:1px solid var(--line)}
.tf-abil.have .tf-aico{color:var(--afford);border-color:rgba(127,192,140,.35);background:rgba(127,192,140,.12)}
.tf-ainfo{flex:1;min-width:0}
.tf-anm{font-size:14px;font-weight:500}
.tf-afx{font-size:12px;color:var(--star2);margin-top:1px}
.tf-cond{color:var(--hyb)}
.tf-aright{flex:none;display:flex;align-items:center;gap:11px}
.tf-buy{font-family:var(--mono);font-size:12px;padding:7px 12px;border-radius:7px;border:1px solid var(--brass2);background:transparent;color:var(--brass);cursor:pointer;white-space:nowrap}
.tf-buy:hover{background:rgba(216,178,108,.13)}
.tf-buy.no{border-color:var(--line);color:var(--star3);cursor:default}
.tf-buy.no:hover{background:transparent}
.tf-havet{font-size:12px;white-space:nowrap;text-align:right}
.tf-havet .k{color:var(--afford)}
.tf-havet .e{display:block;font-family:var(--mono);font-size:10px;color:var(--star3);margin-top:1px}

/* ---- Loadout (Customize) ---- */
.tf-load-sec{margin-top:16px}
.tf-load-h{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
.tf-load-h h3{font-family:var(--serif);font-size:20px;font-weight:600}
.tf-load-c{font-size:11px;color:var(--star3);font-family:var(--mono)}
.tf-load-empty{font-size:12px;color:var(--star3);padding:8px 2px}
.tf-opt{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 12px;margin:5px 0;background:var(--panel);border:1px solid var(--line);border-radius:9px;color:var(--star);font-family:inherit}
.tf-opt.pick{cursor:pointer;transition:border-color .12s,background .12s}
.tf-opt.pick:hover{border-color:var(--line2)}
.tf-opt.on{border-color:var(--brass2);background:rgba(216,178,108,.07)}
.tf-opt.locked{opacity:.9}
.tf-opt.dis{opacity:.4;cursor:not-allowed}
.tf-opt-sw{width:10px;height:10px;border-radius:3px;flex:none}
.tf-opt-info{flex:1;min-width:0}
.tf-opt-nm{font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px}
.tf-opt-fx{font-size:12px;color:var(--star2);margin-top:1px}
.tf-opt-check{flex:none;color:var(--brass);font-weight:700;width:16px;text-align:center}
.tf-opt-check.lead{width:14px}
.tf-opt-pin{flex:none;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--star3)}
.tf-opt-tag{font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:1px 6px;border-radius:8px;font-weight:600}
.tf-opt-tag.innate{color:var(--afford);background:rgba(127,192,140,.12);border:1px solid rgba(127,192,140,.3)}
.tf-opt-tag.exported{color:var(--brass);background:rgba(216,178,108,.1);border:1px solid var(--brass2)}
.tf-opt-cost{flex:none;font-family:var(--mono);font-size:10.5px;color:var(--star3);white-space:nowrap}
.tf-class-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
.tf-class-chip{font-family:var(--serif);font-size:14px;font-weight:600;padding:6px 14px;border-radius:20px;cursor:pointer;transition:.12s;background:color-mix(in srgb,var(--cc) 12%,var(--panel));color:var(--cc);border:1px solid color-mix(in srgb,var(--cc) 45%,var(--line))}
.tf-class-chip:hover{background:color-mix(in srgb,var(--cc) 22%,var(--panel))}

/* ---- Merged Loadout: two-column equipment | abilities (M3) ---- */
.tf-load-cols{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:24px;align-items:start;margin-top:4px}
@media(max-width:880px){.tf-load-cols{grid-template-columns:1fr}}

/* Collapsible section headers (right column density refactor). */
.tf-load-h.click{cursor:pointer;user-select:none;border-radius:6px}
.tf-load-h.click:hover h3{color:var(--star)}
.tf-chev{font-size:10px;color:var(--star3);transition:transform .15s;display:inline-block;margin-right:2px}
.tf-chev.open{transform:rotate(90deg)}
.tf-load-sum{font-size:11.5px;color:var(--star2);flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}

/* Compact ability rows inside the merged right column. */
.tf-compact .tf-opt{padding:7px 10px;margin:4px 0;gap:10px}
.tf-compact .tf-opt-nm{font-size:13px}
.tf-compact .tf-opt-fx{font-size:11px}
.tf-compact .tf-load-sec{margin-top:12px}

/* Change-class affordance (chips collapse behind a button). */
.tf-class-btn{font-family:var(--sans);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--brass);background:none;border:1px solid var(--brass2);border-radius:14px;padding:4px 12px;cursor:pointer;flex:none}
.tf-class-btn:hover{background:rgba(216,178,108,.1)}

/* Equipment slot pills + inline pickers (left column). */
.tf-eq-slot{margin:5px 0}
.tf-eq-pill{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 12px;background:var(--panel);border:1px solid var(--line);border-radius:9px;color:var(--star);font-family:inherit;cursor:pointer;transition:border-color .12s}
.tf-eq-pill:hover{border-color:var(--line2)}
.tf-eq-pill.open{border-color:var(--brass2)}
.tf-eq-slotlab{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--star3);width:72px;flex:none}
.tf-eq-nm{flex:1;min-width:0;font-size:13.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tf-eq-nm.empty{color:var(--star3);font-style:italic;font-weight:400}
.tf-eq-count{font-family:var(--mono);font-size:10px;color:var(--star3);flex:none}
.tf-eq-list{border:1px solid var(--line);border-radius:9px;margin-top:4px;padding:5px;background:#0e1330;max-height:320px;overflow-y:auto}
.tf-eq-search{display:flex;align-items:center;gap:6px;margin:2px 2px 6px;padding:5px 9px;background:var(--panel);border:1px solid var(--line);border-radius:7px}
.tf-eq-search input{flex:1;background:transparent;border:none;outline:none;color:var(--star);font-family:var(--sans);font-size:12px}
.tf-eq-search input::placeholder{color:var(--star3)}
.tf-eq-grouph{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--star3);padding:8px 8px 3px;display:flex;gap:6px;align-items:baseline}
.tf-eq-grouph b{color:var(--star3);font-family:var(--mono);font-weight:400;font-size:9.5px}
.tf-eq-row{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:6px 8px;background:transparent;border:1px solid transparent;border-radius:6px;color:var(--star);font-family:inherit;font-size:12.5px;cursor:pointer}
.tf-eq-row:hover{background:var(--mist);border-color:var(--line)}
.tf-eq-row.on{border-color:var(--brass2);background:rgba(216,178,108,.07)}
.tf-eq-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tf-eq-row .st{font-family:var(--mono);font-size:10px;color:var(--star2);flex:none;white-space:nowrap}
.tf-eq-row .fr{font-family:var(--mono);font-size:10px;color:var(--star3);flex:none;width:26px;text-align:right}
.tf-eq-row.empty-row .nm{color:var(--star3);font-style:italic}
.tf-eq-none{font-size:12px;color:var(--star3);padding:8px}

/* ---- Loadout inspector (M3 Stage 3: hover detail + stat deltas) ---- */
.tf-inspect{grid-column:1/-1;min-height:96px;background:linear-gradient(180deg,var(--panel),#0f1430);border:1px solid var(--line);border-radius:10px;padding:11px 14px;margin-top:8px}
.tf-inspect-hint{font-size:12px;color:var(--star3);font-style:italic;padding-top:24px;text-align:center}
.tf-inspect-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.tf-inspect-title{font-family:var(--serif);font-size:17px;font-weight:600}
.tf-inspect-kind{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--brass);border:1px solid var(--brass2);border-radius:9px;padding:1px 7px}
.tf-inspect-ctx{font-size:11px;color:var(--star3);font-family:var(--mono);margin-left:auto}
.tf-inspect-lines{margin-top:5px;font-size:12px;color:var(--star2);line-height:1.55}
.tf-inspect-deltas{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}
.tf-delta{font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:9px;border:1px solid}
.tf-delta.up{color:var(--afford);border-color:rgba(127,192,140,.4);background:rgba(127,192,140,.08)}
.tf-delta.down{color:var(--phys);border-color:rgba(226,150,95,.4);background:rgba(226,150,95,.08)}
.tf-inspect-note{font-size:11px;color:var(--star3);font-style:italic;margin-top:7px}

/* ---- Invalid-loadout surfacing (M3 Stage 2: surface, don't resolve) ---- */
.tf-warnbar{grid-column:1/-1;display:flex;gap:11px;align-items:flex-start;background:rgba(226,150,95,.09);border:1px solid rgba(226,150,95,.45);border-radius:10px;padding:11px 14px;margin-top:12px}
.tf-warnbar .sig{flex:none;color:var(--phys);font-size:16px;line-height:1.3}
.tf-warnbar .bd{min-width:0}
.tf-warnbar .ttl{font-size:13px;font-weight:600;color:var(--phys);letter-spacing:.02em}
.tf-warnbar ul{margin:3px 0 0;padding-left:16px}
.tf-warnbar li{font-size:12px;color:var(--star2);line-height:1.55}
.tf-load-c.over{color:var(--phys);font-weight:600}
.tf-warnbadge{position:absolute;top:8px;right:9px;font-size:13px;color:var(--phys);filter:drop-shadow(0 0 4px rgba(226,150,95,.5));z-index:2}
.tf-doss-warn{display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--phys);border:1px solid rgba(226,150,95,.45);border-radius:10px;padding:2px 8px;vertical-align:4px;margin-left:8px}

/* ---- Toast ---- */
.tf-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(18px);opacity:0;background:var(--mist);border:1px solid var(--line2);color:var(--star);padding:10px 18px;border-radius:9px;font-size:13px;transition:.25s;pointer-events:none;z-index:30}
.tf-toast.show{transform:translateX(-50%) translateY(0);opacity:1}
.tf-toast b{color:var(--brass)}
`;
