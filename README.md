# Brandwise — Multi-Layout AI Image Generation Workspace

A conversational creative operating system for generating and comparing **20 professional layout systems** in a single pass.

## Features

- **Three-panel workspace**: Collapsible sidebar, ChatGPT-style conversation center, 4×5 layout matrix on the right
- **20 layout systems**: Single Hero, Split Screen, Z/F Pattern, Editorial, UI Showcase, Collage, and more
- **Reference image intelligence**: Drag/drop, paste, multi-upload with role assignment and influence weighting
- **Brandwise + design.md**: Brand DNA parsing, token extraction, and automatic prompt augmentation
- **Design DNA panel**: Typography, color, composition, and motion token visualization
- **Expanded layout view**: Full-screen detail with rationale, psychology, and influence breakdown
- **Progressive generation**: Streaming layout cards with skeleton previews

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Framer Motion
- Zustand
- Radix UI primitives

## Getting Started

```bash
npm install
cp .env.example .env
# Paste your OpenRouter API key into .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### OpenRouter setup

1. Create an API key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Copy `.env.example` → `.env` and set:

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image
```

3. Restart the dev server after saving `.env`

Images are generated via OpenRouter's `/api/v1/chat/completions` with `modalities: ["image", "text"]`. Each of the 20 layouts triggers one API call (4 run in parallel by default).

**Cost note:** 20 images = 20 API calls. Start with fewer layouts selected to test.

## Project Structure

```
src/
├── app/                 # Next.js app shell
├── components/
│   ├── ui/              # Shared UI primitives
│   └── workspace/       # Workspace panels & composer
├── lib/
│   ├── layout-systems.ts
│   ├── design-md-parser.ts
│   ├── generation-engine.ts
│   └── constants.ts
├── store/
│   └── workspace-store.ts
└── types/
```

## Next Steps

- Add Supabase for conversations, generations, and Brandwise folders
- Optional: switch `OPENROUTER_IMAGE_MODEL` to `black-forest-labs/flux.2-pro` or other [image models](https://openrouter.ai/models?output_modalities=image)
- Implement real image rendering pipeline per layout type
- Add GitHub design.md import and Figma token sync

## Brandwise Folder System

Creative assets organize under:

`Brand → Campaign → Layout Type → Platform → Aspect Ratio → Version`

See the product specification for full Brandwise hierarchy and design.md parser pipeline.
