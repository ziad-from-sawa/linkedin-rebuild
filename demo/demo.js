// LinkedIn Rebuild demo. Every frame is a pure function of time t (seconds),
// so the same page plays live in a browser and renders frame by frame to MP4.
(() => {
  const D = window.DATA;
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = {
    out: (x) => 1 - Math.pow(1 - x, 3),
    quint: (x) => 1 - Math.pow(1 - x, 5),
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  // [[t, v], ...] -> value at t, eased between frames
  const kf = (t, frames, e = ease.inOut) => {
    if (t <= frames[0][0]) return frames[0][1];
    for (let i = 1; i < frames.length; i++) {
      const [t1, v1] = frames[i];
      const [t0, v0] = frames[i - 1];
      if (t <= t1) return lerp(v0, v1, e(prog(t, t0, t1)));
    }
    return frames[frames.length - 1][1];
  };
  const set = (el, o, tf) => {
    el.style.opacity = o;
    if (tf !== undefined) el.style.transform = tf;
  };
  const appear = (el, t, at, dy = 24, dur = 0.55) => {
    const k = ease.quint(prog(t, at, at + dur));
    set(el, k, `translateY(${(1 - k) * dy}px)`);
    return k;
  };

  // ---------- timeline ----------
  const T = {
    intro: [0, 3.6],
    choose: [3.6, 10.6],
    scan: [10.6, 23.6],
    rec: [23.6, 31.6],
    gen: [31.6, 42.6],
    email: [42.6, 55.8],
    outro: [55.8, 60.5],
  };
  const DUR = T.outro[1];

  const stage = $("stage");
  const stageScale = () => stage.getBoundingClientRect().width / 1920;
  const anchor = (el, fx = 0.5, fy = 0.5) => {
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = s.width / 1920;
    return { x: (r.left - s.left + r.width * fx) / k, y: (r.top - s.top + r.height * fy) / k };
  };

  // ---------- build DOM from data ----------
  const captions = [
    { k: "STEP 01 / 05", t: "Choose a profile", s: "Paste a LinkedIn URL" },
    { k: "STEP 02 / 05", t: "Scan and analyze", s: "7 checks, 90 days of posts" },
    { k: "STEP 03 / 05", t: "Recommend fixes", s: "Backed by real data" },
    { k: "STEP 04 / 05", t: "Generate the fixes", s: "New profile, first post" },
    { k: "STEP 05 / 05", t: "Email your prospect", s: "You review. You send." },
    { k: "THE OUTPUT", t: "What lands in their inbox", s: "The work, up front" },
  ];
  const capEls = captions.map((c) => {
    const el = document.createElement("div");
    el.className = "cap";
    el.innerHTML = `<div class="k">${c.k}</div><div class="t">${c.t}</div><div class="s">${c.s}</div>`;
    $("captions").appendChild(el);
    return el;
  });

  // choose
  $("pcardPhoto").src = D.photo;
  $("pcardName").textContent = D.name;
  $("pcardHead").textContent = D.headline;
  $("pcardMeta").textContent = D.meta;

  // scan
  $("addrText").textContent = D.urlShort;
  $("shotFull").src = D.shotFull.src;
  const scanScale = 1080 / D.shotFull.w;
  const vpH = 740 - 55;
  const ICONS = {
    banner: '<rect x="3" y="6" width="18" height="9" rx="2"/><path d="M3 18h18"/>',
    headshot: '<circle cx="12" cy="9" r="4"/><path d="M4.5 20c1.5-4 4.2-5.5 7.5-5.5s6 1.5 7.5 5.5"/>',
    headline: '<path d="M4 7h16M4 12h11M4 17h7"/>',
    website: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    follow: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><path d="M18 8v6M15 11h6"/>',
    about: '<circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/><path d="M9 7h11M9 12h11M9 17h8"/>',
    featured: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  };
  const svgIcon = (k) => `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
  const checkEls = D.checks.map((c) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `<div class="ic">${svgIcon(c.key)}</div><div class="tl">${c.short || c.name}</div><div class="st"></div>`;
    $("tiles").appendChild(tile);
    const r = D.regions[c.key];
    let box = null;
    if (r) {
      box = document.createElement("div");
      box.className = `box ${c.status}${r.lbl ? ` lbl-${r.lbl}` : ""}`;
      const pad = 8;
      Object.assign(box.style, {
        left: `${r.x * scanScale - pad}px`, top: `${r.y * scanScale - pad}px`,
        width: `${r.w * scanScale + pad * 2}px`, height: `${r.h * scanScale + pad * 2}px`,
      });
      box.innerHTML = `<div class="lbl">${c.status === "pass" ? "&#10003;" : "!"} ${c.short || c.name}</div>`;
      $("boxes").appendChild(box);
    }
    return { tile, st: tile.querySelector(".st"), box, c };
  });
  const passCount = D.checks.filter((c) => c.status === "pass").length;
  const legend = document.createElement("div");
  legend.className = "tile legend";
  const count = (s) => D.checks.filter((c) => c.status === s).length;
  legend.innerHTML = `<span><i class="dot pass"></i>${count("pass")} pass</span><span><i class="dot fix"></i>${count("fix")} fix</span>${count("unk") ? `<span><i class="dot unk"></i>${count("unk")} can't see</span>` : ""}`;
  $("tiles").appendChild(legend);
  const RING = 2 * Math.PI * 50;
  $("ringFg").style.strokeDasharray = `${RING}`;
  const wMax = Math.max(...D.weekly);
  const weekEls = D.weekly.map((n) => {
    const col = document.createElement("div");
    col.className = "wcol";
    col.innerHTML = `<div class="wbar" data-n="${n}"></div><span>${n || ""}</span>`;
    $("weekBars").appendChild(col);
    return { bar: col.firstChild, n };
  });
  const kpiEls = D.kpis.map((k) => {
    const el = document.createElement("div");
    el.className = "kpi";
    el.innerHTML = `<b>0</b><span>${k.label}</span>`;
    $("kpis").appendChild(el);
    return { el, b: el.querySelector("b"), k };
  });

  // recommend
  const passWrap = $("passes");
  passWrap.innerHTML = `<span>Already strong:</span>`;
  const passEls = D.checks.filter((c) => c.status === "pass").map((c) => {
    const el = document.createElement("span");
    el.className = "pp";
    el.innerHTML = `&#10003; ${c.short || c.name}`;
    passWrap.appendChild(el);
    return el;
  });
  const chartSvg = (vals, w, h, best, avg) => {
    const max = Math.max(...vals);
    const bw = w / vals.length;
    const y = (v) => h - (v / max) * (h - 8);
    const bars = vals.map((v, i) => `<rect class="rb${i === best ? " best" : ""}" x="${i * bw + 2}" y="${y(v)}" width="${bw - 4}" height="${h - y(v)}" rx="3"/>`).join("");
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="rchart">${bars}<line class="avg" x1="0" x2="${w}" y1="${y(avg)}" y2="${y(avg)}"/></svg>`;
  };
  const fixEls = D.fixes.map((f, i) => {
    const el = document.createElement("div");
    el.className = `fixcard viz-${f.viz}`;
    let viz = "";
    if (f.viz === "headline") {
      viz = `<div class="mini">
        <div class="mini-top"><img src="${D.photo}" alt=""><div><b>${D.name}</b>
          <div class="hl-old"><span>${D.headline}</span></div>
          <div class="hl-new"><span class="typed"></span></div></div></div>
        ${f.co ? `<div class="co-row"><span class="co-old">${f.co.old}</span><span class="co-arrow">&rarr;</span><span class="co-new">${f.co.new}</span></div>` : ""}
      </div>`;
    } else if (f.viz === "about") {
      const a = D.about;
      const rows = [
        ...a.before.map((t, j) => `<div class="ab job${j === 0 ? " story" : ""}" data-slot="${j}">${t}</div>`),
        `<div class="ab sawa" data-slot="6"><span class="s0">${a.sawaBefore}</span><span class="s1">${a.after[0]}</span></div>`,
        ...a.after.slice(1).map((t, j) => `<div class="ab add" data-slot="${j + 1}">${t}</div>`),
        `<div class="ab past">${a.past}</div>`,
      ];
      viz = `<div class="mini about-mini"><div class="mini-h">About</div><div class="ab-stack">${rows.join("")}</div></div>`;
    } else if (f.viz === "cadence") {
      const max = Math.max(2, ...D.weekly);
      const gap = D.gap;
      const cols = D.weekly.map((n, j) => `<div class="cd-col${j >= gap.from && j <= gap.to ? " empty" : ""}"><div class="cd-ghost"></div><div class="cd-bar" data-n="${n}"></div></div>`).join("");
      viz = `<div class="cd-wrap" style="--max:${max}">
        <div class="cd-gap" style="left:${(gap.from / D.weekly.length) * 100}%;width:${((gap.to - gap.from + 1) / D.weekly.length) * 100}%"><span>${gap.label}</span></div>
        <div class="cd-bars">${cols}<div class="cd-goal" style="bottom:${(1 / max) * 100}%"><span>goal: 1 a week</span></div></div>
        <div class="cd-axis"><span>13 weeks ago</span><span>this week</span></div>
      </div>`;
    } else if (f.viz === "look") {
      const L = D.look;
      viz = `<div class="lk-wrap">
        <div class="lk-banner"><img class="lk-after" src="${L.bannerAfter}" alt=""><img class="lk-before" src="${L.bannerBefore}" alt=""><i class="lk-wipe"></i></div>
        <div class="lk-row">
          <img class="lk-ph before" src="${L.photoBefore}" alt=""><span class="lk-arrow">&rarr;</span><img class="lk-ph after" src="${L.photoAfter}" alt="">
        </div>
      </div>`;
    } else if (f.viz === "best") {
      viz = `<div class="best-wrap">
        <div class="best-tag"><b>${D.best.value}</b><span>${D.best.label}</span></div>
        ${chartSvg(D.reactions, 480, 230, D.best.index, D.avgReactions)}
        <div class="avg-tag">avg ${D.avgReactions}</div>
      </div>`;
    }
    el.innerHTML = `<div class="top"><span class="chip ${f.kind || "fix"}">${f.tag || "Fix"}</span><span class="num">${String(i + 1).padStart(2, "0")} / ${String(D.fixes.length).padStart(2, "0")}</span></div>
      <h3>${f.title}</h3><div class="viz">${viz}</div><div class="foot">${f.foot}</div>`;
    $("fixes").appendChild(el);
    return { el, f, foot: el.querySelector(".foot") };
  });

  // generate: the rebuilt profile mockup
  // A LinkedIn-style top card at 1080px wide, laid out to line up with the
  // real screenshot (792px scaled by 1080/792) so the before/after wipe matches.
  const buildMockup = (host) => {
    const m = D.mockup;
    const b = m.badges || {};
    const badge = (t) => (t ? `<span class="mk-new">${t}</span>` : "");
    const sawaMark = `<svg viewBox="0 0 42 28" width="30" height="20"><circle cx="14" cy="14" r="12" fill="#DFDFDC"/><circle cx="28" cy="14" r="12" fill="#fff" stroke="#DFDFDC" stroke-width="1.4"/><path d="M21 3.5C25 6.2 25 21.8 21 24.5C17 21.8 17 6.2 21 3.5Z" fill="#B5B5B1"/></svg>`;
    const logo = (c) => (c.logo === "sawa" ? `<span class="lg dark">${sawaMark}</span>`
      : `<span class="lg crop" style="background-image:url('${D.shotTop.src}');background-position:${c.crop}"></span>`);
    host.innerHTML = `<div class="mk"><div class="mk-inner">
      <div class="mk-card">
        <div class="mk-banner"><img src="${m.banner}" alt="">${b.banner ? `<div class="mk-tag tr">${badge(b.banner)}</div>` : ""}</div>
        <div class="mk-photo"><img src="${m.photo}" alt=""></div>
        ${b.photo ? `<div class="mk-tag ph">${badge(b.photo)}</div>` : ""}
        <div class="mk-info">
          <div class="mk-left">
            <div class="mk-name">${m.name}</div>
            <div class="mk-head"><span class="mk-hl">${m.headline}</span>${badge(b.headline)}</div>
            <div class="mk-meta">${m.location}</div>
            <div class="mk-site">${m.site} &#8599;</div>
            <div class="mk-fol">${m.followers}</div>
            <div class="mk-btns">${(m.buttons || ["+ Follow", "Message"]).map((t, j) => `<span class="${j ? "m" : "f"}">${t}</span>`).join("")}</div>
          </div>
          <div class="mk-right">${m.companies.map((c) => `<div class="mk-co">${logo(c)}<b>${c.name}</b>${badge(c.badge)}</div>`).join("")}</div>
        </div>
      </div>
      <div class="mk-sec"><h4>About ${badge(b.about)}</h4><ul>${m.about.map((a) => `<li>${a}</li>`).join("")}</ul></div>
      <div class="mk-sec"><h4>Featured</h4>
        <div class="mk-feat"><img src="${m.featuredImg}" alt=""><div><p>${m.featuredText}</p><span>${m.featuredStats}</span></div></div>
      </div>
    </div></div>`;
    return host.querySelector(".mk");
  };
  const mkMain = buildMockup($("cmpAfter"));
  const mkInner = mkMain.querySelector(".mk-inner");
  const mkBadges = [...mkMain.querySelectorAll(".mk-new")];
  $("shotTop").src = D.shotTop.src;

  $("postPhoto").src = D.mockup.photo;
  $("postName").textContent = D.name;
  const postParas = D.post.map((p) => {
    const el = document.createElement("p");
    $("postBody").appendChild(el);
    return { el, text: p };
  });
  const postTotal = D.post.join("").length;
  $("outDir").textContent = `out/${D.slug}/`;
  const fileEls = D.files.map((f) => {
    const el = document.createElement("div");
    el.className = "file";
    el.innerHTML = `<div class="doc"><i>${f.ext}</i><span class="ok">&#10003;</span></div><span>${f.name}</span>`;
    $("files").appendChild(el);
    return el;
  });

  // email
  $("mailTo").textContent = D.email.to;
  const mailParas = D.email.body.map((p) => {
    const el = document.createElement("div");
    if (p === "[mockup]") {
      el.className = "inline-img";
      const sc = document.createElement("div");
      sc.className = "mk-scale";
      sc.style.transform = `scale(${560 / 1080})`;
      buildMockup(sc);
      el.appendChild(sc);
      $("mailBody").appendChild(el);
      return { el, img: true, len: 40 };
    }
    el.innerHTML = "<p></p>";
    $("mailBody").appendChild(el);
    return { el: el.firstChild, text: p, len: p.length };
  });
  const mailTotal = mailParas.reduce((a, p) => a + p.len, 0);
  $("ibFrom").textContent = D.email.fromName;
  $("ibSubj").textContent = D.email.subject;
  $("rdSubj").textContent = D.email.subject;
  $("rdPhoto").src = D.email.fromPhoto;
  $("rdName").textContent = D.email.fromName;
  D.email.body.forEach((p) => {
    if (p === "[mockup]") {
      const el = document.createElement("div");
      el.className = "inline-img";
      const sc = document.createElement("div");
      sc.className = "mk-scale";
      sc.style.transform = `scale(${860 / 1080})`;
      buildMockup(sc);
      el.appendChild(sc);
      $("rdBody").appendChild(el);
    } else {
      const el = document.createElement("p");
      el.textContent = p;
      $("rdBody").appendChild(el);
    }
  });

  // ---------- per-scene renderers (lt = seconds into the scene) ----------
  const sceneEls = {
    intro: $("s-intro"), choose: $("s-choose"), scan: $("s-scan"), rec: $("s-rec"),
    gen: $("s-gen"), email: $("s-email"), outro: $("s-outro"),
  };
  const sceneEnvelope = (name, t) => {
    const [a, b] = T[name];
    const el = sceneEls[name];
    if (t < a - 0.01 || t > b + 0.01) { el.style.visibility = "hidden"; return null; }
    el.style.visibility = "visible";
    const kin = ease.out(prog(t, a, a + 0.5));
    const kout = ease.inOut(prog(t, b - 0.5, b));
    const o = Math.min(kin, 1 - kout);
    const sc = lerp(0.985, 1, kin) * lerp(1, 1.025, kout);
    el.style.opacity = o;
    el.style.transform = `scale(${sc})`;
    el.style.filter = kout > 0 ? `blur(${kout * 8}px)` : "none";
    return t - a;
  };

  const cursor = $("cursor");
  const ripple = $("ripple");
  let cursorState = null; // set by scenes each frame: {x, y, o, click}

  function intro(t) {
    const lt = sceneEnvelope("intro", t);
    if (lt === null) return;
    const el = sceneEls.intro;
    const logo = el.querySelector(".intro-logo");
    const k0 = ease.back(prog(lt, 0, 0.7));
    set(logo, clamp(k0 * 1.5), `scale(${lerp(0.6, 1, k0)})`);
    appear(el.querySelector(".intro-title"), lt, 0.25, 40, 0.7);
    appear(el.querySelector(".intro-sub"), lt, 0.6, 30, 0.6);
    [...el.querySelectorAll(".intro-chips span")].forEach((c, i) => appear(c, lt, 1.0 + i * 0.12, 20, 0.45));
  }

  function choose(t) {
    const lt = sceneEnvelope("choose", t);
    if (lt === null) return;
    const win = $("chooseWin");
    const kin = ease.quint(prog(lt, 0, 0.7));
    set(win, kin, `translateY(${(1 - kin) * 50}px)`);

    const url = D.url;
    const typed = Math.floor(url.length * prog(lt, 1.45, 3.0));
    $("urlText").textContent = url.slice(0, typed);
    $("urlPh").style.display = typed > 0 ? "none" : "";
    const focused = lt > 1.25;
    $("urlInput").classList.toggle("focus", focused);
    $("urlCaret").style.opacity = focused && lt < 4.6 && (typed < url.length || Math.floor(lt * 2.4) % 2 === 0) ? 1 : 0;

    const pk = ease.quint(prog(lt, 3.2, 3.8));
    set($("pcard"), pk, `translateY(${(1 - pk) * 30}px) scale(${lerp(0.97, 1, pk)})`);

    const press = prog(lt, 4.85, 4.95) - prog(lt, 5.0, 5.2);
    $("scanBtn").style.transform = `scale(${1 - press * 0.06})`;
    $("scanBtn").style.background = lt > 4.95 ? "#FFFFFF" : "";

    const pIn = anchor($("urlInput"), 0.42, 0.55);
    const pBtn = anchor($("scanBtn"), 0.5, 0.55);
    const x = kf(lt, [[0.3, 1560], [1.15, pIn.x], [3.9, pIn.x], [4.75, pBtn.x], [6.4, pBtn.x], [6.9, 1700]]);
    const y = kf(lt, [[0.3, 960], [1.15, pIn.y], [3.9, pIn.y], [4.75, pBtn.y], [6.4, pBtn.y], [6.9, 1000]]);
    cursorState = { x, y, o: prog(lt, 0.3, 0.6) * (1 - prog(lt, 6.3, 6.7)), clicks: [1.2, 4.9].map((c) => lt - c) };
  }

  function scan(t) {
    const lt = sceneEnvelope("scan", t);
    if (lt === null) return;
    const bk = ease.quint(prog(lt, 0, 0.75));
    set($("browserWin"), bk, `translateX(${(1 - bk) * -70}px)`);
    const pk = ease.quint(prog(lt, 0.15, 0.9));
    set($("teardownWin"), pk, `translateX(${(1 - pk) * 70}px)`);

    $("loadBar").style.width = `${ease.out(prog(lt, 0.3, 1.4)) * 100}%`;
    $("loadBar").style.opacity = 1 - prog(lt, 1.4, 1.7);
    $("shotFull").style.opacity = ease.out(prog(lt, 0.9, 1.4));

    // scroll keyframes (screenshot px), chosen so each region is in view at its reveal
    const maxScroll = Math.max(0, D.shotFull.h * scanScale - vpH);
    const yOf = (key) => clamp(((D.regions[key]?.y ?? 0) - 70) * scanScale, 0, maxScroll);
    const sy = kf(lt, [[0, 0], [5.0, 0], [5.8, yOf("about")], [6.6, yOf("about")], [7.4, yOf("featured")], [9.4, yOf("featured")], [10.4, 0]]);
    $("scanScroller").style.transform = `translateY(${-sy}px)`;

    // beam sweeps the viewport while scanning
    const scanning = lt > 1.5 && lt < 8.6;
    const ph = ((lt - 1.5) % 1.6) / 1.6;
    $("beam").style.opacity = scanning ? Math.sin(Math.PI * ph) * 0.9 : 0;
    $("beam").style.transform = `translateY(${lerp(-120, vpH, ph)}px)`;

    let passesDone = 0;
    D.checks.forEach((c, i) => {
      const e = checkEls[i];
      const at = c.at;
      const done = lt >= at;
      const active = lt > at - 0.6 && !done;
      e.tile.className = `tile${done ? ` ${c.status}` : ""}${active ? " active" : ""}`;
      e.st.innerHTML = done ? ({ pass: "&#10003;", fix: "!", unk: "?" })[c.status] : "";
      const pop = ease.back(prog(lt, at, at + 0.4));
      e.st.style.transform = `scale(${done ? pop : 0})`;
      e.tile.style.opacity = lt > 1.2 ? 1 : 0.4;
      if (c.status === "pass") passesDone += ease.out(prog(lt, at, at + 0.5));
      if (e.box) {
        const bk2 = ease.out(prog(lt, at - 0.1, at + 0.35));
        e.box.style.opacity = bk2;
        e.box.style.transform = `scale(${lerp(1.06, 1, bk2)})`;
      }
    });
    appear(document.querySelector("#tiles .legend"), lt, 7.9, 8, 0.4);
    $("ringFg").style.strokeDashoffset = `${RING * (1 - passesDone / D.checks.length)}`;
    $("ringNum").textContent = Math.round(passesDone);
    $("scoreCount").textContent = lt > 8.0 ? `${passCount} of ${D.checks.length} pass` : `Scoring ${D.checks.length} checks`;

    appear($("chartBox"), lt, 8.3, 16, 0.5);
    weekEls.forEach((w, i) => {
      const k = ease.out(prog(lt, 8.6 + i * 0.06, 9.3 + i * 0.06));
      w.bar.style.height = `${(w.n / wMax) * 118 * k + 3}px`;
    });
    kpiEls.forEach((st, i) => {
      const at = 9.4 + i * 0.25;
      appear(st.el, lt, at, 12, 0.4);
      const v = st.k.value * ease.out(prog(lt, at, at + 1.0));
      st.b.textContent = st.k.text || (st.k.decimals ? v.toFixed(st.k.decimals) : Math.round(v));
    });
  }

  function rec(t) {
    const lt = sceneEnvelope("rec", t);
    if (lt === null) return;
    appear(passWrap.firstChild, lt, 0.2, 10, 0.4);
    passEls.forEach((el, i) => {
      const k = ease.back(prog(lt, 0.35 + i * 0.12, 0.75 + i * 0.12));
      set(el, clamp(k * 1.4), `scale(${lerp(0.7, 1, k)})`);
    });
    fixEls.forEach((f, i) => {
      const at = 0.7 + i * 0.35;
      const k = ease.quint(prog(lt, at, at + 0.8));
      set(f.el, k, `translateY(${(1 - k) * 70}px) scale(${lerp(0.95, 1, k)})`);
      appear(f.foot, lt, 4.6 + i * 0.2, 10, 0.5);
      const root = f.el;
      if (f.f.viz === "headline") {
        root.querySelector(".hl-old span").style.textDecorationColor = `rgba(229,72,77,${ease.inOut(prog(lt, 2.0, 2.5))})`;
        root.querySelector(".hl-old").style.opacity = lerp(1, 0.4, prog(lt, 2.4, 2.7));
        const nh = D.mockup.headline;
        root.querySelector(".hl-new .typed").textContent = nh.slice(0, Math.floor(nh.length * prog(lt, 2.7, 3.9)));
        root.querySelector(".hl-new").style.opacity = lt > 2.6 ? 1 : 0;
        if (f.f.co) {
          root.querySelector(".co-old").style.textDecorationColor = `rgba(229,72,77,${ease.inOut(prog(lt, 4.0, 4.3))})`;
          root.querySelector(".co-old").style.opacity = lerp(1, 0.4, prog(lt, 4.2, 4.4));
          const ck = ease.back(prog(lt, 4.3, 4.7));
          set(root.querySelector(".co-new"), clamp(ck * 1.4), `scale(${lerp(0.6, 1, ck)})`);
          set(root.querySelector(".co-arrow"), prog(lt, 4.2, 4.4));
        }
      } else if (f.f.viz === "cadence") {
        // real weeks grow in, the empty stretch gets called out, then the goal fills the gaps
        root.querySelectorAll(".cd-bar").forEach((b, j) => {
          const k = ease.out(prog(lt, 1.5 + j * 0.05, 2.2 + j * 0.05));
          b.style.height = `calc(${(+b.dataset.n * k) / Math.max(2, ...D.weekly) * 100}% + ${+b.dataset.n ? 0 : 3}px)`;
        });
        const gk = ease.back(prog(lt, 2.5, 2.9));
        set(root.querySelector(".cd-gap"), clamp(gk * 1.3), `scaleX(${lerp(0.85, 1, gk)})`);
        set(root.querySelector(".cd-goal"), prog(lt, 3.1, 3.5));
        root.querySelectorAll(".cd-col.empty .cd-ghost").forEach((g, j) => {
          const k = ease.out(prog(lt, 3.6 + j * 0.08, 4.0 + j * 0.08));
          g.style.height = `${(k / Math.max(2, ...D.weekly)) * 100}%`;
          g.style.opacity = k;
        });
      } else if (f.f.viz === "look") {
        const w = ease.inOut(prog(lt, 2.0, 3.1));
        root.querySelector(".lk-before").style.clipPath = `inset(0 0 0 ${w * 100}%)`;
        const wipe = root.querySelector(".lk-wipe");
        wipe.style.left = `${w * 100}%`;
        wipe.style.opacity = w > 0.01 && w < 0.99 ? 1 : 0;
        set(root.querySelector(".lk-arrow"), prog(lt, 3.2, 3.5));
        const pk = ease.back(prog(lt, 3.4, 3.9));
        set(root.querySelector(".lk-ph.after"), clamp(pk * 1.3), `scale(${lerp(0.6, 1, pk)})`);
      } else if (f.f.viz === "about") {
        // Sawa moves from the last line to the top; old job lines fold into one
        const k = ease.inOut(prog(lt, 2.6, 4.0));
        const SL = 36;
        root.querySelectorAll(".ab.job").forEach((b, j) => {
          const to = j === 0 ? 3 : 4;
          b.style.transform = `translateY(${lerp(j, to, k) * SL}px)`;
          b.style.opacity = j === 0 ? 1 : 1 - prog(lt, 2.8, 3.6);
        });
        const sawa = root.querySelector(".ab.sawa");
        sawa.style.transform = `translateY(${lerp(6, 0, k) * SL}px)`;
        sawa.classList.toggle("on", k > 0.5);
        sawa.querySelector(".s0").style.opacity = 1 - prog(lt, 3.2, 3.5);
        sawa.querySelector(".s1").style.opacity = prog(lt, 3.3, 3.6);
        sawa.style.boxShadow = lt > 1.8 && lt < 2.6 ? `0 0 0 ${3 + 3 * Math.sin(lt * 9)}px rgba(232,163,32,0.45)` : "";
        root.querySelectorAll(".ab.add").forEach((b, j) => {
          appear(b, lt, 3.6 + j * 0.2, 0, 0.4);
          b.style.transform = `translateY(${(j + 1) * SL}px)`;
        });
        const past = root.querySelector(".ab.past");
        past.style.transform = `translateY(${4 * SL}px)`;
        past.style.opacity = prog(lt, 3.6, 4.0);
      } else if (f.f.viz === "best") {
        root.querySelectorAll(".rb").forEach((b, j) => {
          b.style.transform = `scaleY(${ease.out(prog(lt, 1.6 + j * 0.035, 2.3 + j * 0.035))})`;
        });
        root.querySelector(".avg").style.opacity = prog(lt, 3.0, 3.4);
        appear(root.querySelector(".avg-tag"), lt, 3.1, 6, 0.4);
        root.querySelector(".rb.best").classList.toggle("lit", lt > 3.3);
        const bk = ease.back(prog(lt, 3.4, 3.8));
        set(root.querySelector(".best-tag"), clamp(bk * 1.4), `scale(${lerp(0.7, 1, bk)})`);
      }
    });
    const push = ease.inOut(prog(lt, 3.5, 7.5));
    $("s-rec").style.transform += ` scale(${1 + push * 0.025})`;
  }

  function gen(t) {
    const lt = sceneEnvelope("gen", t);
    if (lt === null) return;
    const ck = ease.quint(prog(lt, 0, 0.75));
    set($("compareWin"), ck, `translateX(${(1 - ck) * -70}px)`);
    const W = 1080;
    const hx = kf(lt, [[0, W], [1.2, W], [3.4, 0], [4.4, 0], [5.2, W * 0.5], [6.4, W * 0.5], [7.2, 0]]);
    $("cmpBefore").style.clipPath = `inset(0 ${W - hx}px 0 0)`;
    $("cmpHandle").style.left = `${hx}px`;
    $("cmpHandle").style.opacity = hx > 2 && hx < W - 2 ? 1 : 0;
    $("tagBefore").style.opacity = hx > 160 ? 1 : 0;
    $("tagAfter").style.opacity = hx < W - 160 ? 1 : 0;
    mkBadges.forEach((b, i) => {
      const k = ease.back(prog(lt, 3.3 + i * 0.18, 3.7 + i * 0.18));
      set(b, clamp(k * 1.5), `scale(${lerp(0.5, 1, k)})`);
    });
    const scrollDown = ease.inOut(prog(lt, 7.6, 9.0));
    mkInner.style.transform = `translateY(${-scrollDown * D.mockup.scrollTo}px)`;

    const pk = ease.quint(prog(lt, 0.5, 1.2));
    set($("postWin"), pk, `translateX(${(1 - pk) * 70}px)`);
    let left = postTotal * prog(lt, 1.5, 4.6);
    postParas.forEach((p) => {
      const take = clamp(left, 0, p.text.length);
      left -= p.text.length;
      p.el.textContent = p.text.slice(0, Math.floor(take));
      p.el.style.display = take > 0 ? "" : "none";
    });
    appear($("postMore"), lt, 4.7, 6, 0.4);

    const fk = ease.quint(prog(lt, 4.6, 5.3));
    set($("filesWin"), fk, `translateX(${(1 - fk) * 70}px)`);
    fileEls.forEach((el, i) => {
      const k = ease.back(prog(lt, 5.2 + i * 0.3, 5.6 + i * 0.3));
      set(el, clamp(k * 1.4), `translateY(${(1 - k) * 20}px) scale(${lerp(0.7, 1, k)})`);
    });
  }

  function email(t) {
    const lt = sceneEnvelope("email", t);
    if (lt === null) return;
    const cw = $("composeWin");
    const ck = ease.quint(prog(lt, 0, 0.7));
    const fly = ease.inOut(prog(lt, 6.9, 7.6));
    cw.style.opacity = ck * (1 - fly);
    cw.style.transform = `translateY(${(1 - ck) * 50 - fly * 260}px) scale(${1 - fly * 0.35})`;

    const subj = D.email.subject;
    $("mailSubj").textContent = subj.slice(0, Math.floor(subj.length * prog(lt, 0.6, 1.6)));
    $("subjCaret").style.opacity = lt > 0.5 && lt < 1.8 ? 1 : 0;

    let budget = mailTotal * prog(lt, 1.8, 5.4);
    mailParas.forEach((p) => {
      const take = clamp(budget, 0, p.len);
      budget -= p.len;
      if (p.img) {
        const k = ease.out(take / p.len);
        set(p.el, k, `translateY(${(1 - k) * 14}px)`);
        p.el.style.display = take > 0 ? "" : "none";
      } else {
        p.el.textContent = p.text.slice(0, Math.floor(take));
        p.el.parentNode.style.display = take > 0 ? "" : "none";
      }
    });
    // keep the line being typed in view
    const mb = $("mailBody");
    mb.firstChild.style.marginTop = "";
    mb.firstChild.style.marginTop = `${-Math.max(0, mb.scrollHeight - mb.clientHeight)}px`;
    appear($("mailStatus"), lt, 5.5, 8, 0.4);
    const bk = ease.back(prog(lt, 5.8, 6.2));
    set($("bumpChip"), clamp(bk * 1.4), `scale(${lerp(0.8, 1, bk)})`);
    const press = prog(lt, 6.72, 6.8) - prog(lt, 6.85, 7.0);
    $("sendBtn").style.transform = `scale(${1 - press * 0.08})`;

    // paper plane from the Send button to the top right
    const sb = { x: 335, y: 820 };
    const pp = prog(lt, 6.85, 7.9);
    const plane = $("plane");
    plane.style.opacity = pp > 0 && pp < 1 ? Math.sin(Math.PI * pp) * 1.2 : 0;
    const px = lerp(sb.x, 1880, ease.inOut(pp));
    const py = lerp(sb.y, 60, ease.inOut(pp)) - Math.sin(Math.PI * pp) * 160;
    plane.style.transform = `translate(${px - 44}px, ${py - 44}px) rotate(${lerp(10, -8, pp)}deg) scale(${lerp(0.8, 1.2, Math.sin(Math.PI * pp))})`;

    // inbox: the prospect's view
    const ik = ease.quint(prog(lt, 7.7, 8.4));
    set($("inboxWin"), ik, `translateY(${(1 - ik) * 50}px)`);
    const nk = ease.back(prog(lt, 8.4, 8.9));
    set($("ibNew"), clamp(nk * 1.3), `translateX(${(1 - nk) * -40}px)`);
    const rk = ease.out(prog(lt, 9.3, 9.8));
    $("inboxRead").style.opacity = rk;
    const rs = $("rdScroll");
    const maxRd = Math.max(0, rs.scrollHeight - (740 - 52) + 30);
    rs.style.transform = `translateY(${-ease.inOut(prog(lt, 10.3, 12.4)) * maxRd}px)`;
    $("ibNew").style.background = lt > 9.2 ? "rgba(255,255,255,0.12)" : "";

    // cursor: to Send, click; then to the new inbox row, click
    const pSend = anchor($("sendBtn"));
    const pRow = { x: 520, y: 240 };
    const x = kf(lt, [[5.6, 1500], [6.6, pSend.x], [7.2, pSend.x], [8.6, pRow.x], [9.6, pRow.x], [10.2, 1750]]);
    const y = kf(lt, [[5.6, 980], [6.6, pSend.y], [7.2, pSend.y], [8.6, pRow.y], [9.6, pRow.y], [10.2, 1000]]);
    cursorState = { x, y, o: prog(lt, 5.6, 5.9) * (1 - prog(lt, 9.8, 10.2)), clicks: [6.75, 9.15].map((c) => lt - c) };
  }

  function outro(t) {
    const lt = sceneEnvelope("outro", t);
    if (lt === null) return;
    const el = sceneEls.outro;
    const k0 = ease.back(prog(lt, 0, 0.6));
    set(el.querySelector(".intro-logo"), clamp(k0 * 1.5), `scale(${lerp(0.6, 1, k0)})`);
    appear(el.querySelector(".outro-title"), lt, 0.2, 40, 0.8);
    [...el.querySelectorAll(".outro-meta span")].forEach((c, i) => appear(c, lt, 1.0 + i * 0.15, 16, 0.45));
  }

  function chrome(t) {
    // header: hidden on intro/outro, step tracker follows the scenes
    const hk = prog(t, T.intro[1] - 0.4, T.intro[1] + 0.2) * (1 - prog(t, T.outro[0] - 0.3, T.outro[0] + 0.2));
    $("hdr").style.opacity = hk;
    const order = ["choose", "scan", "rec", "gen", "email"];
    const cur = order.findIndex((n) => t >= T[n][0] - 0.2 && t < T[n][1] - 0.2);
    [...document.querySelectorAll("#steps li")].forEach((li, i) => {
      li.classList.toggle("on", i === cur);
      li.classList.toggle("done", cur > i || t >= T.email[1] - 0.2);
    });
    // captions
    const capWin = [
      [T.choose[0] + 0.3, T.choose[1] - 0.3],
      [T.scan[0] + 0.3, T.scan[1] - 0.3],
      [T.rec[0] + 0.3, T.rec[1] - 0.3],
      [T.gen[0] + 0.3, T.gen[1] - 0.3],
      [T.email[0] + 0.3, T.email[0] + 7.4],
      [T.email[0] + 7.8, T.email[1] - 0.3],
    ];
    capEls.forEach((el, i) => {
      const [a, b] = capWin[i];
      const kin = ease.quint(prog(t, a, a + 0.6));
      const kout = ease.inOut(prog(t, b - 0.35, b));
      el.style.opacity = Math.min(kin, 1 - kout);
      el.style.transform = `translateY(${(1 - kin) * 26 - kout * 10}px)`;
    });
    const note = $("note");
    note.textContent = D.note || "";
    note.style.display = D.note ? "" : "none";
    const win = (a, b) => prog(t, a, a + 0.5) * (1 - prog(t, b - 0.5, b));
    note.style.opacity = Math.max(win(T.choose[0] + 1, T.choose[1] - 0.3), win(T.email[0] + 7.8, T.email[1] - 0.3));
  }

  function drawCursor() {
    if (!cursorState || cursorState.o <= 0) { cursor.style.opacity = 0; return; }
    const { x, y, o, clicks } = cursorState;
    cursor.style.opacity = o;
    const down = clicks.some((d) => d > -0.06 && d < 0.1);
    cursor.style.transform = `translate(${x}px, ${y}px) scale(${down ? 0.86 : 1})`;
    const d = clicks.find((d) => d >= 0 && d < 0.55);
    if (d !== undefined) {
      const k = ease.out(d / 0.55);
      ripple.style.opacity = 1 - k;
      ripple.style.transform = `scale(${lerp(0.3, 1.3, k)})`;
    } else ripple.style.opacity = 0;
  }

  function seek(t) {
    cursorState = null;
    intro(t); choose(t); scan(t); rec(t); gen(t); email(t); outro(t);
    chrome(t);
    drawCursor();
  }

  // ---------- playback ----------
  const render = new URLSearchParams(location.search).has("render");
  const fit = () => {
    if (render) { stage.style.transform = "none"; return; }
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
  };
  addEventListener("resize", fit);
  fit();

  const ready = Promise.all([
    document.fonts.ready,
    ...[...document.images].map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; }))),
  ]).then(() => Promise.all([...document.images].map((im) => im.decode?.().catch(() => {}))));

  window.__DUR = DUR;
  window.__seek = seek;
  window.__ready = ready;

  if (render) {
    document.body.classList.add("render");
    ready.then(() => seek(0));
    return;
  }

  let playing = true;
  let t0 = performance.now();
  let tNow = +(new URLSearchParams(location.search).get("t") || 0);
  t0 -= tNow * 1000;
  const scrub = $("scrub");
  const tl = $("tLabel");
  const frame = () => {
    if (playing) {
      tNow = ((performance.now() - t0) / 1000) % DUR;
      scrub.value = (tNow / DUR) * 1000;
    }
    seek(tNow);
    tl.textContent = `${tNow.toFixed(1)}s`;
    requestAnimationFrame(frame);
  };
  $("playBtn").onclick = () => {
    playing = !playing;
    $("playBtn").textContent = playing ? "Pause" : "Play";
    t0 = performance.now() - tNow * 1000;
  };
  scrub.oninput = () => { tNow = (scrub.value / 1000) * DUR; t0 = performance.now() - tNow * 1000; };
  addEventListener("keydown", (e) => {
    if (e.code === "Space") $("playBtn").click();
    if (e.code === "ArrowRight") { tNow = Math.min(DUR, tNow + 0.5); t0 = performance.now() - tNow * 1000; }
    if (e.code === "ArrowLeft") { tNow = Math.max(0, tNow - 0.5); t0 = performance.now() - tNow * 1000; }
  });
  ready.then(() => requestAnimationFrame(frame));
})();
