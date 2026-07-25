# LivePilot Design System

LivePilot should feel like a modern creator tool for live-stream work: dark, focused, fast, and professional. It can carry a live-streaming atmosphere, but it must remain an independent brand.

LivePilot is an independent product and is not affiliated with Douyin or ByteDance. Do not use Douyin logos, proprietary icons, official screenshots, or layouts that make the product look official.

## Visual Positioning

- Dark first.
- Creator-focused.
- Content and action first.
- Mobile-friendly.
- Professional enough for operators and teams.
- Not an ERP, CRM, or traditional admin console.

## Color

- Page background: deep charcoal / black-blue.
- Primary card: slightly lighter than page background.
- Secondary area: subtle raised contrast.
- Primary accent: cyan-blue for AI, live signal, and current step.
- Secondary accent: restrained coral-red for risk and important warnings.
- Success: green.
- Warning: amber.
- Error/risk: red or coral.
- Mock/simulation: purple or amber, always clearly labeled.

Do not flood the whole page with gradients. Use gradients only for primary actions, current states, and key AI states.

## Typography

- Page title: clear, compact, no oversized marketing hero inside tools.
- Body text: at least 14px.
- Direct scripts and action tasks: prefer 15-16px.
- Avoid negative letter spacing.

## Spacing and Shape

- Page max width should stay consistent across product pages.
- Large cards: 16-20px radius.
- Small cards: 12-16px radius.
- Inputs and buttons: 10-12px radius.
- Use subtle borders and shadows in dark mode; avoid heavy outer glow.

## Buttons

- Primary button: cyan-blue brand gradient, one main action per page where possible.
- Secondary button: dark fill or subtle outline.
- Dangerous button: red outline with confirmation.
- Disabled button: visibly disabled, not just slightly transparent.

## Forms

- Labels must be visible.
- Inputs must have clear dark backgrounds and borders.
- Advanced settings stay collapsed by default.
- Field errors appear near the field in plain Chinese.
- Mobile forms should be single-column and touch-friendly.

## Cards

Cards should describe tasks, plans, reports, streamers, platform accounts, or status. Avoid cards inside cards unless it is a true repeated item or modal.

## Status Badges

Use consistent badges:

- 已完成 / 可用: green.
- 处理中 / AI分析: cyan.
- 注意 / 待配置: amber.
- 风险 / 失败: coral-red.
- 后续开放 / 未配置: muted gray.

Status must include text, not color alone.

## Navigation

Desktop can use a light side rail or compact shell. Mobile bottom navigation should keep at most five items:

- 首页
- 准备
- 复盘
- 主播
- 我的

Technical settings such as model configuration should live under 我的 / AI能力.

## Empty, Loading, and Error States

Empty states must explain:

- why the page is empty;
- what to do next;
- one clear primary action.

Loading states should describe the work, for example “正在整理直播数据”, not just spin.

Errors should say what happened and what the user can do. Do not show Python exceptions, SQL, provider raw errors, JSON, or stack traces.

## Report Pages

Report first screen must show:

- one-sentence conclusion;
- biggest strength;
- biggest problem;
- next three actions.

Professional analysis should appear after the first screen and can be collapsed.

## Accessibility

- Inputs need labels.
- Icon-only buttons need `aria-label`.
- Focus state must be visible.
- Do not rely on color alone.
- Dialogs must be usable on mobile and keyboard.
- Respect reduced motion where practical.

