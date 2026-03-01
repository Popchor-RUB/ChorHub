# Design: 3-State Theme Toggle

**Date:** 2026-03-01

## Summary

Update `ThemeToggle.tsx` to expose all three theme states (system, light, dark) via a cycling icon button. The store and hook already support all three states; only the UI component needs updating.

## Current State

- `themeStore.ts`: Zustand store with `ThemePreference = 'system' | 'light' | 'dark'`, persisted to `localStorage` under `chorhub-theme`. Default is `'system'`.
- `useTheme.ts`: Applies the theme to `document.documentElement` and listens to OS preference changes when in `system` mode. Fully handles all 3 states.
- `ThemeToggle.tsx`: Currently a single icon button that only toggles between `light` and `dark`, ignoring `system` as a selectable option.

## Design

### Component: `ThemeToggle.tsx`

A single `isIconOnly` HeroUI `Button` (same as today). Each click cycles through states in order:

```
system → light → dark → system → ...
```

The icon reflects the **current** state:

| State | Icon |
|-------|------|
| `system` | Sun (top-left) + `\` diagonal divider + moon (bottom-right), in a single inline SVG |
| `light` | Sun (existing) |
| `dark` | Moon (existing) |

The `aria-label` updates to describe the current mode in German (matching existing labels):
- `system` → `"Automatischer Modus (System)"`
- `light` → `"Heller Modus"`
- `dark` → `"Dunkler Modus"`

### No other changes needed

- `themeStore.ts` — unchanged
- `useTheme.ts` — unchanged
- `MemberLayout.tsx` / `AdminLayout.tsx` — unchanged (import is the same)

## Files Changed

- `frontend/src/components/ThemeToggle.tsx` — replace toggle logic and add `AutoIcon`
