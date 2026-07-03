const html = String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hao X Agent</title>
    <meta
      name="description"
      content="Hao X Agent is a product studio building focused AI systems for creators, operators, and modern teams."
    />
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0a08;
        --ink: #f6f0e6;
        --muted: rgba(246, 240, 230, 0.68);
        --soft: rgba(246, 240, 230, 0.46);
        --line: rgba(246, 240, 230, 0.14);
        --panel: rgba(246, 240, 230, 0.06);
        --panel-strong: rgba(246, 240, 230, 0.1);
        --cyan: #55ded6;
        --rose: #eb6f91;
        --gold: #d7b06c;
        --violet: #9282d9;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        min-height: 100%;
      }

      body {
        margin: 0;
        font-family:
          ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
          sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 14% 8%, rgba(215, 176, 108, 0.18), transparent 28rem),
          radial-gradient(circle at 84% 22%, rgba(85, 222, 214, 0.12), transparent 30rem),
          linear-gradient(180deg, #11100d 0%, #0b0a08 46%, #060504 100%);
        overflow-x: hidden;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.26'/%3E%3C/svg%3E");
        opacity: 0.13;
        mix-blend-mode: soft-light;
      }

      a {
        color: inherit;
      }

      .shell {
        position: relative;
        width: min(1180px, calc(100% - 40px));
        min-height: 100vh;
        margin: 0 auto;
        padding: 28px 0 42px;
        display: flex;
        flex-direction: column;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 13px;
        text-decoration: none;
      }

      .brand-mark {
        width: 38px;
        height: 38px;
        border: 1px solid rgba(246, 240, 230, 0.2);
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: #0b0a08;
        font-size: 13px;
        font-weight: 850;
        letter-spacing: -0.04em;
        background:
          radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.92), transparent 32%),
          linear-gradient(135deg, #f6f0e6, #72efe7 48%, #ef7f9c);
        box-shadow: 0 16px 44px rgba(85, 222, 214, 0.15);
      }

      .brand-name {
        display: block;
        font-size: 15px;
        font-weight: 760;
        letter-spacing: -0.03em;
      }

      .brand-line {
        display: block;
        margin-top: 1px;
        color: var(--soft);
        font-size: 12px;
      }

      .top-links {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border: 1px solid rgba(246, 240, 230, 0.1);
        border-radius: 999px;
        background: rgba(246, 240, 230, 0.04);
      }

      .top-link {
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        color: var(--muted);
        font-size: 13px;
        text-decoration: none;
        transition: color 160ms ease, background 160ms ease;
      }

      .top-link:hover {
        color: var(--ink);
        background: rgba(246, 240, 230, 0.08);
      }

      main {
        flex: 1;
        display: grid;
        align-content: center;
        padding: 72px 0 52px;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 0.98fr) minmax(360px, 1.02fr);
        gap: 54px;
        align-items: center;
      }

      .eyebrow {
        width: fit-content;
        border: 1px solid rgba(246, 240, 230, 0.14);
        border-radius: 999px;
        padding: 7px 11px;
        color: rgba(246, 240, 230, 0.78);
        background: rgba(246, 240, 230, 0.05);
        font-size: 12px;
        font-weight: 650;
        letter-spacing: 0.02em;
      }

      h1 {
        margin: 26px 0 0;
        max-width: 620px;
        color: #fff9ef;
        font-size: clamp(58px, 8.2vw, 116px);
        line-height: 0.88;
        font-weight: 820;
        letter-spacing: -0.075em;
      }

      .wordline {
        display: block;
      }

      .wordmark-x {
        position: relative;
        display: inline-block;
        margin: 0 0.018em;
        color: transparent;
        background: linear-gradient(130deg, var(--cyan), #f8e2aa 48%, var(--rose));
        -webkit-background-clip: text;
        background-clip: text;
      }

      .wordmark-x::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 51%;
        width: 0.16em;
        height: 0.16em;
        border-radius: 999px;
        transform: translate(-50%, -50%);
        background: #fff7e9;
        box-shadow: 0 0 22px rgba(85, 222, 214, 0.62);
      }

      .subtitle {
        margin: 26px 0 0;
        max-width: 560px;
        color: var(--muted);
        font-size: clamp(17px, 2vw, 20px);
        line-height: 1.72;
      }

      .actions {
        margin-top: 34px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .button {
        position: relative;
        overflow: hidden;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        border: 1px solid rgba(246, 240, 230, 0.16);
        color: var(--ink);
        background: rgba(246, 240, 230, 0.065);
        font-size: 14px;
        font-weight: 720;
        text-decoration: none;
        transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
      }

      .button::before {
        content: "";
        position: absolute;
        inset: -1px;
        pointer-events: none;
        opacity: 0;
        background:
          radial-gradient(circle at var(--mx, 50%) var(--my, 50%),
            rgba(255, 255, 255, 0.58),
            rgba(255, 255, 255, 0.16) 22%,
            transparent 48%);
        transition: opacity 170ms ease;
      }

      .button:hover::before {
        opacity: 1;
      }

      .button span {
        position: relative;
      }

      .button.primary {
        color: #0b0a08;
        border-color: transparent;
        background: linear-gradient(135deg, #fff8ec, #82eee6 48%, #ef7898);
      }

      .button:hover {
        transform: translateY(-1px);
        border-color: rgba(246, 240, 230, 0.26);
        background: rgba(246, 240, 230, 0.1);
      }

      .button.primary:hover {
        background: linear-gradient(135deg, #fff8ec, #9ff7f1 48%, #f18da6);
      }

      .studio {
        position: relative;
        min-height: 520px;
        border: 1px solid rgba(246, 240, 230, 0.12);
        border-radius: 36px;
        overflow: hidden;
        background:
          linear-gradient(180deg, rgba(246, 240, 230, 0.1), rgba(246, 240, 230, 0.035)),
          #11100d;
        box-shadow: 0 36px 110px rgba(0, 0, 0, 0.38);
      }

      .studio::before,
      .studio::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 26% 24%, rgba(215, 176, 108, 0.22), transparent 28%),
          radial-gradient(circle at 82% 30%, rgba(85, 222, 214, 0.18), transparent 28%);
        opacity: 0.85;
      }

      .studio::after {
        inset: auto 22px 22px auto;
        width: 190px;
        height: 190px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(235, 111, 145, 0.18), transparent 66%);
      }

      .carousel {
        position: absolute;
        inset: 18px;
        overflow: hidden;
        border-radius: 28px;
      }

      .carousel-track {
        height: 100%;
        display: grid;
        grid-template-columns: repeat(3, 100%);
        animation: slide-show 18s infinite ease-in-out;
      }

      .studio:hover .carousel-track {
        animation-play-state: paused;
      }

      .concept-slide {
        position: relative;
        padding: 26px;
        overflow: hidden;
        border: 1px solid rgba(246, 240, 230, 0.12);
        border-radius: 28px;
        background:
          radial-gradient(circle at 22% 18%, rgba(246, 240, 230, 0.13), transparent 28%),
          linear-gradient(145deg, rgba(246, 240, 230, 0.09), rgba(246, 240, 230, 0.035));
      }

      .concept-slide::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, rgba(246, 240, 230, 0.04) 1px, transparent 1px),
          linear-gradient(rgba(246, 240, 230, 0.04) 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: linear-gradient(to bottom, rgba(0,0,0,0.84), transparent 82%);
      }

      .concept-slide > * {
        position: relative;
      }

      .concept-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
      }

      .concept-title {
        margin: 0;
        font-size: 34px;
        line-height: 0.95;
        letter-spacing: -0.06em;
      }

      .concept-kicker {
        display: block;
        margin-bottom: 8px;
        color: var(--soft);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .concept-mark {
        width: 52px;
        height: 52px;
        border-radius: 19px;
        display: grid;
        place-items: center;
        color: #0b0a08;
        font-size: 15px;
        font-weight: 860;
        background:
          radial-gradient(circle at 26% 18%, rgba(255,255,255,0.92), transparent 32%),
          linear-gradient(135deg, #fff8ec, var(--accent));
      }

      .concept-art {
        position: absolute;
        left: 26px;
        right: 26px;
        bottom: 76px;
        height: 246px;
      }

      .concept-caption {
        position: absolute;
        left: 26px;
        right: 26px;
        bottom: 24px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.58;
      }

      .ais-map {
        position: absolute;
        inset: 0;
      }

      .ais-map .layer {
        position: absolute;
        left: 50%;
        width: 70%;
        height: 58px;
        border: 1px solid rgba(246, 240, 230, 0.16);
        border-radius: 20px;
        transform: translateX(-50%) rotateX(58deg) rotateZ(-18deg);
        background: linear-gradient(135deg, rgba(215, 176, 108, 0.26), rgba(85, 222, 214, 0.1));
        box-shadow: 0 22px 44px rgba(0,0,0,0.18);
      }

      .ais-map .layer:nth-child(1) { top: 10px; }
      .ais-map .layer:nth-child(2) { top: 78px; width: 78%; }
      .ais-map .layer:nth-child(3) { top: 146px; width: 86%; }

      .ais-node,
      .live-dot {
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent), transparent 78%);
      }

      .ais-node.one { left: 22%; top: 44px; }
      .ais-node.two { left: 68%; top: 92px; }
      .ais-node.three { left: 44%; top: 164px; }

      .board {
        position: absolute;
        inset: 8px 0 0;
        display: flex;
        gap: 12px;
        align-items: stretch;
      }

      .board-col {
        flex: 1;
        border: 1px solid rgba(246, 240, 230, 0.12);
        border-radius: 18px;
        padding: 12px;
        background: rgba(246, 240, 230, 0.06);
      }

      .board-card {
        height: 34px;
        margin-bottom: 9px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04));
      }

      .board-card.short { width: 72%; }
      .board-card.tint { background: linear-gradient(135deg, rgba(146,130,217,0.36), rgba(255,255,255,0.05)); }

      .live-dashboard {
        position: absolute;
        inset: 6px 0 0;
        display: grid;
        grid-template-columns: 0.9fr 1.1fr;
        gap: 12px;
      }

      .live-panel {
        border: 1px solid rgba(246, 240, 230, 0.12);
        border-radius: 22px;
        padding: 16px;
        background: rgba(246, 240, 230, 0.06);
      }

      .score {
        font-size: 58px;
        line-height: 0.9;
        font-weight: 820;
        letter-spacing: -0.08em;
      }

      .mini-bars {
        display: grid;
        gap: 9px;
        margin-top: 18px;
      }

      .bar {
        height: 10px;
        border-radius: 999px;
        background: rgba(246, 240, 230, 0.11);
        overflow: hidden;
      }

      .bar span {
        display: block;
        height: 100%;
        width: var(--w);
        border-radius: inherit;
        background: linear-gradient(90deg, var(--cyan), var(--rose));
      }

      .carousel-dots {
        position: absolute;
        left: 50%;
        bottom: 18px;
        z-index: 3;
        display: flex;
        gap: 7px;
        transform: translateX(-50%);
      }

      .carousel-dots span {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: rgba(246, 240, 230, 0.32);
      }

      .carousel-dots span:nth-child(1) {
        animation: dot-one 18s infinite ease-in-out;
      }

      .carousel-dots span:nth-child(2) {
        animation: dot-two 18s infinite ease-in-out;
      }

      .carousel-dots span:nth-child(3) {
        animation: dot-three 18s infinite ease-in-out;
      }

      @keyframes slide-show {
        0%, 27% { transform: translateX(0); }
        33%, 60% { transform: translateX(-100%); }
        66%, 93% { transform: translateX(-200%); }
        100% { transform: translateX(0); }
      }

      @keyframes dot-one {
        0%, 27%, 100% { background: var(--ink); width: 18px; }
        33%, 93% { background: rgba(246, 240, 230, 0.32); width: 6px; }
      }

      @keyframes dot-two {
        0%, 27%, 66%, 100% { background: rgba(246, 240, 230, 0.32); width: 6px; }
        33%, 60% { background: var(--ink); width: 18px; }
      }

      @keyframes dot-three {
        0%, 60%, 100% { background: rgba(246, 240, 230, 0.32); width: 6px; }
        66%, 93% { background: var(--ink); width: 18px; }
      }

      .product-grid {
        margin-top: 44px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .product-card {
        position: relative;
        overflow: hidden;
        min-height: 226px;
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 28px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        color: var(--ink);
        background: rgba(246, 240, 230, 0.055);
        text-decoration: none;
        transition: transform 170ms ease, background 170ms ease, border-color 170ms ease;
      }

      .product-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        background:
          radial-gradient(circle at var(--mx, 50%) var(--my, 50%),
            color-mix(in srgb, var(--accent), white 38%),
            transparent 34%);
        mix-blend-mode: screen;
        transition: opacity 180ms ease;
      }

      .product-card:hover::before {
        opacity: 0.2;
      }

      .product-card > * {
        position: relative;
      }

      .product-card:hover {
        transform: translateY(-3px);
        border-color: rgba(246, 240, 230, 0.24);
        background: rgba(246, 240, 230, 0.085);
      }

      .product-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }

      .logo-lockup {
        height: 52px;
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .logo-symbol {
        width: 38px;
        height: 38px;
        border-radius: 15px;
        display: grid;
        place-items: center;
        position: relative;
        overflow: hidden;
        color: #0b0a08;
        font-size: 12px;
        font-weight: 860;
        letter-spacing: -0.03em;
        background:
          radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.3) 25%, transparent 48%),
          linear-gradient(135deg, #fff8ec, var(--accent));
      }

      .logo-symbol::after {
        content: "";
        position: absolute;
        right: -5px;
        top: -5px;
        width: 17px;
        height: 17px;
        border-radius: 999px;
        background: rgba(235, 111, 145, 0.92);
      }

      .logo-symbol span,
      .logo-symbol svg {
        position: relative;
        z-index: 1;
      }

      .nultica-symbol svg {
        width: 19px;
        height: 19px;
      }

      .logo-word {
        color: rgba(246, 240, 230, 0.94);
        font-size: 15px;
        font-weight: 760;
        letter-spacing: -0.035em;
      }

      .logo-word small {
        display: block;
        margin-top: 1px;
        color: var(--soft);
        font-size: 10px;
        font-weight: 640;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .product-tag {
        color: var(--soft);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .product-card h2 {
        margin: 34px 0 0;
        font-size: 26px;
        line-height: 1;
        letter-spacing: -0.05em;
      }

      .product-card p {
        margin: 13px 0 0;
        max-width: 300px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.66;
      }

      .product-foot {
        margin-top: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: rgba(246, 240, 230, 0.84);
        font-size: 14px;
        font-weight: 680;
      }

      .arrow {
        width: 32px;
        height: 32px;
        border: 1px solid rgba(246, 240, 230, 0.14);
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(246, 240, 230, 0.05);
      }

      .ais {
        --accent: var(--gold);
      }

      .nultica {
        --accent: var(--violet);
      }

      .livepilot {
        --accent: var(--cyan);
      }

      footer {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        padding-top: 20px;
        border-top: 1px solid rgba(246, 240, 230, 0.1);
        color: var(--soft);
        font-size: 13px;
      }

      @media (max-width: 980px) {
        .hero {
          grid-template-columns: 1fr;
        }

        .studio {
          min-height: 460px;
        }
      }

      @media (max-width: 760px) {
        .shell {
          width: min(100% - 28px, 680px);
          padding-top: 22px;
        }

        .top-links {
          display: none;
        }

        main {
          padding: 50px 0 40px;
        }

        h1 {
          font-size: clamp(56px, 18vw, 82px);
        }

        .product-grid {
          grid-template-columns: 1fr;
        }

        .studio {
          min-height: 520px;
        }

        .concept-art {
          bottom: 100px;
          height: 230px;
        }

        .concept-title {
          font-size: 30px;
        }

        .board {
          gap: 8px;
        }

        footer {
          flex-direction: column;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          transition: none !important;
          scroll-behavior: auto !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="https://haoxagent.com" aria-label="Hao X Agent home">
          <div class="brand-mark">HX</div>
          <span>
            <span class="brand-name">Hao X Agent</span>
            <span class="brand-line">Product studio for focused intelligence</span>
          </span>
        </a>

        <nav class="top-links" aria-label="Products">
          <a class="top-link" href="https://ais.prod.torchv.com/">TorchV AIS</a>
          <a class="top-link" href="https://coding.torchv.com/">Nultica</a>
          <a class="top-link" href="https://livepilot.haoxagent.com">LivePilot</a>
        </nav>
      </header>

      <main>
        <section class="hero" aria-labelledby="hero-title">
          <div>
            <div class="eyebrow">Products for thoughtful, high-leverage work</div>
            <h1 id="hero-title">
              <span class="wordline">Hao <span class="wordmark-x">X</span></span>
              <span class="wordline">Agent</span>
            </h1>
            <p class="subtitle">
              A small collection of focused systems for enterprise knowledge,
              agent collaboration, and creator growth. Built to make complex work
              feel calmer, sharper, and easier to act on.
            </p>

            <div class="actions" aria-label="Primary product links">
              <a class="button primary" href="https://ais.prod.torchv.com/">Explore TorchV AIS <span aria-hidden="true">→</span></a>
              <a class="button" href="https://coding.torchv.com/">Open Nultica</a>
              <a class="button" href="https://livepilot.haoxagent.com">Enter LivePilot</a>
            </div>
          </div>

          <aside class="studio" aria-label="Product previews">
            <div class="carousel">
              <div class="carousel-track">
                <section class="concept-slide ais">
                  <div class="concept-top">
                    <div>
                      <span class="concept-kicker">Enterprise intelligence</span>
                      <h2 class="concept-title">Knowledge becomes an operating layer.</h2>
                    </div>
                    <div class="concept-mark">TV</div>
                  </div>
                  <div class="concept-art ais-map" aria-hidden="true">
                    <div class="layer"></div>
                    <div class="layer"></div>
                    <div class="layer"></div>
                    <span class="ais-node one"></span>
                    <span class="ais-node two"></span>
                    <span class="ais-node three"></span>
                  </div>
                  <p class="concept-caption">TorchV AIS connects knowledge, workflows, and business intelligence into one navigable system.</p>
                </section>

                <section class="concept-slide nultica">
                  <div class="concept-top">
                    <div>
                      <span class="concept-kicker">Agent workspace</span>
                      <h2 class="concept-title">Projects shaped for human and agent teams.</h2>
                    </div>
                    <div class="concept-mark">
                      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
                        <path d="M12 2.8v18.4M2.8 12h18.4M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="#0b0a08" stroke-width="2.5" stroke-linecap="round"/>
                      </svg>
                    </div>
                  </div>
                  <div class="concept-art board" aria-hidden="true">
                    <div class="board-col">
                      <div class="board-card tint"></div>
                      <div class="board-card"></div>
                      <div class="board-card short"></div>
                    </div>
                    <div class="board-col">
                      <div class="board-card"></div>
                      <div class="board-card tint short"></div>
                      <div class="board-card"></div>
                    </div>
                    <div class="board-col">
                      <div class="board-card short"></div>
                      <div class="board-card"></div>
                      <div class="board-card tint"></div>
                    </div>
                  </div>
                  <p class="concept-caption">Nultica keeps tasks, context, and agent progress visible without turning the workspace into noise.</p>
                </section>

                <section class="concept-slide livepilot">
                  <div class="concept-top">
                    <div>
                      <span class="concept-kicker">Creator growth</span>
                      <h2 class="concept-title">A calmer loop for every next stream.</h2>
                    </div>
                    <div class="concept-mark">LP</div>
                  </div>
                  <div class="concept-art live-dashboard" aria-hidden="true">
                    <div class="live-panel">
                      <div class="score">82</div>
                      <div class="mini-bars">
                        <div class="bar"><span style="--w: 76%"></span></div>
                        <div class="bar"><span style="--w: 48%"></span></div>
                        <div class="bar"><span style="--w: 62%"></span></div>
                      </div>
                    </div>
                    <div class="live-panel">
                      <div class="board-card tint"></div>
                      <div class="board-card"></div>
                      <div class="board-card short"></div>
                      <div class="board-card tint short"></div>
                    </div>
                  </div>
                  <p class="concept-caption">LivePilot turns screenshots and review data into diagnosis, action scripts, and the next-session plan.</p>
                </section>
              </div>

              <div class="carousel-dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </aside>
        </section>

        <section class="product-grid" aria-label="Hao X Agent product matrix">
          <a class="product-card ais" href="https://ais.prod.torchv.com/" rel="noopener">
            <div>
              <div class="product-head">
                <div class="logo-lockup" aria-label="TorchV AIS logo">
                  <div class="logo-symbol"><span>TV</span></div>
                  <div class="logo-word">TorchV<small>AIS</small></div>
                </div>
                <div class="product-tag">Enterprise</div>
              </div>
              <h2>TorchV AIS</h2>
              <p>企业知识与智能应用入口，连接业务场景、知识资产和 AI 工作流。</p>
            </div>
            <div class="product-foot">
              <span>访问 AIS</span>
              <span class="arrow" aria-hidden="true">→</span>
            </div>
          </a>

          <a class="product-card nultica" href="https://coding.torchv.com/" rel="noopener">
            <div>
              <div class="product-head">
                <div class="logo-lockup" aria-label="Nultica logo">
                  <div class="logo-symbol nultica-symbol">
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
                      <path d="M12 2.8v18.4M2.8 12h18.4M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="#0b0a08" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                  </div>
                  <div class="logo-word">Nultica<small>Agent space</small></div>
                </div>
                <div class="product-tag">Workspace</div>
              </div>
              <h2>Nultica</h2>
              <p>面向人类与智能体协作的项目空间，把想法、任务和执行过程放在一起。</p>
            </div>
            <div class="product-foot">
              <span>打开空间</span>
              <span class="arrow" aria-hidden="true">→</span>
            </div>
          </a>

          <a class="product-card livepilot" href="https://livepilot.haoxagent.com" rel="noopener">
            <div>
              <div class="product-head">
                <div class="logo-lockup" aria-label="LivePilot logo">
                  <div class="logo-symbol"><span>LP</span></div>
                  <div class="logo-word">LivePilot<small>Growth loop</small></div>
                </div>
                <div class="product-tag">Creator</div>
              </div>
              <h2>LivePilot</h2>
              <p>AI 直播增长助手。把直播截图、数据和复盘变成下一场可执行的开播方案。</p>
            </div>
            <div class="product-foot">
              <span>进入产品</span>
              <span class="arrow" aria-hidden="true">→</span>
            </div>
          </a>
        </section>
      </main>

      <footer>
        <span>© 2026 Hao X Agent</span>
        <span>Independent systems. Designed for real work.</span>
      </footer>
    </div>
    <script>
      const spotlightTargets = document.querySelectorAll(".button, .product-card");

      for (const target of spotlightTargets) {
        target.addEventListener("pointermove", (event) => {
          const rect = target.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          target.style.setProperty("--mx", x + "%");
          target.style.setProperty("--my", y + "%");
        });
      }
    </script>
  </body>
</html>`;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "haoxagent-home" });
    }

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-content-type-options": "nosniff"
      }
    });
  }
};
