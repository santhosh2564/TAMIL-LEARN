# Content & Asset Architecture

This document outlines the architecture for handling educational assets (images, audio) safely and consistently.

## Overview

The platform explicitly separates *educational content definitions* (`activities.json`) from *media resolution* (`AssetResolver` + `assets.json`). This ensures UI components never hard-code file paths or directly try to parse media formats.

## Asset Model

Assets are referenced structurally within activities and resolved via `AssetResolver`:

```typescript
type AssetType = 'image' | 'audio';

interface AssetReference {
  id: string; // e.g., class3-tamil-picture-q001
  type: AssetType;
}

interface ResolvedAsset {
  id: string;
  type: AssetType;
  source: 'local' | 'remote';
  path: string;
  alt?: string; // Accessible string matching educational intent
}
```

## Directory Structure

Media is stored using the same standard organizational taxonomy as content:

```text
src/
  content/
    class-3/
      tamil/
        term-1/
          activities.json    # The logic/prompts
          assets.json        # The asset manifest mappings
```

## The Asset Manifest (`assets.json`)

The manifest acts as a lookup dictionary preventing random or brute-force filesystem access:
```json
{
  "class3-tamil-picture-q001": {
    "type": "image",
    "source": "local",
    "path": "/assets/images/class3-tamil-q001.webp",
    "alt": "முயல்"
  }
}
```

## UI and `ActivityAsset`

The `ActivityAsset` component is responsible for asking the `AssetResolver` to map an `AssetReference` to a path. It handles explicit resolution states securely:
- `resolved`: The image/audio is rendered normally.
- `missing`: The UI renders a child-friendly placeholder ("Picture unavailable").
- `invalid`: The UI flags that the asset reference is corrupted or unsafe, preventing application crashes.

## Validation (`npm run content:assets-check`)
The validation script guarantees that:
- Every activity requiring an asset requests one securely.
- Missing assets are accurately reported (without failing CI, since missing media is an authoring gap, not a code defect).
- Invalid configurations (like insecure paths or traversal attempts) fail the build.
- Orphan assets (declared in `assets.json` but not used by any logic) are identified.

## Picture Recognition Assets (Phase 12B)

In Phase 12B, the 21 Picture Recognition activities were mapped directly to existing pre-curated project assets located in `images/` and `images/SET1/`. No images were generated, downloaded from external sources, or replaced with dummy placeholders.

The WebP versions from `images/SET1/` were deployed into the public directory at `public/assets/class-3/tamil/term-1/images/` and referenced cleanly via `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q{xyz}.webp`.

### Asset Resolution Mapping

| Activity | Asset ID | Target Word | Concept | Existing Source File | Source Folder | Public Runtime Path | Status |
|---|---|---|---|---|---|---|---|
| Q001 | `class3-tamil-picture-q001` | முயல் | Rabbit | `rabbit.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q001.webp` | Resolved |
| Q003 | `class3-tamil-picture-q003` | பழம் | Fruit | `fruit.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q003.webp` | Resolved |
| Q005 | `class3-tamil-picture-q005` | நாய் | Dog | `dog.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q005.webp` | Resolved |
| Q009 | `class3-tamil-picture-q009` | கடல் | Sea | `sea.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q009.webp` | Resolved |
| Q014 | `class3-tamil-picture-q014` | வண்ணங்கள் | Colours | `colours.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q014.webp` | Resolved |
| Q026 | `class3-tamil-picture-q026` | குரங்கு | Monkey | `monkey.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q026.webp` | Resolved |
| Q034 | `class3-tamil-picture-q034` | கடை | Shop | `shop.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q034.webp` | Resolved |
| Q038 | `class3-tamil-picture-q038` | கல் | Stone | `stone.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q038.webp` | Resolved |
| Q043 | `class3-tamil-picture-q043` | காசு | Coin | `coin.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q043.webp` | Resolved |
| Q055 | `class3-tamil-picture-q055` | செடி | Plant | `plant.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q055.webp` | Resolved |
| Q066 | `class3-tamil-picture-q066` | தாத்தா | Grandfather | `grandfather.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q066.webp` | Resolved |
| Q071 | `class3-tamil-picture-q071` | தெரு | Street | `street.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q071.webp` | Resolved |
| Q079 | `class3-tamil-picture-q079` | நிலா | Moon | `moon.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q079.webp` | Resolved |
| Q091 | `class3-tamil-picture-q091` | பம்பரம் | Spinning top | `spinning-top.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q091.webp` | Resolved |
| Q101 | `class3-tamil-picture-q101` | பெட்டி | Box | `box.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q101.webp` | Resolved |
| Q104 | `class3-tamil-picture-q104` | பை | Bag | `bag.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q104.webp` | Resolved |
| Q123 | `class3-tamil-picture-q123` | ராஜா | King | `king.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q123.webp` | Resolved |
| Q128 | `class3-tamil-picture-q128` | வயல் | Paddy field | `field.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q128.webp` | Resolved |
| Q133 | `class3-tamil-picture-q133` | வழி | Road/Path | `path.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q133.webp` | Resolved |
| Q138 | `class3-tamil-picture-q138` | விலங்கு | Animal | `animals.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q138.webp` | Resolved |
| Q140 | `class3-tamil-picture-q140` | வீடு | House | `house.webp` | `images/SET1` | `/assets/class-3/tamil/term-1/images/class3-tamil-picture-q140.webp` | Resolved |

### Source & Licensing Metadata
- Source: Pixabay (original curated repository assets documented in `images/image_manifest.csv`)
- Format: WebP (`images/SET1`) and JPEG (`images/`)
- Total Required: 21
- Total Resolved: 21
- Missing: 0
- Invalid: 0
- Orphan: 0

## Future Audio Support
The model fully supports `{ type: 'audio' }` references. Future work on TTS or pronunciation files will slot cleanly into the same `assets.json` lookup mechanism without re-architecting the base resolution.

