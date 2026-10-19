export interface LandingUrls {
  growth: string;
  pro: string;
  agency: string;
  baseUrl: string;
  // Optional legal pages. Footer links only render for the ones you pass in.
  terms?: string;
  privacy?: string;
  refund?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function renderLanding(u: LandingUrls): string {
  const link = (url: string) =>
    `href="${esc(url)}"${url.startsWith("#") ? "" : ' target="_blank" rel="noopener"'}`;

  const legalLinks = (
    [
      ["Terms", u.terms],
      ["Privacy", u.privacy],
      ["Refund policy", u.refund],
    ] as [string, string | undefined][]
  )
    .filter((x) => !!x[1])
    .map((x) => `<a href="${esc(x[1] as string)}">${x[0]}</a>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AdAutopsy: A plugin that finds winning Meta ads and rewrites them</title>
<meta name="description" content="AdAutopsy is a plugin for AI agents like Grok Bot. Find a brand's longest-running Meta ads, pick the ones to study, and get new hooks and a shot-by-shot script. 2 free scans, no card." />
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

/* scroll reveal (only active when JS runs) */
.js .rv{opacity:0;translate:0 26px;transition:opacity .7s ease,translate .7s ease,transform .2s ease,box-shadow .2s ease,background .2s ease}
.js .rv.in{opacity:1;translate:0 0}

/* nav */
nav{position:sticky;top:0;z-index:20;background:rgba(255,254,251,.88);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
nav .wrap{display:flex;align-items:center;justify-content:space-between;height:66px}
.logo{display:flex;align-items:center;gap:10px;font:800 22px "Bricolage Grotesque",sans-serif;text-decoration:none}
.logo i{width:32px;height:32px;border-radius:10px;background:var(--blue);color:#fff;display:grid;place-items:center;font-style:normal;font-size:18px;transform:rotate(-6deg);transition:transform .3s}
.logo:hover i{transform:rotate(6deg) scale(1.08)}
.links{display:flex;gap:26px;align-items:center;font-weight:500}
.links a{text-decoration:none}
.links a:hover{color:var(--blue)}

/* buttons */
.btn{display:inline-block;padding:14px 24px;border-radius:999px;font-weight:700;text-decoration:none;border:2px solid var(--ink);transition:transform .15s,box-shadow .15s,background .15s}
.btn.primary{background:var(--blue);color:#fff;border-color:var(--ink);box-shadow:4px 4px 0 var(--ink)}
.btn.primary:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink)}
.btn.primary:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.btn.ghost{background:#fff}
.btn.ghost:hover{background:var(--sky);transform:translateY(-2px)}
.btn.sm{padding:9px 18px;font-size:15px}

/* hero */
.hero{padding:64px 0 40px;text-align:center;position:relative}
.pill{display:inline-block;background:var(--sky);color:var(--blue);font-weight:700;font-size:14px;padding:7px 16px;border-radius:999px}
.hero h1{font-size:clamp(42px,7.4vw,86px);font-weight:800;margin:22px auto 20px;max-width:14ch}
.hero h1 em{font-style:normal;background:var(--sun);padding:0 .15em;border-radius:.2em;display:inline-block;transform:rotate(-1.5deg)}
.hero p.sub{max-width:640px;margin:0 auto 18px;color:var(--mute);font-size:19px}
.chatline{display:inline-block;font-weight:700;background:var(--ink);color:#fff;padding:8px 18px;border-radius:999px;font-size:16px;margin-bottom:28px}
.cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.fine{margin-top:16px;font-size:14px;color:var(--mute)}
@keyframes rise{from{opacity:0;transform:translateY(18px)}}
.hero .pill{animation:rise .6s .05s both}
.hero h1{animation:rise .7s .15s both}
.hero p.sub{animation:rise .7s .28s both}
.hero .chatline{animation:rise .7s .38s both}
.hero .cta{animation:rise .7s .46s both}

/* phone deck */
.deck-wrap{margin-top:56px;position:relative}
.deck{--w:260px;--dx:135px;position:relative;height:calc(var(--w)*2.06 + 34px);max-width:820px;margin:0 auto;touch-action:pan-y;user-select:none;-webkit-user-select:none;animation:float 7s ease-in-out infinite}
@keyframes float{50%{translate:0 -10px}}
.phone{position:absolute;left:50%;top:0;width:var(--w);aspect-ratio:9/18.5;background:var(--ink);border-radius:38px;padding:9px;box-shadow:0 30px 60px -20px rgba(42,75,255,.4);cursor:pointer;transform-origin:50% 100%;transition:transform .75s cubic-bezier(.2,.8,.2,1),filter .75s,box-shadow .75s}
.phone:before{content:"";position:absolute;top:16px;left:50%;width:70px;height:20px;border-radius:99px;background:#000;transform:translateX(-50%);z-index:3}
.phone[data-pos="0"]{transform:translateX(-50%);z-index:3;cursor:default}
.phone[data-pos="1"]{transform:translateX(calc(-50% + var(--dx))) translateY(26px) rotate(7deg) scale(.93);z-index:2;filter:brightness(.93) saturate(.92)}
.phone[data-pos="2"]{transform:translateX(calc(-50% - var(--dx))) translateY(26px) rotate(-7deg) scale(.93);z-index:1;filter:brightness(.93) saturate(.92)}
.phone[data-pos="1"]:hover{transform:translateX(calc(-50% + var(--dx) + 8px)) translateY(18px) rotate(8deg) scale(.94)}
.phone[data-pos="2"]:hover{transform:translateX(calc(-50% - var(--dx) - 8px)) translateY(18px) rotate(-8deg) scale(.94)}
.screen{height:100%;border-radius:30px;overflow:hidden;padding:46px 16px 18px;display:flex;flex-direction:column;gap:10px;color:#fff;position:relative}
.s1 .screen{background:linear-gradient(170deg,#2a4bff,#6a2cff)}
.s2 .screen{background:linear-gradient(170deg,#ff6a88,#ffb36a)}
.s3 .screen{background:linear-gradient(170deg,#0fa97a,#2a4bff)}
.tag{align-self:flex-start;background:rgba(255,255,255,.22);backdrop-filter:blur(6px);border-radius:99px;padding:4px 11px;font-size:12px;font-weight:700}
.big{font:800 50px/1 "Bricolage Grotesque",sans-serif}
.big small{font-size:18px;font-weight:700}
.hook{margin-top:auto;font:700 21px/1.15 "Bricolage Grotesque",sans-serif}
.cap{background:rgba(0,0,0,.25);border-radius:14px;padding:10px 12px;font-size:12.5px;line-height:1.4}
.shot{display:flex;justify-content:space-between;font-size:12px;font-weight:700;border-top:1px solid rgba(255,255,255,.35);padding-top:7px}
.says{display:grid;gap:8px;margin-top:6px}
.says .cap b{display:block;font-size:11px;opacity:.8;margin-bottom:2px}
.sticker{position:absolute;font-size:44px;filter:drop-shadow(2px 4px 0 rgba(0,0,0,.12));animation:bob 4.5s ease-in-out infinite;z-index:4;pointer-events:none}
.sticker.b{animation-delay:-2s}
@keyframes bob{50%{translate:0 -12px}}
.dots{display:flex;gap:8px;justify-content:center;margin-top:20px}
.dot{width:10px;height:10px;border-radius:99px;border:2px solid var(--ink);background:#fff;padding:0;cursor:pointer;transition:width .3s,background .3s}
.dot[aria-current="true"]{width:30px;background:var(--blue)}

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
.about li{background:#fff;border:2px solid var(--ink);border-radius:20px;padding:16px 18px;font-weight:500;transition:transform .2s}
.about li:hover{transform:translateX(6px)}
.about li b{display:block;font-family:"Bricolage Grotesque",sans-serif;font-size:19px}

/* how it works: steps + chat */
.how-grid{display:grid;grid-template-columns:.92fr 1.08fr;gap:44px;align-items:start}
.step{display:flex;gap:16px;padding:20px 0;border-bottom:2px solid var(--line)}
.step:first-child{padding-top:0}
.step:last-child{border-bottom:0}
.num{flex:none;width:46px;height:46px;border-radius:50%;border:2px solid var(--ink);display:grid;place-items:center;font:800 21px "Bricolage Grotesque",sans-serif}
.step:nth-child(1) .num{background:var(--sky)}
.step:nth-child(2) .num{background:var(--sun)}
.step:nth-child(3) .num{background:var(--pink)}
.step:nth-child(4) .num{background:var(--mint)}
.step h3{font-size:23px;margin-bottom:6px}
.step p{color:var(--mute)}
.step q{color:var(--ink);font-weight:700;quotes:"\\201C" "\\201D"}
.chat-col{position:sticky;top:90px}
.chat{background:#fff;border:2px solid var(--ink);border-radius:28px;box-shadow:8px 8px 0 var(--ink);overflow:hidden}
.chat-top{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:2px solid var(--ink);background:var(--sun);font-weight:700}
.live{width:10px;height:10px;border-radius:50%;background:#12b76a;box-shadow:0 0 0 0 rgba(18,183,106,.6);animation:pulse 2s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 9px rgba(18,183,106,0)}100%{box-shadow:0 0 0 0 rgba(18,183,106,0)}}
.chat-top small{margin-left:auto;font-weight:500;opacity:.7}
.chat-body{padding:18px;display:flex;flex-direction:column;gap:12px;background:var(--paper)}
.msg{max-width:90%;padding:11px 15px;border-radius:18px;font-size:15.5px;line-height:1.45}
.msg.me{align-self:flex-end;background:var(--blue);color:#fff;border-bottom-right-radius:6px}
.msg.ai{align-self:flex-start;background:var(--sky);border-bottom-left-radius:6px}
.msg ol{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:8px}
.msg ol li{display:flex;gap:9px;align-items:flex-start}
.msg ol li b{flex:none;min-width:22px;height:22px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:12px;margin-top:1px}
.msg ol li span{display:block}
.msg ol li em{display:block;font-style:normal;font-size:13px;color:var(--mute)}
.typed{display:inline-block}
.chat-note{text-align:center;font-size:13px;color:var(--mute);margin-top:14px}
.js .msg{opacity:0}
.js .chat.in .msg{animation:pop .5s ease forwards;animation-delay:var(--d)}
@keyframes pop{from{opacity:0;translate:0 12px}to{opacity:1;translate:0 0}}
.js .typed{clip-path:inset(0 100% 0 0)}
.js .chat.in .typed{animation:type 1.1s steps(15) forwards;animation-delay:calc(var(--d) + .3s)}
@keyframes type{to{clip-path:inset(0 0 0 0)}}

/* cards + bento */
.card{background:#fff;border:2px solid var(--ink);border-radius:28px;padding:28px;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-5px);box-shadow:6px 6px 0 var(--ink)}
.card h3{font-size:25px;margin:14px 0 8px}
.card p{color:var(--mute)}
.ico{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:27px;border:2px solid var(--ink)}
.bento{display:grid;grid-template-columns:repeat(6,1fr);gap:20px}
.bento .card:nth-child(1){grid-column:span 4;background:var(--sun)}
.bento .card:nth-child(2){grid-column:span 2}
.bento .card:nth-child(3){grid-column:span 3}
.bento .card:nth-child(4){grid-column:span 3}
.bento .card:nth-child(5){grid-column:span 6;background:var(--blue);color:#fff}
.bento .card:nth-child(1) p{color:#3b3410}
.bento .card:nth-child(5) p{color:#d8dfff}
.bento .card:nth-child(5) .ico{background:#fff}

/* definitions */
.defs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:14px}
.def{background:var(--sky);border:2px solid var(--ink);border-radius:24px;padding:22px 26px}
.def h3{font-size:22px;margin-bottom:6px}
.def p{color:var(--ink)}
.reset{text-align:center;color:var(--mute);font-size:15px;margin-bottom:40px}

/* pricing */
.prices{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;align-items:stretch}
.plan{background:#fff;border:2px solid var(--ink);border-radius:30px;padding:32px;display:flex;flex-direction:column;position:relative}
.plan:hover{transform:translateY(-5px)}
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
.free{margin-top:30px;background:var(--sky);border-radius:26px;padding:24px 28px;display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;justify-content:center;text-align:center}
.free h3{font-size:24px}
.chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.chip{background:#fff;border:2px solid var(--ink);border-radius:99px;padding:6px 16px;font-weight:700;font-size:15px}

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
.legal{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center}
.legal a{text-decoration:none}
.legal a:hover{color:var(--blue);text-decoration:underline}

/* tablet + phone */
@media(max-width:900px){
  section{padding:60px 0}
  .links a:not(.btn){display:none}
  .about .grid,.prices,.how-grid,.defs{grid-template-columns:1fr}
  .chat-col{position:static}
  .bento{grid-template-columns:1fr}
  .bento .card:nth-child(n){grid-column:auto}
  .deck{--w:min(240px,62vw);--dx:min(100px,24vw)}
  .deck-wrap{margin-top:40px}
  .about,.final{border-radius:30px;margin:0 8px}
  .plan.hot{box-shadow:5px 5px 0 var(--ink)}
  .sticker{display:none}
}
@media(max-width:480px){
  body{font-size:16px}
  .hero{padding-top:40px}
  .hero p.sub{font-size:17px}
  .btn{width:100%;text-align:center}
  .cta{flex-direction:column}
  nav .btn{width:auto}
  .price{font-size:46px}
  .msg{max-width:96%}
}
@media(prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  .js .rv{opacity:1;translate:none}
  .js .msg{opacity:1}
  .js .typed{clip-path:none}
}
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
    <span class="pill">A plugin for AI agents like Grok Bot</span>
    <h1>Find the ads that <em>win</em>, then write your own</h1>
    <p class="sub">AdAutopsy is a plugin you add to your AI agent. Ask for a brand's longest-running Meta ads, pick the ones to study, and get new hooks and a shot-by-shot video script.</p>
    <p class="chatline">You use it by chatting with Grok.</p>
    <div class="cta">
      <a class="btn primary" href="#how">See how it works</a>
      <a class="btn ghost" href="#pricing">View pricing</a>
    </div>
    <p class="fine">2 free scans, no card needed.</p>

    <div class="deck-wrap">
      <span class="sticker" style="left:6%;top:0;rotate:-14deg">🔍</span>
      <span class="sticker b" style="right:7%;top:30px;rotate:12deg">🔥</span>
      <div class="deck" role="group" aria-label="Example screens from a scan. Click or swipe to flip through.">
        <div class="phone s1"><div class="screen">
          <span class="tag">Ad #1 · video</span>
          <div class="big">214<br><small>days running</small></div>
          <div class="hook">“I tried every morning drink. This is the only one I kept.”</div>
          <div class="cap">Hook type: Secret reveal<br>Thumbnail: cluttered counter, bold text overlay</div>
          <div class="shot"><span>0:00 Hook</span><span>0:03 Problem</span><span>0:22 Offer</span></div>
        </div></div>
        <div class="phone s2"><div class="screen">
          <span class="tag">What they say</span>
          <div class="big" style="font-size:38px">Heard in<br>the video</div>
          <div class="says">
            <div class="cap"><b>0:00</b>“I tried every morning drink.”</div>
            <div class="cap"><b>0:03</b>“Most of them left me jittery or bloated.”</div>
            <div class="cap"><b>0:09</b>“This is the only one I kept.”</div>
          </div>
          <div class="hook" style="font-size:16px">Transcribed from the audio</div>
        </div></div>
        <div class="phone s3"><div class="screen">
          <span class="tag">Your rewrite</span>
          <div class="big" style="font-size:40px">5 new<br>hooks</div>
          <div class="hook">“Nobody told me this before I bought the other one.”</div>
          <div class="cap">Spoken line + on-screen text</div>
          <div class="shot"><span>0:00 Hook</span><span>0:10 Demo</span><span>0:30 CTA</span></div>
        </div></div>
      </div>
      <div class="dots">
        <button class="dot" aria-label="Show ad breakdown" type="button"></button>
        <button class="dot" aria-label="Show what they say" type="button"></button>
        <button class="dot" aria-label="Show your rewrite" type="button"></button>
      </div>
      <p class="fine">Example screens. Tap or swipe to flip through.</p>
    </div>
  </div>
</header>

<section id="about">
  <div class="about">
    <div class="wrap">
      <div class="grid rv">
        <div>
          <p class="kicker">What is AdAutopsy?</p>
          <div class="head" style="margin-bottom:24px"><h2>A plugin that studies ads so Grok can write yours</h2></div>
          <p>Ads that keep running for months are usually profitable, because nobody pays to run a loser that long. AdAutopsy searches the Meta Ad Library for a brand, lists their live ads with the longest-running first, and lets you choose which to study.</p>
          <p>It is not a website or an app. You add it to an AI agent like Grok Bot and talk to it in chat. For the ads you pick, it listens to the audio, reads the thumbnail, and Grok turns that into fresh hooks and a script to shoot.</p>
        </div>
        <ul>
          <li><b>Longest-running ads first</b>Days running is the signal, so you study what actually lasts.</li>
          <li><b>Hears and sees the ad</b>Transcribes what people say in video ads and reads the thumbnail.</li>
          <li><b>Hooks and scripts, ready to film</b>New 3-second hooks plus a timed script with shots, dialogue and on-screen text.</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section id="how">
  <div class="wrap">
    <div class="head center rv" style="text-align:center">
      <p class="kicker">How it works</p>
      <h2>Four steps, all in chat</h2>
    </div>
    <div class="how-grid">
      <div class="steps">
        <div class="step rv"><div class="num">1</div><div><h3>Add AdAutopsy to Grok Bot</h3><p>Add the plugin once using its endpoint URL. It is listed in the FAQ below.</p></div></div>
        <div class="step rv"><div class="num">2</div><div><h3>Ask for a brand</h3><p>Type <q>Find winning ads for [brand].</q> That is one scan.</p></div></div>
        <div class="step rv"><div class="num">3</div><div><h3>Pick the ads you want studied</h3><p>Grok shows a numbered list of the brand's longest-running ads. You reply with the numbers you care about.</p></div></div>
        <div class="step rv"><div class="num">4</div><div><h3>Get hooks and a script</h3><p>AdAutopsy listens to what is said in the video and looks at the thumbnail. Grok then writes new hooks and a shot-by-shot script for you.</p></div></div>
      </div>

      <div class="chat-col">
        <div class="chat rv" aria-label="Example chat with Grok">
          <div class="chat-top"><span class="live"></span>Grok Bot<small>AdAutopsy plugin on</small></div>
          <div class="chat-body">
            <div class="msg me" style="--d:.2s">Find winning ads for Nova Greens</div>
            <div class="msg ai" style="--d:1.3s">
              Scanned their live ads. Longest-running first:
              <ol>
                <li><b>1</b><span>“I tried every morning drink…”<em>214 days · video</em></span></li>
                <li><b>2</b><span>“Stop scrolling if your energy crashes at 3pm.”<em>96 days · image</em></span></li>
                <li><b>3</b><span>“Nobody told me this before I bought the other one.”<em>71 days · video</em></span></li>
                <li><b>4</b><span>“Three ingredients. No jitters.”<em>40 days · video</em></span></li>
              </ol>
            </div>
            <div class="msg ai" style="--d:2.7s">Which ones should I study? Reply with the numbers.</div>
            <div class="msg me" style="--d:4s"><span class="typed">analyze 1 and 3</span></div>
            <div class="msg ai" style="--d:5.8s">On it. Listening to the audio and reading the thumbnails. Here come 5 new hooks and a shot-by-shot script for each…</div>
          </div>
        </div>
        <p class="chat-note">Example conversation. Brand and ads are made up.</p>
      </div>
    </div>
  </div>
</section>

<section style="padding-top:0">
  <div class="wrap">
    <div class="head rv">
      <p class="kicker">Everything you get</p>
      <h2>Research and creative in one chat</h2>
    </div>
    <div class="bento">
      <div class="card rv"><div class="ico" style="background:#fff">👆</div><h3>You pick the ads</h3><p>Grok lists the longest-running ads first. You choose which ones get a full breakdown, so nothing is spent on ads you do not care about.</p></div>
      <div class="card rv"><div class="ico" style="background:var(--pink)">👂</div><h3>Hears the audio</h3><p>Transcribes what people actually say in video ads.</p></div>
      <div class="card rv"><div class="ico" style="background:var(--mint)">🖼️</div><h3>Reads the thumbnail</h3><p>Picks out the visual hook and any on-screen text.</p></div>
      <div class="card rv"><div class="ico" style="background:var(--sky)">🧠</div><h3>Why it works</h3><p>See the trigger behind each ad, like pattern interrupt or pain agitation.</p></div>
      <div class="card rv"><div class="ico">📄</div><h3>Landing page deconstructor</h3><p>H1s, section headers, pricing anchors, guarantees and buttons, ready to hand to your web or design tools.</p></div>
    </div>
  </div>
</section>

<section id="pricing" style="padding-top:20px">
  <div class="wrap">
    <div class="head center rv" style="text-align:center">
      <p class="kicker">Pricing</p>
      <h2>Pick how deep you want to dig</h2>
      <p>Cancel any time. Your license key appears right after checkout.</p>
    </div>

    <div class="defs">
      <div class="def rv"><h3>Scan</h3><p>One brand search. It lists that brand's live ads, longest-running first.</p></div>
      <div class="def rv"><h3>Deep analysis</h3><p>A full audio and visual breakdown of one ad you picked: what is said, what the thumbnail shows, and why it works.</p></div>
    </div>
    <p class="reset">Daily scans on paid plans reset at midnight UTC.</p>

    <div class="prices">
      <div class="plan rv">
        <h3>Growth</h3><p class="who">Solo marketers and creators</p>
        <div class="price">$14.99<small>/month</small></div>
        <ul>
          <li><b>8 scans</b> a day</li>
          <li><b>12 ads</b> listed per scan</li>
          <li><b>2 deep analyses</b> per scan</li>
          <li>Hooks and a shot-by-shot script</li>
          <li>Full landing page deconstructor</li>
          <li>1 license activation</li>
        </ul>
        <a class="btn ghost" ${link(u.growth)}>Get Growth key</a>
      </div>
      <div class="plan hot rv">
        <span class="badge">Most popular</span>
        <h3>Pro</h3><p class="who">Media buyers and DTC brands</p>
        <div class="price">$29.99<small>/month</small></div>
        <ul>
          <li><b>10 scans</b> a day</li>
          <li><b>20 ads</b> listed per scan</li>
          <li><b>3 deep analyses</b> per scan</li>
          <li>Full shot-by-shot UGC scripts</li>
          <li>Complete CRO and wireframe clone specs</li>
          <li>1 license activation</li>
        </ul>
        <a class="btn" ${link(u.pro)}>Get Pro key</a>
      </div>
      <div class="plan rv">
        <h3>Agency</h3><p class="who">Performance teams</p>
        <div class="price">$69.99<small>/month</small></div>
        <ul>
          <li><b>18 scans</b> a day</li>
          <li><b>30 ads</b> listed per scan</li>
          <li><b>3 deep analyses</b> per scan</li>
          <li>Full landing page deconstructor</li>
          <li>Priority deep funnel extraction</li>
          <li><b>5 team</b> license activations</li>
        </ul>
        <a class="btn ghost" ${link(u.agency)}>Get Agency key</a>
      </div>
    </div>

    <div class="free rv">
      <h3>Not sure yet? Try Free</h3>
      <div class="chips">
        <span class="chip">2 scans</span>
        <span class="chip">5 ads listed</span>
        <span class="chip">1 deep analysis per scan</span>
        <span class="chip">No card</span>
      </div>
    </div>
  </div>
</section>

<section id="faq" style="padding-top:20px">
  <div class="wrap" style="max-width:820px">
    <div class="head rv"><p class="kicker">Common questions</p><h2>Before your first scan</h2></div>
    <details><summary>How do I add AdAutopsy to Grok Bot?</summary><p>AdAutopsy is a plugin, not a website or app. In Grok Bot, add a plugin using this endpoint URL: <code>${esc(u.baseUrl)}/mcp</code>. Then just chat with Grok.</p></details>
    <details><summary>What counts as a scan?</summary><p>One brand search. When you ask Grok to find winning ads for a brand, AdAutopsy looks through their live ads and lists the longest-running ones. That is one scan.</p></details>
    <details><summary>What is a deep analysis?</summary><p>A full audio and visual breakdown of one ad you picked from the list. AdAutopsy transcribes what is said in the video, looks at the thumbnail for the visual hook and on-screen text, and Grok uses that to write new hooks and a shot-by-shot script. Your plan sets how many ads from each scan you can analyze.</p></details>
    <details><summary>What happens when I hit my daily limit?</summary><p>Grok will tell you the limit has been reached. Daily scans reset at midnight UTC, and you can keep going then. On the Free plan, the 2 scans are a one-time preview, and a paid plan unlocks daily scans.</p></details>
    <details><summary>How do I use my license key?</summary><p>After checkout, copy your Dodo license key and include it in your message to Grok, for example: “Find winning ads for [brand], my license key is XXXX.” Your plan unlocks instantly.</p></details>
    <details><summary>Where does the ad data come from?</summary><p>From the public Meta Ad Library. AdAutopsy only reads ads that are currently active.</p></details>
    <details><summary>What does the free plan include?</summary><p>2 scans, with 5 ads listed per scan and 1 deep analysis per scan, plus a landing page hero preview. Paid plans add more daily scans, longer lists, more deep analyses and the full landing page breakdown.</p></details>
    <details><summary>Does it copy competitors' ads?</summary><p>No. It studies what works and writes original hooks and scripts for your brand. Always use your own product, claims and creative.</p></details>
  </div>
</section>

<section style="padding-top:20px">
  <div class="final rv">
    <div class="wrap">
      <h2>Your next winning ad is already running</h2>
      <a class="btn primary" style="background:var(--sun);color:var(--ink);box-shadow:4px 4px 0 #fff" href="#pricing">Get your license key</a>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <span>© AdAutopsy · Plugin for Grok Bot</span>
    <div class="legal">${legalLinks}<span>MCP endpoint: <code>/mcp</code> · Status: Online</span></div>
  </div>
</footer>

<script>
(function(){
  var root=document.documentElement;
  root.classList.add("js");
  var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Phone deck: click, swipe, dots, gentle auto-rotate
  var deck=document.querySelector(".deck");
  var phones=[].slice.call(document.querySelectorAll(".deck .phone"));
  var dots=[].slice.call(document.querySelectorAll(".dots .dot"));
  var active=0,paused=false,startX=null,swiped=false;
  function set(n){
    active=(n+phones.length)%phones.length;
    phones.forEach(function(p,i){p.setAttribute("data-pos",String((i-active+phones.length)%phones.length));});
    dots.forEach(function(d,i){d.setAttribute("aria-current",i===active?"true":"false");});
  }
  set(0);
  phones.forEach(function(p,i){p.addEventListener("click",function(){if(swiped){swiped=false;return;}set(i);});});
  dots.forEach(function(d,i){d.addEventListener("click",function(){set(i);});});
  if(deck){
    deck.addEventListener("pointerdown",function(e){startX=e.clientX;swiped=false;});
    deck.addEventListener("pointerup",function(e){
      if(startX===null)return;
      var dx=e.clientX-startX;startX=null;
      if(Math.abs(dx)>40){swiped=true;set(active+(dx<0?1:-1));}
    });
    deck.addEventListener("pointerenter",function(){paused=true;});
    deck.addEventListener("pointerleave",function(){paused=false;startX=null;});
  }
  if(!reduce){setInterval(function(){if(!paused)set(active+1);},4800);}

  // Reveal on scroll (also starts the chat animation)
  var els=[].slice.call(document.querySelectorAll(".rv"));
  if("IntersectionObserver" in window){
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}
      });
    },{threshold:0.15});
    els.forEach(function(el){io.observe(el);});
  }else{
    els.forEach(function(el){el.classList.add("in");});
  }
})();
</script>

</body>
</html>`;
}
