const html = String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HaoXAgent</title>
    <meta
      name="description"
      content="HaoXAgent builds AI-native products for creators, operators, and modern teams."
    />
    <style>
      :root {
        color-scheme: dark;
        --bg: #08080b;
        --ink: #f7f3ec;
        --muted: rgba(247, 243, 236, 0.66);
        --faint: rgba(247, 243, 236, 0.42);
        --line: rgba(247, 243, 236, 0.13);
        --panel: rgba(247, 243, 236, 0.055);
        --panel-strong: rgba(247, 243, 236, 0.095);
        --cyan: #38e8df;
        --rose: #ff5f8f;
        --gold: #f2c572;
        --violet: #9d8cff;
      }

      * {
        box-sizing: border-box;
      }

      html {
        min-height: 100%;
        background: var(--bg);
      }

      body {
        min-height: 100%;
        margin: 0;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
          sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 16% 10%, rgba(56, 232, 223, 0.18), transparent 26rem),
          radial-gradient(circle at 78% 8%, rgba(255, 95, 143, 0.13), transparent 25rem),
          radial-gradient(circle at 52% 90%, rgba(242, 197, 114, 0.1), transparent 32rem),
          linear-gradient(180deg, #0b0b10 0%, #09090d 52%, #050507 100%);
        overflow-x: hidden;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
          linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px);
        background-size: 72px 72px;
        mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent 72%);
      }

      a {
        color: inherit;
      }

      .shell {
        position: relative;
        width: min(1160px, calc(100% - 40px));
        min-height: 100vh;
        margin: 0 auto;
        padding: 30px 0 42px;
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
        gap: 12px;
        text-decoration: none;
      }

      .brand-mark {
        width: 36px;
        height: 36px;
        border-radius: 13px;
        display: grid;
        place-items: center;
        color: #08080b;
        font-size: 13px;
        font-weight: 820;
        letter-spacing: -0.02em;
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(56, 232, 223, 0.9) 44%, rgba(255, 95, 143, 0.95));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.7),
          0 16px 48px rgba(56, 232, 223, 0.16);
      }

      .brand-copy {
        display: grid;
        gap: 1px;
      }

      .brand-name {
        font-size: 15px;
        font-weight: 720;
        letter-spacing: -0.01em;
      }

      .brand-line {
        color: var(--faint);
        font-size: 12px;
      }

      .top-links {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .top-link {
        min-height: 36px;
        padding: 0 12px;
        border: 1px solid transparent;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        text-decoration: none;
        color: var(--muted);
        font-size: 13px;
        transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
      }

      .top-link:hover {
        color: var(--ink);
        border-color: var(--line);
        background: rgba(255, 255, 255, 0.045);
      }

      main {
        flex: 1;
        display: grid;
        align-content: center;
        padding: 76px 0 56px;
      }

      .hero {
        max-width: 980px;
        margin: 0 auto;
        text-align: center;
      }

      .eyebrow {
        width: fit-content;
        margin: 0 auto;
        border: 1px solid rgba(247, 243, 236, 0.14);
        border-radius: 999px;
        padding: 7px 12px;
        display: inline-flex;
        align-items: center;
        gap: 9px;
        background: rgba(247, 243, 236, 0.055);
        color: rgba(247, 243, 236, 0.76);
        font-size: 13px;
        font-weight: 620;
        backdrop-filter: blur(18px);
      }

      .signal {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--cyan);
        box-shadow: 0 0 0 5px rgba(56, 232, 223, 0.1);
      }

      h1 {
        margin: 28px auto 0;
        max-width: 900px;
        font-size: clamp(54px, 9vw, 118px);
        line-height: 0.9;
        font-weight: 780;
        letter-spacing: -0.07em;
      }

      .hero-gradient {
        background: linear-gradient(110deg, #fffaf0 0%, #eafffb 34%, #e8e6ff 67%, #ffdce7 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .subtitle {
        margin: 28px auto 0;
        max-width: 660px;
        color: var(--muted);
        font-size: clamp(17px, 2vw, 21px);
        line-height: 1.68;
        letter-spacing: 0;
      }

      .primary-actions {
        margin-top: 34px;
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      .pill-button {
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        text-decoration: none;
        font-size: 14px;
        font-weight: 720;
        border: 1px solid var(--line);
        color: var(--ink);
        background: rgba(255, 255, 255, 0.075);
        transition: transform 170ms ease, border-color 170ms ease, background 170ms ease;
      }

      .pill-button.primary {
        color: #07080b;
        border-color: transparent;
        background: linear-gradient(135deg, #f9f4ea 0%, #88fff8 45%, #ff7aa1 100%);
        box-shadow: 0 24px 70px rgba(56, 232, 223, 0.15);
      }

      .pill-button:hover {
        transform: translateY(-1px);
        border-color: rgba(247, 243, 236, 0.26);
        background: rgba(255, 255, 255, 0.11);
      }

      .pill-button.primary:hover {
        background: linear-gradient(135deg, #fffaf1 0%, #9ffff9 45%, #ff8aab 100%);
      }

      .product-grid {
        margin-top: 70px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }

      .product-card {
        min-height: 276px;
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: 28px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        position: relative;
        text-decoration: none;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.088), rgba(255, 255, 255, 0.035)),
          rgba(255, 255, 255, 0.035);
        box-shadow: 0 24px 90px rgba(0, 0, 0, 0.24);
        transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
      }

      .product-card::before {
        content: "";
        position: absolute;
        inset: -1px;
        opacity: 0;
        background: radial-gradient(circle at 30% 0%, var(--accent), transparent 36%);
        transition: opacity 180ms ease;
      }

      .product-card:hover {
        transform: translateY(-4px);
        border-color: rgba(247, 243, 236, 0.26);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.045)),
          rgba(255, 255, 255, 0.04);
      }

      .product-card:hover::before {
        opacity: 0.16;
      }

      .product-card > * {
        position: relative;
      }

      .product-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .product-logo {
        width: 48px;
        height: 48px;
        border-radius: 17px;
        display: grid;
        place-items: center;
        color: #07080b;
        font-weight: 820;
        font-size: 15px;
        background: linear-gradient(135deg, #fffaf0, var(--accent));
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.24);
      }

      .product-tag {
        color: var(--faint);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .product-body {
        margin-top: 42px;
      }

      .product-card h2 {
        margin: 0;
        font-size: 30px;
        line-height: 1;
        letter-spacing: -0.04em;
      }

      .product-card p {
        margin: 16px 0 0;
        max-width: 290px;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.72;
      }

      .product-foot {
        margin-top: 28px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        color: rgba(247, 243, 236, 0.84);
        font-size: 14px;
        font-weight: 680;
      }

      .arrow {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(247, 243, 236, 0.16);
        background: rgba(255, 255, 255, 0.05);
        transition: transform 180ms ease;
      }

      .product-card:hover .arrow {
        transform: translateX(2px);
      }

      .livepilot {
        --accent: var(--cyan);
      }

      .nultica {
        --accent: var(--violet);
      }

      .ais {
        --accent: var(--gold);
      }

      footer {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        color: var(--faint);
        font-size: 13px;
        border-top: 1px solid rgba(247, 243, 236, 0.09);
        padding-top: 20px;
      }

      @media (max-width: 880px) {
        .shell {
          width: min(100% - 28px, 680px);
          padding-top: 22px;
        }

        .top-links {
          display: none;
        }

        main {
          align-content: start;
          padding: 62px 0 44px;
        }

        .hero {
          text-align: left;
        }

        .eyebrow,
        .subtitle {
          margin-left: 0;
        }

        h1 {
          margin-left: 0;
          font-size: clamp(54px, 16vw, 78px);
          letter-spacing: -0.065em;
        }

        .primary-actions {
          justify-content: flex-start;
        }

        .product-grid {
          margin-top: 48px;
          grid-template-columns: 1fr;
        }

        .product-card {
          min-height: 230px;
        }

        footer {
          flex-direction: column;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          scroll-behavior: auto !important;
          transition: none !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="https://haoxagent.com" aria-label="HaoXAgent home">
          <div class="brand-mark">HX</div>
          <div class="brand-copy">
            <div class="brand-name">HaoXAgent</div>
            <div class="brand-line">AI-native product lab</div>
          </div>
        </a>

        <nav class="top-links" aria-label="Products">
          <a class="top-link" href="https://livepilot.haoxagent.com">LivePilot</a>
          <a class="top-link" href="https://coding.torchv.com/">Nultica</a>
          <a class="top-link" href="https://ais.prod.torchv.com/">TorchV AIS</a>
        </nav>
      </header>

      <main>
        <section class="hero" aria-labelledby="hero-title">
          <div class="eyebrow"><span class="signal"></span> Independent AI products for practical work</div>
          <h1 id="hero-title"><span class="hero-gradient">Welcome to HaoXAgent</span></h1>
          <p class="subtitle">
            We build focused AI systems for creators, operators, and modern teams:
            from live-stream growth to collaborative coding and enterprise intelligence.
          </p>

          <div class="primary-actions" aria-label="Primary product links">
            <a class="pill-button primary" href="https://livepilot.haoxagent.com">Enter LivePilot <span aria-hidden="true">→</span></a>
            <a class="pill-button" href="https://coding.torchv.com/">Open Nultica</a>
            <a class="pill-button" href="https://ais.prod.torchv.com/">TorchV AIS</a>
          </div>
        </section>

        <section class="product-grid" aria-label="HaoXAgent product matrix">
          <a class="product-card livepilot" href="https://livepilot.haoxagent.com" rel="noopener">
            <div>
              <div class="product-head">
                <div class="product-logo">LP</div>
                <div class="product-tag">Creator growth</div>
              </div>
              <div class="product-body">
                <h2>LivePilot</h2>
                <p>AI 直播增长助手。把直播截图、数据和复盘变成下一场可执行的开播方案。</p>
              </div>
            </div>
            <div class="product-foot">
              <span>进入产品</span>
              <span class="arrow" aria-hidden="true">→</span>
            </div>
          </a>

          <a class="product-card nultica" href="https://coding.torchv.com/" rel="noopener">
            <div>
              <div class="product-head">
                <div class="product-logo">N</div>
                <div class="product-tag">Agent workspace</div>
              </div>
              <div class="product-body">
                <h2>Nultica</h2>
                <p>面向人类与智能体协作的项目空间，把想法、任务和执行过程放在一起。</p>
              </div>
            </div>
            <div class="product-foot">
              <span>打开空间</span>
              <span class="arrow" aria-hidden="true">→</span>
            </div>
          </a>

          <a class="product-card ais" href="https://ais.prod.torchv.com/" rel="noopener">
            <div>
              <div class="product-head">
                <div class="product-logo">AI</div>
                <div class="product-tag">Enterprise intelligence</div>
              </div>
              <div class="product-body">
                <h2>TorchV AIS</h2>
                <p>企业知识与智能应用入口，连接业务场景、知识资产和 AI 工作流。</p>
              </div>
            </div>
            <div class="product-foot">
              <span>访问 AIS</span>
              <span class="arrow" aria-hidden="true">→</span>
            </div>
          </a>
        </section>
      </main>

      <footer>
        <span>© 2026 HaoXAgent</span>
        <span>Independent AI systems. Designed for real work.</span>
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
