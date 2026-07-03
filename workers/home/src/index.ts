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
        width: 42px;
        height: 38px;
        border: 1px solid rgba(246, 240, 230, 0.22);
        border-radius: 12px;
        display: grid;
        place-items: center;
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: -0.08em;
        background: rgba(246, 240, 230, 0.055);
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

      .button span {
        position: relative;
      }

      .button:hover {
        color: #0b0a08;
        border-color: transparent;
        background: linear-gradient(135deg, #fff8ec, #82eee6 48%, #ef7898);
        transform: translateY(-1px);
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

      .product-atlas {
        position: absolute;
        inset: 18px;
        border-radius: 28px;
        border: 1px solid rgba(246, 240, 230, 0.12);
        background:
          radial-gradient(circle at 20% 16%, rgba(246, 240, 230, 0.12), transparent 28%),
          linear-gradient(145deg, rgba(246, 240, 230, 0.09), rgba(246, 240, 230, 0.035));
        overflow: hidden;
      }

      .product-atlas::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, rgba(246, 240, 230, 0.035) 1px, transparent 1px),
          linear-gradient(rgba(246, 240, 230, 0.035) 1px, transparent 1px);
        background-size: 42px 42px;
        mask-image: linear-gradient(to bottom, rgba(0,0,0,0.82), transparent 86%);
      }

      .atlas-line {
        content: "";
        position: absolute;
        left: 50%;
        top: 48%;
        width: 72%;
        height: 1px;
        transform: translate(-50%, -50%);
        background: linear-gradient(90deg, transparent, rgba(246,240,230,0.28), transparent);
      }

      .atlas-line::before,
      .atlas-line::after {
        content: "";
        position: absolute;
        top: 0;
        width: 44%;
        height: 1px;
        transform-origin: center;
        background: linear-gradient(90deg, transparent, rgba(246,240,230,0.2));
      }

      .atlas-line::before {
        left: 10%;
        transform: rotate(30deg);
      }

      .atlas-line::after {
        right: 10%;
        transform: rotate(-30deg);
      }

      .atlas-header {
        position: absolute;
        left: 26px;
        top: 24px;
        max-width: 300px;
      }

      .atlas-header span {
        color: var(--soft);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .atlas-header strong {
        display: block;
        margin-top: 8px;
        font-size: 28px;
        line-height: 1;
        letter-spacing: -0.055em;
      }

      .atlas-node {
        position: absolute;
        width: 178px;
        min-height: 132px;
        padding: 18px;
        border: 1px solid rgba(246, 240, 230, 0.12);
        border-radius: 24px;
        background:
          radial-gradient(circle at 16% 8%, color-mix(in srgb, var(--accent), white 20%), transparent 34%),
          rgba(16, 15, 12, 0.74);
        box-shadow: 0 28px 70px rgba(0, 0, 0, 0.24);
      }

      .atlas-node.ais-node-card { right: 34px; top: 38px; --accent: var(--gold); }
      .atlas-node.nultica-node-card { left: 44px; bottom: 42px; --accent: var(--violet); }
      .atlas-node.livepilot-node-card { right: 78px; bottom: 54px; --accent: var(--cyan); }

      .atlas-mini-mark {
        width: 40px;
        height: 36px;
        border: 1px solid rgba(246, 240, 230, 0.18);
        border-radius: 12px;
        display: grid;
        place-items: center;
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: -0.08em;
        background: rgba(246, 240, 230, 0.055);
      }

      .atlas-node h3 {
        margin: 18px 0 0;
        font-size: 20px;
        line-height: 1.06;
        letter-spacing: -0.05em;
      }

      .atlas-node p {
        margin: 9px 0 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }

      .atlas-center {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 118px;
        height: 118px;
        border: 1px solid rgba(246, 240, 230, 0.14);
        border-radius: 36px;
        display: grid;
        place-items: center;
        transform: translate(-50%, -38%);
        color: rgba(246, 240, 230, 0.88);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 38px;
        font-weight: 700;
        letter-spacing: -0.1em;
        background:
          radial-gradient(circle at 28% 16%, rgba(255,255,255,0.16), transparent 40%),
          rgba(246, 240, 230, 0.055);
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
        gap: 12px;
      }

      .logo-symbol {
        width: 42px;
        height: 38px;
        border: 1px solid rgba(246, 240, 230, 0.2);
        border-radius: 12px;
        display: grid;
        place-items: center;
        position: relative;
        overflow: hidden;
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: -0.08em;
        background: rgba(246, 240, 230, 0.045);
      }

      .logo-symbol span,
      .logo-symbol svg {
        position: relative;
        z-index: 1;
      }

      .nultica-symbol svg {
        width: 18px;
        height: 18px;
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

        .atlas-header {
          left: 20px;
          top: 20px;
        }

        .atlas-center {
          width: 94px;
          height: 94px;
          font-size: 30px;
        }

        .atlas-node {
          width: 156px;
          min-height: 124px;
          padding: 15px;
        }

        .atlas-node.ais-node-card { right: 18px; top: 138px; }
        .atlas-node.nultica-node-card { left: 20px; bottom: 32px; }
        .atlas-node.livepilot-node-card { right: 18px; bottom: 32px; }

        .atlas-node h3 {
          font-size: 18px;
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
              <a class="button" href="https://ais.prod.torchv.com/">Explore TorchV AIS <span aria-hidden="true">→</span></a>
              <a class="button" href="https://coding.torchv.com/">Open Nultica</a>
              <a class="button" href="https://livepilot.haoxagent.com">Enter LivePilot</a>
            </div>
          </div>

          <aside class="studio" aria-label="Product previews">
            <div class="product-atlas">
              <div class="atlas-line" aria-hidden="true"></div>
              <div class="atlas-header">
                <span>Product atlas</span>
                <strong>One studio, three focused systems.</strong>
              </div>
              <div class="atlas-center">HX</div>

              <div class="atlas-node ais-node-card">
                <div class="atlas-mini-mark">TV</div>
                <h3>Enterprise knowledge</h3>
                <p>Structured intelligence for organizations and workflows.</p>
              </div>

              <div class="atlas-node nultica-node-card">
                <div class="atlas-mini-mark">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
                    <path d="M12 2.8v18.4M2.8 12h18.4M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="#f6f0e6" stroke-width="2.2" stroke-linecap="round"/>
                  </svg>
                </div>
                <h3>Agent workspace</h3>
                <p>Human and agent collaboration with context in one place.</p>
              </div>

              <div class="atlas-node livepilot-node-card">
                <div class="atlas-mini-mark">LP</div>
                <h3>Creator growth</h3>
                <p>Stream review, diagnosis, and next-session action loops.</p>
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
                      <path d="M12 2.8v18.4M2.8 12h18.4M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="#f6f0e6" stroke-width="2.2" stroke-linecap="round"/>
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
