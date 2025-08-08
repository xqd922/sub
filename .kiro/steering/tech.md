# Technology Stack

## Framework & Runtime
- **Frontend Framework**: Next.js 15.1.6 with App Router
- **React Version**: React 19
- **Runtime**: Node.js >= 18
- **Package Manager**: Bun (preferred) or npm
- **Language**: TypeScript with strict mode enabled

## Styling & UI
- **CSS Framework**: TailwindCSS 3.4.17
- **PostCSS**: Configured for CSS processing
- **Design**: Responsive with dark mode support
- **Language**: Chinese (zh) as primary language

## Key Dependencies
- **YAML Processing**: js-yaml for configuration parsing
- **Type Definitions**: Comprehensive TypeScript types for all major dependencies

## Development Tools
- **Linting**: ESLint with Next.js config and custom rules
- **TypeScript Config**: Bundler module resolution with path aliases (@/*)
- **Build Target**: ES2017

## Common Commands

### Development
```bash
bun dev          # Start development server on port 3000
bun install      # Install dependencies
```

### Production
```bash
bun run build    # Build for production
bun start        # Start production server on port 3000
```

### Code Quality
```bash
bun run lint     # Run ESLint checks
```

## Environment Variables
- `BITLY_TOKEN`: Bitly API authentication token
- `SINK_URL`: Sink service endpoint URL  
- `SINK_TOKEN`: Sink service authentication token

## ESLint Rules
- Extends Next.js core web vitals configuration
- Custom rule: Unused variables/args starting with underscore are ignored
- TypeScript strict mode with unused variable detection