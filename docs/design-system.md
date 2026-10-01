# Design System

The platform uses a custom design system tailored for children (ages 5–11).

## Principles

1. **Large Touch Targets:** Minimum 44px for interactable elements.
2. **Clear Typography:** Large display fonts for headings, and highly legible sans-serif for body. Supports "Noto Sans Tamil" out of the box.
3. **Friendly Aesthetics:** Vibrant primary colors, rounded corners (e.g., `rounded-3xl` cards), and soft shadows.
4. **Accessible:** Visible focus rings (`focus-visible`), appropriate color contrast, and descriptive button labels over emoji-only buttons.
5. **Reduced Motion:** Adheres to `prefers-reduced-motion` to disable bouncy scaling or sliding for users who require it.

## Color Tokens

Defined in `tailwind.config.js`:
- `primary-500`: The main vibrant green for actions.
- `secondary-500`: Bright blue for alternative accents.
- `accent-500`: Warm yellow/orange for highlights and category icons.
- `text`: High contrast dark slate for readability.

## Typography

- Display Font: `Outfit` / `Noto Sans Tamil`
- Sans Font: `Inter` / `Noto Sans Tamil`

## Components

Located in `src/components/ui/` and `src/components/domain/`.
- **Button:** Comes in `primary`, `secondary`, and `icon` variants. Handles touch sizes.
- **Card:** Rounded, visually distinct containers. Interactive variant has a subtle hover lift.
- **Page / Header:** Layout wrappers that give the learning shell a consistent top-nav with back buttons.
- **Domain Cards:** `ClassCard`, `SubjectCard`, `CategoryCard` provide ready-to-use semantic blocks that parse domain data.
