export interface LandingUrls {
  growth: string;
  pro: string;
  agency: string;
  baseUrl: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function renderLanding(u: LandingUrls): string {
  const link = (url: string) =>
    `href="${esc(url)}"${url.startsWith("#") ? "" : ' target="_blank" rel="noopener"'}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AdAutopsy: Spy on winning Meta ads and rewrite them</title>
<meta name="description" content="AdAutopsy finds the longest-running competitor ads in the Meta Ad Library, breaks down why they work, and writes new hooks, video scripts and landing page specs. 2 free scans, no card." />
<meta name="theme-color" content="#fffefb" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
<style>
:root{--paper:#fffefb;--ink:#0d0d12;--blue:#2a4bff;--sky:#e9eeff;--sun:#ffd84d;--pink:#ff8fb1;--mint:#9be8c4;--line:#ebe7da;--mute:#5d5d68}
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font:400 17px/1.55 "DM Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
h1,h2,h3{font-family:"Bricolage Grotesque","DM Sans",system-ui,sans-serif;letter-spacing:-.025em;line-height:1.05}
a{color:inherit}
.wrap{max-width:1120px;margin:0 auto;padding:0 22px}
section{padding:84px 0}
:focus-visible{outline:3px solid var(--blue);outline-offset:3px}

/* nav */
nav{position:sticky;top:0;z-index:20;background:rgba(255,254,251,.88);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
nav .wrap{display:flex;align-items:center;justify-content:space-between;height:66px}
.logo{display:flex;align-items:center;gap:10px;font:800 22px "Bricolage Grotesque",sans-serif;text-decoration:none}
.logo i{width:32px;height:32px;border-radius:10px;background:var(--blue);color:#fff;display:grid;place-items:center;font-style:normal;font-size:18px;transform:rotate(-6deg)}
.links{display:flex;gap:26px;align-items:center;font-weight:500}
.links a{text-decoration:none}
.links a:hover{color:var(--blue)}

/* buttons */
.btn{display:inline-block;padding:14px 24px;border-radius:999px;font-weight:700;text-decoration:none;border:2px solid var(--ink);transition:transform .15s,box-shadow .15s}
.btn.primary{background:var(--blue);color:#fff;border-color:var(--ink);box-shadow:4px 4px 0 var(--ink)}
.btn.primary:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink)}
.btn.ghost{background:#fff}
.btn.ghost:hover{background:var(--sky)}
.btn.sm{padding:9px 18px;font-size:15px}

/* hero */
.hero{padding:64px 0 40px;text-align:center;position:relative}
.pill{display:inline-block;background:var(--sky);color:var(--blue);font-weight:700;font-size:14px;padding:7px 16px;border-radius:999px}
.hero h1{font-size:clamp(42px,7.4vw,86px);font-weight:800;margin:22px auto 20px;max-width:14ch}
.hero h1 em{font-style:normal;background:var(--sun);padding:0 .15em;border-radius:.2em;display:inline-block;transform:rotate(-1.5deg)}
.hero p.sub{max-width:600px;margin:0 auto 30px;color:var(--mute);font-size:19px}
.cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.fine{margin-top:16px;font-size:14px;color:var(--mute)}

/* phones */
.stage{display:flex;justify-content:center;align-items:flex-end;gap:26px;margin-top:56px;position:relative}
.phone{width:250px;aspect-ratio:9/18.5;background:var(--ink);border-radius:38px;padding:9px;box-shadow:0 30px 60px -20px rgba(42,75,255,.35);position:relative;flex:none}
.phone:before{content:"";position:absolute;top:16px;left:50%;width:70px;height:20px;border-radius:99px;background:#000;transform:translateX(-50%);z-index:3}
.screen{height:100%;border-radius:30px;overflow:hidden;padding:46px 16px 18px;display:flex;flex-direction:column;gap:10px;color:#fff;position:relative}
.p1 .screen{background:linear-gradient(170deg,#2a4bff,#6a2cff)}
.p2 .screen{background:linear-gradient(170deg,#ff6a88,#ffb36a)}
.p3 .screen{background:linear-gradient(170deg,#0fa97a,#2a4bff)}
.p2{width:285px;transform:translateY(-22px);z-index:2}
.p1{transform:rotate(-5deg)}.p3{transform:rotate(5deg)}
.tag{align-self:flex-start;background:rgba(255,255,255,.22);backdrop-filter:blur(6px);border-radius:99px;padding:4px 11px;font-size:12px;font-weight:700}
.big{font:800 52px/1 "Bricolage Grotesque",sans-serif}
.hook{margin-top:auto;font:700 21px/1.15 "Bricolage Grotesque",sans-serif}
.cap{background:rgba(0,0,0,.25);border-radius:14px;padding:10px 12px;font-size:12.5px;line-height:1.4}
.shot{display:flex;justify-content:space-between;font-size:12px;font-weight:700;border-top:1px solid rgba(255,255,255,.35);padding-top:7px}
.sticker{position:absolute;font-size:44px;filter:drop-shadow(2px 4px 0 rgba(0,0,0,.12))}

/* section heads */
.kicker{color:var(--blue);font-weight:700;margin-bottom:10px}
.head{max-width:680px;margin-bottom:44px}
.head h2{font-size:clamp(34px,5vw,56px);font-weight:800}
.head p{margin-top:14px;color:var(--mute);font-size:19px}
.center{text-align:center;margin-left:auto;margin-right:auto}

/* about */
.about{background:var(--sky);border-radius:44px;margin:0 14px;padding:76px 0}
.about .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
.about p{font-size:19px;margin-bottom:16px}
.about ul{list-style:none;padding:0;display:grid;gap:12px}
.about li{background:#fff;border:2px solid var(--ink);border-radius:20px;padding:16px 18px;font-weight:500}
.about li b{display:block;font-family:"Bricolage Grotesque",sans-serif;font-size:19px}

/* steps + bento */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.card{background:#fff;border:2px solid var(--ink);border-radius:28px;padding:28px}
.card h3{font-size:25px;margin:14px 0 8px}
.card p{color:var(--mute)}
.ico{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:27px;border:2px solid var(--ink)}
.bento{display:grid;grid-template-columns:repeat(6,1fr);gap:20px}
.bento .card:nth-child(1){grid-column:span 4;background:var(--sun)}
.bento .card:nth-child(2){grid-column:span 2}
.bento .card:nth-child(3){grid-column:span 2}
.bento .card:nth-child(4){grid-column:span 4;background:var(--blue);color:#fff}
.bento .card:nth-child(1) p{color:#3b3410}
.bento .card:nth-child(4) p{color:#d8dfff}
.bento .card:nth-child(4) .ico{background:#fff}

/* pricing */
.prices{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;align-items:stretch}
.plan{background:#fff;border:2px solid var(--ink);border-radius:30px;padding:32px;display:flex;flex-direction:column;position:relative}
.plan.hot{background:var(--blue);color:#fff;box-shadow:8px 8px 0 var(--ink)}
.plan .badge{position:absolute;top:-15px;right:24px;background:var(--sun);color:var(--ink);border:2px solid var(--ink);border-radius:99px;padding:3px 14px;font-weight:700;font-size:13px}
.plan h3{font-size:28px}
.plan .who{color:var(--mute);margin-top:4px}
.plan.hot .who{color:#d8dfff}
.price{font:800 54px "Bricolage Grotesque",sans-serif;margin:22px 0 4px;letter-spacing:-.03em}
.price small{font:500 17px "DM Sans",sans-serif;opacity:.7}
.plan ul{list-style:none;padding:0;margin:20px 0 28px;display:grid;gap:10px;flex:1}
.plan li{padding-left:28px;position:relative}
.plan li:before{content:"✓";position:absolute;left:0;font-weight:800;color:var(--blue)}
.plan.hot li:before{color:var(--sun)}
.plan .btn{text-align:center}
.plan.hot .btn{background:#fff;color:var(--ink);box-shadow:none}
.note{margin-top:30px;background:var(--sky);border-radius:22px;padding:20px 24px;text-align:center;font-weight:500}

/* faq */
details{border-bottom:2px solid var(--line);padding:20px 0}
summary{cursor:pointer;font:700 21px "Bricolage Grotesque",sans-serif;list-style:none;display:flex;justify-content:space-between;gap:16px}
summary::-webkit-details-marker{display:none}
summary:after{content:"+";font-size:28px;line-height:1;color:var(--blue);transition:transform .2s}
details[open] summary:after{transform:rotate(45deg)}
details p{margin-top:12px;color:var(--mute);max-width:70ch}
code{background:var(--sky);padding:2px 8px;border-radius:8px;font-size:.92em;word-break:break-all}

/* final cta + footer */
.final{background:var(--ink);color:#fff;border-radius:44px;margin:0 14px;text-align:center;padding:84px 0}
.final h2{font-size:clamp(36px,6vw,66px);font-weight:800;max-width:16ch;margin:0 auto 24px}
.final .btn{border-color:#fff}
footer{padding:44px 0 56px;color:var(--mute);font-size:15px}
footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}

/* tablet + phone */
@media(max-width:900px){
  section{padding:60px 0}
  .links a:not(.btn){display:none}
  .about .grid,.steps,.prices{grid-template-columns:1fr}
  .bento{grid-template-columns:1fr}
  .bento .card:nth-child(n){grid-column:auto}
  .p1,.p3{display:none}
  .p2{transform:none;width:min(270px,76vw)}
  .stage{margin-top:40px}
  .about,.final{border-radius:30px;margin:0 8px}
  .plan.hot{box-shadow:5px 5px 0 var(--ink)}
}
@media(max-width:480px){
  body{font-size:16px}
  .hero{padding-top:40px}
  .hero p.sub{font-size:17px}
  .btn{width:100%;text-align:center}
  .cta{flex-direction:column}
  nav .btn{width:auto}
  .price{font-size:46px}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>

<nav>
  <div class="wrap">
    <a class="logo" href="#top"><i>A</i>AdAutopsy</a>
    <div class="links">
      <a href="#about">What it is</a>
      <a href="#how">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
      <a class="btn primary sm" href="#pricing">Get a license</a>
    </div>
  </div>
</nav>

<header class="hero" id="top">
  <div class="wrap">
    <span class="pill">2 free scans, no card needed</span>
    <h1>Find the ads that <em>win</em>, then write your own</h1>
    <p class="sub">AdAutopsy pulls competitors' longest-running Meta ads, shows you why they work, and hands you new hooks, shot-by-shot video scripts and landing page specs.</p>
    <div class="cta">
      <a class="btn primary" href="#how">See how it works</a>
      <a class="btn ghost" href="#pricing">View pricing</a>
    </div>
    <p class="fine">Works inside Grok Bot as an MCP plugin.</p>

    <div class="stage" aria-hidden="true">
      <span class="sticker" style="left:6%;top:0;transform:rotate(-14deg)">🔍</span>
      <span class="sticker" style="right:7%;top:30px;transform:rotate(12deg)">🔥</span>
      <div class="phone p1"><div class="screen">
        <span class="tag">Winning ad #2</span>
        <div class="big">96<br><small style="font-size:18px;font-weight:700">days running</small></div>
        <div class="hook">“Stop scrolling if your back hurts after work.”</div>
        <div class="cap">Hook type: Pain agitation</div>
      </div></div>
      <div class="phone p2"><div class="screen">
        <span class="tag">Winning ad #1</span>
        <div class="big">214<br><small style="font-size:18px;font-weight:700">days running</small></div>
        <div class="hook">“I tried every morning drink. This is the only one I kept.”</div>
        <div class="cap">Hook type: Secret reveal<br>Landing page: captured</div>
        <div class="shot"><span>0:00 Hook</span><span>0:03 Problem</span><span>0:22 Offer</span></div>
      </div></div>
      <div class="phone p3"><div class="screen">
        <span class="tag">Your rewrite</span>
        <div class="big" style="font-size:40px">5 new<br>hooks</div>
        <div class="hook">“Nobody told me this before I bought the other one.”</div>
        <div class="cap">Spoken line + on-screen text</div>
      </div></div>
    </div>
  </div>
</header>

<section id="about">
  <div class="about">
    <div class="wrap">
      <div class="grid">
        <div>
          <p class="kicker">What is AdAutopsy?</p>
          <div class="head" style="margin-bottom:24px"><h2>An ad spy tool that does the writing for you</h2></div>
          <p>Ads that keep running for months are usually profitable, because nobody pays to run a loser that long. AdAutopsy searches the Meta Ad Library for a brand or keyword, ranks the live ads by how long they have been running, and picks out the winners.</p>
          <p>For each winner it pulls the opening line, headline, copy, creative preview and landing page. Then it explains the psychology behind it and writes you fresh versions to shoot.</p>
        </div>
        <ul>
          <li><b>Longest-running ads first</b>Days running is the signal, so you study what actually lasts.</li>
          <li><b>Hooks and scripts, ready to film</b>5 rewritten 3-second hooks plus a timed UGC script with shots, dialogue and on-screen text.</li>
          <li><b>Landing page teardown</b>Headlines, offers, guarantees and CTAs, laid out as a clone spec.</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section id="how">
  <div class="wrap">
    <div class="head center" style="text-align:center">
      <p class="kicker">How it works</p>
      <h2>From competitor to campaign in three steps</h2>
    </div>
    <div class="steps">
      <div class="card"><div class="ico" style="background:var(--sky)">🔎</div><h3>Search a brand</h3><p>Type a brand name or paste an Ad Library link, and pick a country. AdAutopsy scans their live ads.</p></div>
      <div class="card"><div class="ico" style="background:var(--sun)">🏆</div><h3>Get the winners</h3><p>The longest-running ads come back with hooks, copy, media and the page they send traffic to.</p></div>
      <div class="card"><div class="ico" style="background:var(--mint)">🎬</div><h3>Rewrite and clone</h3><p>Get new hooks, a shot-by-shot script, and a section-by-section landing page spec for your own brand.</p></div>
    </div>
  </div>
</section>

<section style="padding-top:0">
  <div class="wrap">
    <div class="head">
      <p class="kicker">Everything you get</p>
      <h2>Research and creative in one chat</h2>
    </div>
    <div class="bento">
      <div class="card"><div class="ico" style="background:#fff">🎣</div><h3>5 rewritten 3-second hooks</h3><p>Each has a spoken line and an on-screen text version, modeled on the top winner.</p></div>
      <div class="card"><div class="ico" style="background:var(--pink)">🧠</div><h3>Why it works</h3><p>See the trigger behind each ad, like pattern interrupt or pain agitation.</p></div>
      <div class="card"><div class="ico" style="background:var(--sky)">🌍</div><h3>Any country</h3><p>Search the US, UK, India or all markets.</p></div>
      <div class="card"><div class="ico">📄</div><h3>Landing page deconstructor</h3><p>H1s, section headers, pricing anchors, guarantees and buttons, ready to hand to your web or design tools.</p></div>
    </div>
  </div>
</section>

<section id="pricing" style="padding-top:20px">
  <div class="wrap">
    <div class="head center" style="text-align:center">
      <p class="kicker">Pricing</p>
      <h2>Pick how deep you want to dig</h2>
      <p>Cancel any time. Your license key appears right after checkout.</p>
    </div>
    <div class="prices">
      <div class="plan">
        <h3>Growth</h3><p class="who">Solo marketers and creators</p>
        <div class="price">$14.99<small>/month</small></div>
        <ul>
          <li>Scans <b>15 active ads</b> per search</li>
          <li>Top <b>2</b> longest-running winners</li>
          <li>5 hooks and a shot-by-shot script</li>
          <li>Full landing page deconstructor</li>
          <li>1 license activation</li>
        </ul>
        <a class="btn ghost" ${link(u.growth)}>Get Growth key</a>
      </div>
      <div class="plan hot">
        <span class="badge">Most popular</span>
        <h3>Pro</h3><p class="who">Media buyers and DTC brands</p>
        <div class="price">$29.99<small>/month</small></div>
        <ul>
          <li>Scans <b>30 active ads</b> per search</li>
          <li>Top <b>5</b> longest-running winners</li>
          <li>Full shot-by-shot UGC scripts</li>
          <li>Complete CRO and wireframe clone specs</li>
          <li>1 license activation</li>
        </ul>
        <a class="btn" ${link(u.pro)}>Get Pro key</a>
      </div>
      <div class="plan">
        <h3>Agency</h3><p class="who">Performance teams</p>
        <div class="price">$69.99<small>/month</small></div>
        <ul>
          <li>Scans <b>50 active ads</b> per search</li>
          <li>Top <b>10</b> longest-running winners</li>
          <li>Full landing page deconstructor</li>
          <li>Priority deep funnel extraction</li>
          <li><b>5 team</b> license activations</li>
        </ul>
        <a class="btn ghost" ${link(u.agency)}>Get Agency key</a>
      </div>
    </div>
    <p class="note">Not sure yet? Every user gets <b>2 free scans</b> with 1 top winner and a landing page hero preview.</p>
  </div>
</section>

<section id="faq" style="padding-top:20px">
  <div class="wrap" style="max-width:820px">
    <div class="head"><p class="kicker">Common questions</p><h2>Before your first scan</h2></div>
    <details><summary>How do I use my license key?</summary><p>After checkout, copy your Dodo license key and include it in your prompt in Grok Bot, for example: “Spy on AG1 ads, my license key is XXXX.” Your tier unlocks instantly.</p></details>
    <details><summary>How do I add AdAutopsy to Grok Bot?</summary><p>Add this MCP endpoint as a plugin: <code>${esc(u.baseUrl)}/mcp</code></p></details>
    <details><summary>Where does the ad data come from?</summary><p>From the public Meta Ad Library. AdAutopsy only reads ads that are currently active.</p></details>
    <details><summary>What does the free preview include?</summary><p>Two scans per user. Each shows your top winner and the hero section of a landing page. Paid tiers unlock more ads, more winners and the full funnel breakdown.</p></details>
    <details><summary>Does it copy competitors' ads?</summary><p>No. It studies what works and writes original hooks and scripts for your brand. Always use your own product, claims and creative.</p></details>
  </div>
</section>

<section style="padding-top:20px">
  <div class="final">
    <div class="wrap">
      <h2>Your next winning ad is already running</h2>
      <a class="btn primary" style="background:var(--sun);color:var(--ink);box-shadow:4px 4px 0 #fff" href="#pricing">Get your license key</a>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <span>© AdAutopsy · Grok Bot MCP plugin</span>
    <span>MCP endpoint: <code>/mcp</code> · Status: Online</span>
  </div>
</footer>

</body>
</html>`;
}
