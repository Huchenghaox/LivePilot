const siteUrl = "https://haoxagent.com";

const html = String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HaoXAgent - AI 产品与智能体工作室</title>
    <meta
      name="description"
      content="HaoXAgent 连接 AI 产品、工具、资讯与真实业务场景，帮助你更快发现、理解和使用 AI。"
    />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="https://haoxagent.com/" />
    <meta property="og:title" content="HaoXAgent - AI 产品与智能体工作室" />
    <meta
      property="og:description"
      content="专注真实场景，构建可落地的 AI 产品。"
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://haoxagent.com" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#f7f9ff" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "HaoXAgent",
        "url": "https://haoxagent.com/",
        "description": "HaoXAgent builds focused AI products and agent systems for real workflows.",
        "sameAs": [
          "https://livepilot.haoxagent.com",
          "https://coding.torchv.com/",
          "https://ais.prod.torchv.com/"
        ]
      }
    </script>
    <style>
      :root {
        color-scheme: light;
        --ink: #07122f;
        --ink-soft: #35405d;
        --muted: #69748d;
        --faint: #8b95ab;
        --surface: rgba(255, 255, 255, 0.78);
        --surface-strong: rgba(255, 255, 255, 0.92);
        --line: rgba(61, 82, 145, 0.14);
        --blue: #1769ff;
        --cyan: #27c8ff;
        --violet: #7a4cff;
        --pink: #e57dff;
        --radius-xl: 34px;
        --radius-lg: 26px;
        --radius-md: 18px;
        --gradient: linear-gradient(135deg, var(--blue), var(--cyan) 45%, var(--violet) 76%, var(--pink));
        --shadow: 0 26px 90px rgba(48, 67, 141, 0.16);
        --shadow-soft: 0 18px 56px rgba(48, 67, 141, 0.12);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        background:
          radial-gradient(circle at 74% 18%, rgba(122, 76, 255, 0.2), transparent 34%),
          radial-gradient(circle at 18% 16%, rgba(39, 200, 255, 0.16), transparent 30%),
          linear-gradient(180deg, #fbfdff 0%, #f4f7ff 48%, #ffffff 100%);
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      .page {
        position: relative;
        overflow: hidden;
        min-height: 100vh;
      }

      .page::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(63, 78, 132, 0.055) 1px, transparent 1px),
          linear-gradient(90deg, rgba(63, 78, 132, 0.055) 1px, transparent 1px);
        background-size: 72px 72px;
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.7), transparent 68%);
      }

      .shell {
        position: relative;
        z-index: 1;
        width: min(1180px, calc(100% - 40px));
        margin: 0 auto;
      }

      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 22px;
        padding: 24px 0 12px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: max-content;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 16px;
        color: white;
        font-weight: 900;
        letter-spacing: -0.06em;
        background: var(--gradient);
        box-shadow: 0 16px 36px rgba(88, 105, 255, 0.28);
      }

      .brand-name {
        margin: 0;
        font-size: 18px;
        font-weight: 860;
        letter-spacing: -0.04em;
        line-height: 1;
      }

      .brand-name .x,
      .hero-title .x {
        background: var(--gradient);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .brand-subtitle {
        margin-top: 5px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 650;
      }

      .nav-links {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.62);
        box-shadow: 0 10px 32px rgba(64, 86, 150, 0.08);
        backdrop-filter: blur(18px);
      }

      .nav-links a {
        padding: 10px 15px;
        border-radius: 999px;
        color: var(--ink-soft);
        font-size: 13px;
        font-weight: 760;
        transition: background 160ms ease, color 160ms ease;
      }

      .nav-links a:hover {
        color: var(--ink);
        background: rgba(23, 105, 255, 0.08);
      }

      .nav-cta,
      .primary-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        border: 0;
        color: white;
        font-weight: 820;
        background: var(--gradient);
        box-shadow: 0 18px 42px rgba(91, 98, 255, 0.24);
        transition: transform 180ms ease, box-shadow 180ms ease;
      }

      .nav-cta {
        min-width: 120px;
        padding: 13px 18px;
        border-radius: 999px;
        font-size: 13px;
      }

      .nav-cta:hover,
      .primary-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 22px 52px rgba(91, 98, 255, 0.3);
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.12fr) minmax(340px, 0.88fr);
        gap: 42px;
        align-items: center;
        min-height: 590px;
        padding: 56px 0 48px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        width: fit-content;
        margin-bottom: 22px;
        padding: 9px 13px;
        border: 1px solid rgba(39, 200, 255, 0.28);
        border-radius: 999px;
        color: #2456dd;
        background: rgba(255, 255, 255, 0.72);
        box-shadow: 0 12px 30px rgba(62, 85, 150, 0.1);
        font-size: 13px;
        font-weight: 800;
      }

      .eyebrow::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--gradient);
        box-shadow: 0 0 18px rgba(39, 200, 255, 0.9);
      }

      .hero-title {
        max-width: 780px;
        margin: 0;
        font-size: clamp(48px, 6.4vw, 86px);
        line-height: 1.02;
        letter-spacing: -0.065em;
        font-weight: 930;
        word-break: keep-all;
      }

      .hero-copy {
        max-width: 640px;
        margin: 24px 0 0;
        color: var(--ink-soft);
        font-size: clamp(17px, 2.2vw, 22px);
        line-height: 1.72;
        font-weight: 580;
      }

      .hero-copy small {
        display: block;
        margin-top: 8px;
        color: var(--faint);
        font-size: 15px;
        letter-spacing: 0.01em;
      }

      .search-card {
        display: flex;
        align-items: center;
        gap: 14px;
        width: min(620px, 100%);
        margin-top: 30px;
        padding: 14px 16px;
        border: 1px solid rgba(63, 82, 150, 0.13);
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.78);
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(18px);
      }

      .search-icon {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(23, 105, 255, 0.12), rgba(122, 76, 255, 0.12));
        color: #3e5cff;
      }

      .search-text {
        flex: 1;
        color: var(--faint);
        font-size: 15px;
        font-weight: 650;
      }

      .primary-button {
        padding: 14px 18px;
        border-radius: 17px;
        white-space: nowrap;
      }

      .visual-stage {
        position: relative;
        min-height: 480px;
        display: grid;
        place-items: center;
      }

      .visual-card {
        position: relative;
        width: min(480px, 100%);
        aspect-ratio: 1;
        border: 1px solid rgba(58, 78, 150, 0.13);
        border-radius: 46px;
        background:
          radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.48) 50%, rgba(238, 244, 255, 0.34)),
          linear-gradient(145deg, rgba(255, 255, 255, 0.88), rgba(245, 248, 255, 0.62));
        box-shadow: var(--shadow);
        overflow: hidden;
        backdrop-filter: blur(24px);
      }

      .visual-card::before,
      .visual-card::after {
        content: "";
        position: absolute;
        inset: 11%;
        border: 1px solid rgba(38, 99, 255, 0.13);
        border-radius: 50%;
        transform: rotate(-18deg) scaleX(1.22);
      }

      .visual-card::after {
        inset: 19%;
        border-color: rgba(122, 76, 255, 0.14);
        transform: rotate(31deg) scaleX(1.28);
      }

      .x-core {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        filter: drop-shadow(0 34px 55px rgba(87, 93, 255, 0.3));
      }

      .x-core span {
        position: absolute;
        width: 80%;
        height: 23%;
        border-radius: 999px;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.05) 18%, rgba(255, 255, 255, 0.22) 72%, rgba(255, 255, 255, 0.76)),
          var(--gradient);
      }

      .x-core span:first-child {
        transform: rotate(42deg);
      }

      .x-core span:last-child {
        transform: rotate(-42deg);
      }

      .star-core {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 86px;
        height: 86px;
        border-radius: 30px;
        transform: translate(-50%, -50%) rotate(45deg);
        background: rgba(255, 255, 255, 0.82);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.92),
          0 0 52px rgba(74, 163, 255, 0.42);
      }

      .visual-label {
        position: absolute;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        gap: 9px;
        padding: 11px 14px;
        border: 1px solid rgba(38, 99, 255, 0.15);
        border-radius: 999px;
        color: #233052;
        background: rgba(255, 255, 255, 0.76);
        box-shadow: 0 16px 42px rgba(62, 82, 150, 0.13);
        backdrop-filter: blur(16px);
        font-size: 13px;
        font-weight: 800;
      }

      .visual-label::before {
        content: "";
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--gradient);
      }

      .label-one {
        left: 9%;
        top: 18%;
      }

      .label-two {
        right: 9%;
        top: 27%;
      }

      .label-three {
        left: 13%;
        bottom: 20%;
      }

      .label-four {
        right: 13%;
        bottom: 15%;
      }

      .section-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 24px;
        margin: 8px 0 24px;
      }

      .section-kicker {
        margin: 0 0 8px;
        color: #2456dd;
        font-size: 13px;
        font-weight: 860;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .section-title {
        margin: 0;
        font-size: clamp(30px, 4vw, 48px);
        line-height: 1.05;
        letter-spacing: -0.055em;
        font-weight: 910;
      }

      .section-note {
        max-width: 420px;
        color: var(--muted);
        line-height: 1.75;
        font-size: 15px;
        font-weight: 560;
      }

      .products {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
        padding-bottom: 36px;
      }

      .product-card {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 440px;
        padding: 26px;
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.68)),
          radial-gradient(circle at 18% 0%, rgba(39, 200, 255, 0.12), transparent 34%);
        box-shadow: 0 20px 70px rgba(58, 77, 145, 0.1);
        overflow: hidden;
        transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
      }

      .product-card:hover {
        transform: translateY(-6px);
        border-color: rgba(82, 104, 255, 0.26);
        box-shadow: 0 28px 90px rgba(58, 77, 145, 0.16);
      }

      .product-card::after {
        content: "";
        position: absolute;
        right: -70px;
        top: -80px;
        width: 190px;
        height: 190px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(122, 76, 255, 0.17), transparent 66%);
      }

      .product-top {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 22px;
      }

      .product-logo {
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        border-radius: 20px;
        color: white;
        background: var(--gradient);
        box-shadow: 0 16px 38px rgba(78, 99, 255, 0.22);
        font-weight: 900;
      }

      .product-logo.torchv {
        background: linear-gradient(135deg, #121a35, #1769ff 52%, #7a4cff);
      }

      .product-logo.nultica {
        color: #1e2650;
        background: linear-gradient(135deg, #ffffff, #dbe7ff 46%, #d7c5ff);
      }

      .product-logo.livepilot {
        color: #081232;
        background: linear-gradient(135deg, #dffffa, #7ed7ff 42%, #c3b3ff);
      }

      .play-dot {
        display: inline-block;
        width: 0;
        height: 0;
        margin-left: 4px;
        border-top: 7px solid transparent;
        border-bottom: 7px solid transparent;
        border-left: 11px solid currentColor;
      }

      .product-name {
        margin: 0;
        color: var(--ink);
        font-size: 23px;
        line-height: 1.08;
        letter-spacing: -0.045em;
        font-weight: 910;
      }

      .product-subtitle {
        margin-top: 5px;
        color: #5360d9;
        font-size: 13px;
        font-weight: 800;
      }

      .product-copy {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 12px;
        margin: 0;
        color: var(--ink-soft);
        font-size: 15px;
        line-height: 1.78;
        font-weight: 540;
      }

      .tags {
        position: relative;
        z-index: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: auto;
        padding-top: 24px;
      }

      .tag {
        padding: 8px 10px;
        border: 1px solid rgba(48, 67, 141, 0.11);
        border-radius: 999px;
        color: #47536d;
        background: rgba(255, 255, 255, 0.7);
        font-size: 12px;
        font-weight: 760;
      }

      .card-link {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        margin-top: 22px;
        padding: 15px 16px;
        border-radius: 18px;
        color: white;
        background: var(--gradient);
        font-size: 14px;
        font-weight: 850;
        box-shadow: 0 18px 38px rgba(75, 95, 255, 0.22);
      }

      .quick-links {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        padding: 8px 0 70px;
      }

      .quick-link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 88px;
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 24px;
        color: var(--ink-soft);
        background: rgba(255, 255, 255, 0.7);
        box-shadow: 0 14px 44px rgba(58, 77, 145, 0.08);
        font-weight: 820;
      }

      .quick-link span {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 14px;
        color: white;
        background: var(--gradient);
      }

      .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 26px 0 34px;
        border-top: 1px solid rgba(48, 67, 141, 0.1);
        color: var(--faint);
        font-size: 13px;
        line-height: 1.6;
      }

      .footer strong {
        color: var(--ink-soft);
      }

      @media (max-width: 980px) {
        .nav {
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .nav-links {
          order: 3;
          width: 100%;
          justify-content: space-between;
        }

        .hero {
          grid-template-columns: 1fr;
          gap: 26px;
          min-height: auto;
          padding-top: 48px;
        }

        .visual-stage {
          min-height: 440px;
        }

        .products {
          grid-template-columns: 1fr;
        }

        .product-card {
          min-height: auto;
        }

        .quick-links {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 620px) {
        .shell {
          width: min(100% - 28px, 1180px);
        }

        .nav {
          padding-top: 18px;
        }

        .brand-subtitle,
        .nav-cta {
          display: none;
        }

        .nav-links a {
          padding: 9px 10px;
          font-size: 12px;
        }

        .hero {
          padding: 38px 0 42px;
        }

        .hero-title {
          font-size: clamp(42px, 13vw, 62px);
          line-height: 1.04;
        }

        .hero-copy {
          font-size: 16px;
        }

        .search-card {
          align-items: stretch;
          flex-direction: column;
          border-radius: 24px;
        }

        .search-text {
          padding: 0 2px;
        }

        .primary-button {
          width: 100%;
        }

        .visual-stage {
          min-height: 340px;
        }

        .visual-card {
          border-radius: 32px;
        }

        .visual-label {
          padding: 9px 11px;
          font-size: 11px;
        }

        .section-head {
          display: block;
        }

        .section-note {
          margin-top: 12px;
        }

        .product-card {
          padding: 22px;
          border-radius: 24px;
        }

        .quick-links {
          grid-template-columns: 1fr;
        }

        .footer {
          display: block;
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
    <main class="page">
      <nav class="shell nav" aria-label="Primary">
        <a class="brand" href="#top" aria-label="HaoXAgent home">
          <span class="brand-mark">HX</span>
          <span>
            <strong class="brand-name">Hao<span class="x">X</span>Agent</strong>
            <span class="brand-subtitle">AI 产品与智能体工作室</span>
          </span>
        </a>
        <div class="nav-links" aria-label="Sections">
          <a href="#products">Products</a>
          <a href="#agents">Agents</a>
          <a href="#about">About</a>
        </div>
        <a class="nav-cta" href="#products">Explore AI</a>
      </nav>

      <section id="top" class="shell hero">
        <div>
          <div class="eyebrow">AI Product Studio</div>
          <h1 class="hero-title">
            探索 AI 产品、Agent<br />
            与前沿信息
          </h1>
          <p class="hero-copy">
            Hao<span class="x">X</span>Agent 连接 AI 产品、工具、资讯与真实业务场景，帮助你更快发现、理解和使用 AI。
            <small>AI Product Studio for focused intelligence.</small>
          </p>
          <div class="search-card" role="search" aria-label="Search preview">
            <span class="search-icon" aria-hidden="true">⌕</span>
            <span class="search-text">搜索 AI 产品、Agent、工具、资讯……</span>
            <a class="primary-button" href="#products">查看产品矩阵 →</a>
          </div>
        </div>

        <div class="visual-stage" aria-label="HaoXAgent X visual">
          <div class="visual-card">
            <div class="x-core" aria-hidden="true">
              <span></span>
              <span></span>
            </div>
            <span class="star-core" aria-hidden="true"></span>
            <span class="visual-label label-one">AI 智能体</span>
            <span class="visual-label label-two">产品矩阵</span>
            <span class="visual-label label-three">前沿资讯</span>
            <span class="visual-label label-four">工具导航</span>
          </div>
        </div>
      </section>

      <section id="products" class="shell" aria-labelledby="products-title">
        <div class="section-head">
          <div>
            <p class="section-kicker">Products</p>
            <h2 id="products-title" class="section-title">真实场景里的 AI 产品</h2>
          </div>
          <p class="section-note">
            三个方向保持清晰分工：企业知识系统、多智能体工作流，以及直播增长副驾。
          </p>
        </div>

        <div class="products">
          <article class="product-card" id="agents">
            <div class="product-top">
              <div class="product-logo torchv" aria-hidden="true">TV</div>
              <div>
                <h3 class="product-name">TorchV AIS</h3>
                <div class="product-subtitle">Enterprise AI Knowledge Engine</div>
              </div>
            </div>
            <p class="product-copy">
              <span>TorchV AIS 是面向企业真实业务场景的 AI 知识引擎平台，通过知识加工、知识治理、权限安全和 Agent 工作区，帮助企业把分散的制度、流程、文档、案例与专家经验，转化为可检索、可追溯、可复用、可执行的 AI 生产力。</span>
              <span>产品原型自 2019 年启动研发，基于 Java 构建，具备企业级稳定性、高性能运行能力与复杂业务场景落地能力。</span>
            </p>
            <div class="tags">
              <span class="tag">Enterprise AI</span>
              <span class="tag">Knowledge Engine</span>
              <span class="tag">Agent Workspace</span>
            </div>
            <a class="card-link" href="https://ais.prod.torchv.com/" rel="noopener">Explore TorchV AIS <span>→</span></a>
          </article>

          <article class="product-card">
            <div class="product-top">
              <div class="product-logo nultica" aria-hidden="true">NX</div>
              <div>
                <h3 class="product-name">Nultica</h3>
                <div class="product-subtitle">Multi-Agent Workflow OS</div>
              </div>
            </div>
            <p class="product-copy">
              <span>Nultica 是新一代多智能体协作平台，帮助团队快速构建、编排和管理 AI 员工与自动化工作流。</span>
              <span>通过多 Agent 协同、任务拆解、知识调用与流程连接，让 AI 从单点工具升级为组织级生产力。</span>
            </p>
            <div class="tags">
              <span class="tag">Multi-Agent</span>
              <span class="tag">Workflow OS</span>
              <span class="tag">AI Workforce</span>
            </div>
            <a class="card-link" href="https://coding.torchv.com/" rel="noopener">Open Nultica <span>→</span></a>
          </article>

          <article class="product-card">
            <div class="product-top">
              <div class="product-logo livepilot" aria-hidden="true">LP<span class="play-dot"></span></div>
              <div>
                <h3 class="product-name">LivePilot</h3>
                <div class="product-subtitle">AI Live Copilot</div>
              </div>
            </div>
            <p class="product-copy">
              <span>LivePilot 是面向内容创作者与直播团队的 AI 直播增长副驾，通过直播截图解析、数据复盘、开播策略生成、话术优化与问题诊断，帮助主播提升直播效率、优化转化结果。</span>
              <span>它能基于历史复盘与运营经验生成更具针对性的开播建议，让每一场直播都成为可分析、可优化、可复制的增长资产。</span>
            </p>
            <div class="tags">
              <span class="tag">AI Live Copilot</span>
              <span class="tag">Replay Intelligence</span>
              <span class="tag">Growth Engine</span>
            </div>
            <a class="card-link" href="https://livepilot.haoxagent.com/" rel="noopener">Enter LivePilot <span>→</span></a>
          </article>
        </div>
      </section>

      <section class="shell quick-links" aria-label="Future entries">
        <a class="quick-link" href="#agents">Agent Lab <span>↗</span></a>
        <a class="quick-link" href="#products">AI Tools <span>↗</span></a>
        <a class="quick-link" href="#about">AI News <span>↗</span></a>
        <a class="quick-link" href="mailto:hello@haoxagent.com">Cooperation <span>↗</span></a>
      </section>

      <footer id="about" class="shell footer">
        <div><strong>HaoXAgent</strong> builds focused AI products for real workflows.</div>
        <div>© 2026 HaoXAgent. Independent AI product studio.</div>
      </footer>
    </main>
  </body>
</html>`;

const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

function textResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=300",
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "haoxagent-home" });
    }

    if (url.pathname === "/robots.txt") {
      return textResponse(robots, "text/plain; charset=utf-8");
    }

    if (url.pathname === "/sitemap.xml") {
      return textResponse(sitemap, "application/xml; charset=utf-8");
    }

    return textResponse(html, "text/html; charset=utf-8");
  },
};
