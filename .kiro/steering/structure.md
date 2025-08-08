# Project Structure

## Directory Organization

```
src/
├── app/                    # Next.js App Router directory
│   ├── api/               # API routes
│   │   ├── shorten/      # URL shortening services
│   │   │   ├── bitly/    # Bitly integration
│   │   │   ├── clean/    # URL cleaning
│   │   │   ├── cuttly/   # Cuttly integration
│   │   │   ├── sink/     # Sink integration
│   │   │   ├── tinyurl/  # TinyURL integration
│   │   │   └── route.ts  # Main shortening endpoint
│   │   └── sub/          # Subscription conversion endpoints
│   ├── components/       # React components
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout component
│   └── page.tsx          # Home page
├── config/               # Configuration modules
│   ├── clash.ts         # Clash client configuration
│   ├── regions.ts       # Region mapping and rules
│   └── singbox.ts       # Sing-box client configuration
├── lib/                 # Utility libraries
│   ├── nodeUtils.ts     # Node processing utilities
│   ├── parsers.ts       # Subscription parsers
│   ├── remoteNodes.ts   # Remote node handling
│   ├── singleNode.ts    # Single node processing
│   ├── types.ts         # TypeScript type definitions
│   └── utils.ts         # General utilities
└── styles/              # Style-related files
    └── preview.ts       # Preview styling
```

## Architectural Patterns

### API Routes
- Use Next.js App Router API routes (`route.ts` files)
- Organize by feature (shorten, sub conversion)
- Each service provider gets its own subdirectory

### Configuration Management
- Separate config files for each client type (Clash, Sing-box)
- Centralized region definitions
- Type-safe configuration objects

### Library Organization
- **parsers.ts**: Handle different subscription formats
- **nodeUtils.ts**: Common node manipulation functions
- **types.ts**: Comprehensive TypeScript interfaces
- Separate files for remote vs single node processing

### Component Structure
- Components live in `src/app/components/`
- Use TypeScript React (.tsx) files
- Follow React 19 patterns

## File Naming Conventions
- Use camelCase for TypeScript files
- API routes use `route.ts` naming convention
- Configuration files use descriptive names (clash.ts, regions.ts)
- Component files use PascalCase when exported as default

## Import Patterns
- Use path aliases: `@/*` maps to `./src/*`
- Relative imports for local modules
- Absolute imports via aliases for cross-module dependencies

## Key Files
- `src/lib/types.ts`: Central type definitions for proxies, configurations
- `src/app/layout.tsx`: Root layout with Chinese language setting
- `tailwind.config.ts`: TailwindCSS configuration with content paths