# First Mile Coach — Brand Color Guidelines

This document defines the color system for the First Mile Coach platform.
All platform pages (admin, dashboard, login) should use these colors consistently.

---

## Core Brand Palette

| Role | Hex | RGB | When to Use |
|------|-----|-----|-------------|
| **Brand Orange** | `#f26522` | 242, 101, 34 | Primary CTA buttons, active states, selected tabs, links, the brand's signature color |
| **Dark Charcoal** | `#1c1f20` | 28, 31, 32 | Dark mode page background |
| **Card Charcoal** | `#262a2b` | 38, 42, 43 | Dark mode card/panel surfaces |
| **Off-White** | `#fafbfc` | 250, 251, 252 | Light mode page background |
| **White** | `#ffffff` | 255, 255, 255 | Light mode cards, dark mode text |
| **Body Text Dark** | `#2d3436` | 45, 52, 54 | Light mode body text |

---

## Accent / Brand Color Usage

The **only** brand accent color is **Orange `#f26522`**. There is no gold, no purple.

| Usage | Class | Notes |
|-------|-------|-------|
| Primary CTA buttons | `bg-accent hover:bg-orange-700` | Always white text on orange bg |
| Active tab / selection | `text-accent`, `bg-accent/20` | Orange text or light orange tint |
| Links & interactive text | `text-accent` | Clickable/actionable elements |
| Toggle switch (on) | `bg-accent` | Active/enabled toggle state |
| Selected client indicator | `border-l-accent`, `bg-accent/10` | Left border + subtle bg |
| Coach name (sidebar) | `text-gold` → remapped to orange | Shows who's logged in |
| Template/section headings | `text-gold` → remapped to orange | Category labels |
| Focus ring on inputs | `focus:ring-accent`, `focus:border-accent` | Input focus state |

---

## Semantic Colors (Status & Feedback)

These colors communicate meaning regardless of brand. They should NOT be replaced with orange.

### ✅ Success / Positive
| Usage | Dark Mode | Light Mode |
|-------|-----------|------------|
| Published status dot | `bg-green-400` | `bg-green-400` |
| Workout complete circle | `bg-green-500 border-green-500` | Same |
| Publish button | `bg-green-600 hover:bg-green-700` | Same (white text) |
| Success text | `text-green-400` | `#16a34a` |
| Opted-in confirmation | `text-green-600` | Same |

### ⚠️ Warning / Draft / Pending
| Usage | Dark Mode | Light Mode |
|-------|-----------|------------|
| Draft status dot | `bg-yellow-400` | `bg-yellow-400` |
| Current week highlight | `bg-yellow-500/10 border-yellow-500/30` | Same |
| Workout partial circle | `bg-yellow-500 border-yellow-500` | Same |
| Warning text | `text-yellow-400` | `#ca8a04` |
| Archive button | `border-yellow-500/30 text-yellow-400` | Same |

### ❌ Error / Danger / Skipped
| Usage | Dark Mode | Light Mode |
|-------|-----------|------------|
| Workout skipped circle | `bg-red-500 border-red-500` | Same |
| Error banner | `bg-red-500/10 border-red-500/30` | Same |
| Error text | `text-red-400` | `#dc2626` |
| Delete/remove actions | `text-red-400 hover:text-red-300` | Same |
| Bug report toggle | `bg-red-500/20 text-red-400 border-red-500/40` | Same |

---

## Workout Type Colors

These colors differentiate workout types visually. They are functional, not brand-specific.

| Workout Type | Badge Background | Badge Text | Card Border |
|-------------|-----------------|------------|-------------|
| **Run** | `bg-accent/20` | `text-accent` | `border-accent/50` |
| **Cross Training** | `bg-gold/20` | `text-gold` | `border-gold/50` |
| **Rest** | `bg-green-500/20` | `text-green-400` | `border-green-500/50` |
| **Walk** | `bg-blue-500/20` | `text-blue-400` | `border-blue-500/50` |
| **Cycling** | `bg-cyan-500/20` | `text-cyan-400` | `border-cyan-500/50` |
| **Stretching** | `bg-purple-500/20` | `text-purple-400` | `border-purple-500/50` |

> **Note for First Mile:** `gold` and `purple` in these contexts are remapped to orange via CSS overrides. On Crystal Pistol, they remain gold and purple.

---

## Training Type Intensity Colors

| Intensity Level | Colors | Training Types |
|----------------|--------|----------------|
| **High intensity** | Red (`bg-red-500/20 text-red-400`) | Speed (Road/Track), Time Trial, Fartlek |
| **Tempo/Threshold** | Orange (`bg-orange-500/20 text-orange-400`) | Tempo, Threshold |
| **Race-specific** | Green (`bg-green-500/20 text-green-300`) | Race Pace, Close to Race Pace |
| **Intervals** | Cyan (`bg-cyan-500/20 text-cyan-400`) | Intervals (Run/Walk) |
| **Endurance/Easy** | Blue (`bg-blue-500/20 text-blue-400`) | Long Run, Easy, Recovery, Progressive, Trail |
| **Hill work** | Yellow (`bg-yellow-500/20 text-yellow-400`) | Hills |
| **Flexibility** | Purple (`bg-purple-500/20 text-purple-400`) | Stretching, Yoga, Foam Roll |

---

## Gray Scale (Text Hierarchy)

| Role | Dark Mode Class | Light Mode Override | Purpose |
|------|----------------|--------------------| --------|
| Primary text | `text-white` | `#111827` | Headings, names, data values |
| Secondary text | `text-gray-300` | `#374151` | Descriptions, supporting info |
| Muted labels | `text-gray-400` | `#4b5563` | Form labels, section titles |
| Disabled/placeholder | `text-gray-500` | `#6b7280` | Hints, inactive items |
| Very muted | `text-gray-600` | `#4b5563` | Timestamps, metadata |

---

## Surface & Layout Colors

| Element | Dark Mode | Light Mode |
|---------|-----------|------------|
| Page background | `bg-primary` (#1c1f20) | `bg-primary` (#fafbfc) |
| Card/panel | `bg-secondary/50` (#262a2b at 50%) | White with subtle shadow |
| Sidebar background | Same as page | `#f1f5f9` (slightly tinted) |
| Input background | `bg-primary/50` | `#f9fafb` |
| Dividers/borders | `border-white/10` (transparent white) | `#d1d5db` (gray-300) |
| Subtle borders | `border-white/5` | `#e5e7eb` (gray-200) |
| Hover state | `hover:bg-white/5` | `rgba(0,0,0,0.04)` |

---

## Strava Integration
| Element | Color | Purpose |
|---------|-------|---------|
| Strava icon | `text-orange-500` | Strava brand orange |
| Strava badge | `bg-orange-500/20 text-orange-400` | Synced workout indicator |
| Reconnect banner | `bg-orange-500/15 border-orange-500/30` | Attention needed |

---

## Typography

| Font | Variable | Usage |
|------|----------|-------|
| **Oswald** | `font-heading` | Headings, section titles, uppercase labels |
| **Inter** | `font-body` | Body text, descriptions, form content |

---

## Key Principles

1. **Orange is the only brand color** — never use gold or purple for branding on First Mile
2. **Semantic colors are universal** — green=success, red=error, yellow=warning everywhere
3. **Workout type colors are functional** — they help coaches quickly scan training plans
4. **Surface hierarchy** — primary bg → secondary/card bg → input bg (each slightly different)
5. **Text hierarchy** — white/black → gray-300 → gray-400 → gray-500 (each progressively more muted)
6. **Buttons** — orange for primary CTAs, green for "publish", outline for secondary, red for destructive
7. **Dark/Light mode** — both are fully supported; CSS custom properties handle the switch
