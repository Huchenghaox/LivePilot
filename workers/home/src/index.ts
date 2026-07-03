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
        --bg: #060811;
        --panel: rgba(255, 255, 255, 0.07);
        --panel-strong: rgba(255, 255, 255, 0.12);
        --line: rgba(255, 255, 255, 0.16);
        --text: rgba(255, 255, 255, 0.94);
        --muted: rgba(235, 241, 255, 0.66);
        --soft: rgba(235, 241, 255, 0.44);
        --cyan: #28f0e7;
        --blue: #7aa5ff;
        --pink: #ff4f87;
        --violet: #9d7cff;
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
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
          sans-serif;
        background:
          radial-gradient(circle at 20% 12%, rgba(40, 240, 231, 0.24), transparent 28rem),
          radial-gradient(circle at 82% 18%, rgba(255, 79, 135, 0.2), transparent 24rem),
          radial-gradient(circle at 50% 85%, rgba(122, 165, 255, 0.16), transparent 30rem),
          linear-gradient(145deg, #05070d 0%, #0a0e1a 52%, #080611 100%);
        color: var(--text);
        overflow-x: hidden;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
        background-size: 56px 56px;
        mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 78%);
      }

      .shell {
        position: relative;
        width: min(1120px, calc(100% - 40px));
        min-height: 100vh;
        margin: 0 auto;
        padding: 36px 0 48px;
        display: flex;
        flex-direction: column;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-weight: 700;
        letter-spacing: 0;
      }

      .mark {
        width: 38px;
        height: 38px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background:
          linear-gradient(135deg, rgba(40,240,231,0.95), rgba(255,79,135,0.88));
        box-shadow: 0 18px 60px rgba(40, 240, 231, 0.18);
      }

      .mark svg {
        width: 21px;
        height: 21px;
      }

      .nav-note {
        color: var(--muted);
        font-size: 14px;
      }

      main {
        flex: 1;
        display: grid;
        align-content: center;
        padding: 70px 0 56px;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
        gap: 44px;
        align-items: center;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        width: fit-content;
        border: 1px solid rgba(40, 240, 231, 0.28);
        background: rgba(40, 240, 231, 0.08);
        color: #9ffdf8;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 650;
      }

      .pulse {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--cyan);
        box-shadow: 0 0 0 6px rgba(40, 240, 231, 0.14);
      }

      h1 {
        margin: 24px 0 0;
        max-width: 820px;
        font-size: clamp(48px, 8vw, 104px);
        line-height: 0.94;
        letter-spacing: 0;
      }

      .gradient-text {
        background: linear-gradient(105deg, #fff 0%, #d9fff9 30%, #c9d7ff 56%, #ffd1df 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .subtitle {
        margin: 26px 0 0;
        max-width: 650px;
        color: var(--muted);
        font-size: clamp(17px, 2.4vw, 22px);
        line-height: 1.65;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 34px;
      }

      .button {
        appearance: none;
        border: 0;
        text-decoration: none;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: #05070d;
        font-weight: 760;
        background: linear-gradient(135deg, var(--cyan), #fff0c6 48%, var(--pink));
        box-shadow: 0 18px 50px rgba(255, 79, 135, 0.18);
      }

      .button.secondary {
        color: var(--text);
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--line);
        box-shadow: none;
      }

      .orbital {
        position: relative;
        min-height: 460px;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 34px;
        overflow: hidden;
        background:
          linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)),
          rgba(255,255,255,0.04);
        box-shadow: 0 28px 120px rgba(0, 0, 0, 0.38);
      }

      .orbital::before,
      .orbital::after {
        content: "";
        position: absolute;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.12);
        inset: 54px;
        transform: rotate(-12deg);
      }

      .orbital::after {
        inset: 112px 46px;
        border-color: rgba(40, 240, 231, 0.18);
        transform: rotate(24deg);
      }

      .core {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 158px;
        height: 158px;
        border-radius: 46px;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 30% 20%, rgba(255,255,255,0.94), rgba(255,255,255,0.08) 42%, transparent 72%),
          linear-gradient(135deg, rgba(40,240,231,0.92), rgba(122,165,255,0.72), rgba(255,79,135,0.82));
        box-shadow:
          0 0 60px rgba(40,240,231,0.22),
          0 0 96px rgba(255,79,135,0.18);
      }

      .core span {
        color: rgba(3, 8, 16, 0.9);
        font-weight: 900;
        font-size: 34px;
      }

      .node {
        position: absolute;
        min-width: 138px;
        padding: 14px 15px;
        border-radius: 20px;
        background: rgba(9, 13, 26, 0.74);
        border: 1px solid rgba(255,255,255,0.13);
        backdrop-filter: blur(18px);
      }

      .node strong {
        display: block;
        font-size: 14px;
      }

      .node span {
        display: block;
        margin-top: 5px;
        color: var(--soft);
        font-size: 12px;
      }

      .node.one { left: 28px; top: 34px; }
      .node.two { right: 26px; top: 88px; }
      .node.three { left: 42px; bottom: 66px; }
      .node.four { right: 34px; bottom: 34px; }

      .products {
        margin-top: 60px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }

      .card {
        position: relative;
        min-height: 184px;
        padding: 24px;
        border-radius: 26px;
        border: 1px solid var(--line);
        background:
          linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.045)),
          rgba(255,255,255,0.04);
        box-shadow: 0 20px 70px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        text-decoration: none;
        color: inherit;
      }

      .card::after {
        content: "";
        position: absolute;
        width: 220px;
        height: 220px;
        right: -90px;
        top: -110px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(40,240,231,0.22), transparent 68%);
      }

      .card.disabled::after {
        background: radial-gradient(circle, rgba(157,124,255,0.22), transparent 68%);
      }

      .product-icon {
        width: 48px;
        height: 48px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.12);
      }

      .product-icon svg {
        width: 25px;
        height: 25px;
      }

      .card h2 {
        margin: 18px 0 0;
        font-size: 28px;
        line-height: 1.1;
        letter-spacing: 0;
      }

      .card p {
        margin: 10px 0 0;
        color: var(--muted);
        line-height: 1.55;
        font-size: 15px;
        max-width: 460px;
      }

      .card-meta {
        margin-top: 20px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #bffefa;
        font-size: 13px;
        font-weight: 720;
      }

      .disabled .card-meta {
        color: #d6ccff;
      }

      footer {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        color: rgba(235, 241, 255, 0.46);
        font-size: 13px;
      }

      @media (max-width: 880px) {
        .shell {
          width: min(100% - 28px, 680px);
          padding-top: 24px;
        }

        header,
        footer {
          align-items: flex-start;
          flex-direction: column;
        }

        main {
          padding: 54px 0 42px;
        }

        .hero {
          grid-template-columns: 1fr;
          gap: 34px;
        }

        .orbital {
          min-height: 360px;
          order: -1;
        }

        .products {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 520px) {
        .nav-note {
          display: none;
        }

        .orbital {
          min-height: 300px;
          border-radius: 26px;
        }

        .core {
          width: 124px;
          height: 124px;
          border-radius: 34px;
        }

        .node {
          min-width: auto;
          max-width: 148px;
          padding: 11px 12px;
        }

        .node.two,
        .node.four {
          right: 12px;
        }

        .node.one,
        .node.three {
          left: 12px;
        }

        .card {
          min-height: 166px;
          padding: 20px;
        }

        .products {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div class="brand" aria-label="HaoXAgent">
          <div class="mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7 13.5 10.2 17 17.5 7" stroke="#061018" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span>HaoXAgent</span>
        </div>
        <div class="nav-note">AI-native systems for creators and teams</div>
      </header>

      <main>
        <section class="hero" aria-labelledby="welcome-title">
          <div>
            <div class="eyebrow"><span class="pulse"></span> Agent Lab Online</div>
            <h1 id="welcome-title">
              <span class="gradient-text">Welcome to HaoXAgent</span>
            </h1>
            <p class="subtitle">
              我们正在构建面向创作者、运营团队和新一代协作方式的 AI 原生产品矩阵。
              从直播增长，到多智能体协作，让复杂工作变得更轻、更快、更有判断力。
            </p>
            <div class="actions">
              <a class="button" href="https://livepilot.haoxagent.com" rel="noopener">
                进入 LivePilot
                <span aria-hidden="true">→</span>
              </a>
              <a class="button secondary" href="https://coding.torchv.com/" rel="noopener">Nultica <span aria-hidden="true">↗</span></a>
              <a class="button secondary" href="https://ais.prod.torchv.com/" rel="noopener">
                TorchV AIS
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <div class="orbital" aria-hidden="true">
            <div class="core"><span>HX</span></div>
            <div class="node one"><strong>Creator AI</strong><span>内容与增长</span></div>
            <div class="node two"><strong>Agent OS</strong><span>任务与协作</span></div>
            <div class="node three"><strong>Signals</strong><span>数据与洞察</span></div>
            <div class="node four"><strong>Automation</strong><span>流程与执行</span></div>
          </div>
        </section>

        <section class="products" aria-label="HaoXAgent products">
          <a class="card" href="https://livepilot.haoxagent.com" rel="noopener">
            <div class="product-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 11.5c0-3.1 2.5-5.6 5.6-5.6h2.8c3.1 0 5.6 2.5 5.6 5.6v1c0 3.1-2.5 5.6-5.6 5.6h-2.8C7.5 18.1 5 15.6 5 12.5v-1Z" stroke="white" stroke-width="1.8"/>
                <path d="M9 12h.01M12 12h.01M15 12h.01" stroke="#28f0e7" stroke-width="2.6" stroke-linecap="round"/>
                <path d="M12 5.8V3.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </div>
            <h2>LivePilot</h2>
            <p>AI 直播增长助手，帮助主播完成开播准备、截图复盘、问题诊断和下一场行动方案。</p>
            <div class="card-meta">立即进入 <span aria-hidden="true">↗</span></div>
          </a>

          <a class="card" href="https://coding.torchv.com/" rel="noopener">
            <div class="product-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4.8 7.2 12 3l7.2 4.2v8.4L12 20l-7.2-4.4V7.2Z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M8.2 9.2h7.6M8.2 12h7.6M8.2 14.8h4.8" stroke="#9d7cff" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </div>
            <h2>Nultica</h2>
            <p>面向人类与智能体协作的下一代项目空间，连接项目、任务与智能体执行。</p>
            <div class="card-meta">打开 Nultica <span aria-hidden="true">↗</span></div>
          </a>

          <a class="card" href="https://ais.prod.torchv.com/" rel="noopener">
            <div class="product-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 18.5V6.2c0-.9.7-1.6 1.6-1.6h10.8c.9 0 1.6.7 1.6 1.6v12.3" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M4 18.5h16" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M8 9.2h8M8 12h5M8 14.8h7" stroke="#7aa5ff" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </div>
            <h2>TorchV AIS</h2>
            <p>面向企业知识、智能应用与业务协作的 AI 系统入口。</p>
            <div class="card-meta">打开 AIS <span aria-hidden="true">↗</span></div>
          </a>
        </section>
      </main>

      <footer>
        <span>© 2026 HaoXAgent</span>
        <span>Independent AI products. Built for practical work.</span>
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
        "cache-control": "public, max-age=300",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-content-type-options": "nosniff"
      }
    });
  }
};
