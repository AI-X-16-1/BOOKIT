# docs/design-tokens.md

Extracted from the approved mockups (1~6). Do not invent new colors — if you need one that is not here, ask 김민경.

---

## Color

```css
:root {
  /* surface */
  --bg-cream:        #FDF6EC;  /* app background */
  --bg-rule:         #F4E5D1;  /* notebook line */
  --surface-card:    #FFFDF9;
  --surface-sunken:  #F6F0E4;

  /* ink */
  --ink:             #2E241D;
  --ink-soft:        #3C3229;
  --text-muted:      #9A8B7C;
  --text-faint:      #A99A89;
  --text-on-dark:    #FDF6EC;
  --text-on-dark-2:  #B3A494;

  /* dark panel — verification only */
  --panel:           #2B211B;
  --panel-inner:     #3A2D25;
  --panel-line:      #463830;

  /* accent */
  --coral:           #FF6B4A;
  --coral-light:     #FF8F75;
  --coral-bg:        #FFF2EC;
  --coral-bg-2:      #FFE3D9;

  --yellow:          #FFD866;
  --yellow-bg:       #FDF0CD;
  --yellow-text:     #7A6320;
  --yellow-text-2:   #8A7550;

  --green:           #3FA778;
  --green-bg:        #E2F4E9;
  --green-text:      #3F7F5C;

  --blue:            #7CBBE6;
  --blue-bg:         #E6EEFB;
  --blue-text:       #4A6B9C;

  --border:          #ECDFCD;
  --border-soft:     #F0E4D3;
}
```

**Color roles.** Coral = primary action and "your sentence" highlight. Yellow = 책갈피, streak, writing helper, 완독 stamp. Green = free library access, pass state. Blue = new genre, informational counts. Never use green for a primary button — it reads as "free access" in this app.

## Notebook background

Login and result screens only.

```css
background-color: #FDF6EC;
background-image: repeating-linear-gradient(#FDF6EC 0 31px, #F4E5D1 31px 32px);
```

## Typography

`Noto Sans KR`, weights 400 / 500 / 700 / 900.

| Role | Size / weight |
|---|---|
| Screen title | 26px / 700, line-height 1.3 |
| Section heading | 17px / 700 |
| Body | 15-17px / 400 |
| Reader body | 18px / 400, line-height 2 |
| Caption | 13-14px / 400, `--text-muted` |
| Chip | 11-12px / 400 |
| Number highlight (points) | 26-28px / 700 |

## Shape

| Element | Radius |
|---|---|
| Card | 14-16px |
| Button | 14px |
| Input | 12-14px |
| Chip / badge | 999px |
| Bottom sheet | 26px top corners |
| Phone frame (mockup only) | 38px |

Card shadow: `0 12px 34px rgba(90,66,40,.10)`.

## Spacing & sizing

Screen padding 22px. Card padding 16-20px. Gap between cards 12-14px.
Buttons 48px minimum height (`padding: 19px`, centered, 17px/700).
Bottom tab bar 86px tall including safe area.

## Layout

Base width 430px. Breakpoint 768px.

- `< 768px` — bottom tab bar: 홈 / 독후감 / 챌린지 / 나 / 서재. Write and AI panel are two sequential steps. Dictionary is a bottom sheet.
- `>= 768px` — left icon rail replaces tabs. Write and AI panel sit side by side. Dictionary is a right side panel.
- `>= 1024px` — teacher dashboard. No mobile layout for it.

## Icons

The mockups use text glyphs (⌂ ✎ ◈ ☺ ▤ ⌕ ✕ ★ ✓ →). Replace with a real icon set at build time, keeping the same shapes. Emoji stay only where they carry meaning in copy: 🔥 streak, 🔖 책갈피, 🌱🌿 책나무, 🍪 간식, 👥 반, 🎉 파티, 🍂 season.

## Voice

Korean, 반말, warm, short. Points are always **책갈피**. Failure copy offers a next step ("조금만 더!", "다시 답해볼까?") and never scolds.
