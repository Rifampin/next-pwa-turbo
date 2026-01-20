# Knowledge Base

Accumulated learnings from orchestrated sessions.

## Gotchas

### Zod 4 Migration
- `z.function().args().returns()` is removed - use `z.custom<FunctionType>()` for function validation
- `z.SafeParseReturnType` is removed - use `ReturnType<typeof schema.safeParse>` or infer
- Function schemas in Zod 4 are "function factories" for creating validated functions, not schema validators

### TypeScript Strict Mode
- `exactOptionalPropertyTypes: true` requires conditional property assignment, not `prop: value || undefined`
- `noPropertyAccessFromIndexSignature: true` requires bracket notation for env vars: `process.env['NODE_ENV']`

### ESM in Node.js
- All imports must use `.js` extension even for `.ts` files (TypeScript ESM)
- Use `"type": "module"` in package.json
- Use `NodeNext` for both module and moduleResolution in tsconfig

### Service Worker Context
- No `window` object - use `self` typed as `ServiceWorkerGlobalScope`
- esbuild `define` injects globals at compile time - declare them with `declare const`

## Patterns

### Security - Config Injection
```typescript
// SAFE: Use escapeForServiceWorker for all SW injections
define: {
  '__PWA_MANIFEST__': escapeForServiceWorker(manifest),
}

// UNSAFE: Never use string interpolation
define: {
  '__PWA_MANIFEST__': `${JSON.stringify(manifest)}`, // XSS risk!
}
```

### Next.js 16 Build Adapter
```typescript
interface BuildAdapter {
  name: string;
  version: string;
  onBuildStart?(ctx: BuildContext): Promise<void>;
  onBuildComplete?(ctx: BuildContext): Promise<void>;
}
```

## Common Fixes

| Error | Fix |
|-------|-----|
| `Cannot find module './foo'` | Add `.js` extension to import |
| `Property 'x' does not exist on type 'ProcessEnv'` | Use bracket notation `process.env['X']` |

## Session History

| Session | Date | Feature | Outcome |
|---------|------|---------|---------|
| 1 | 2026-01-19 | Phase 1 Foundation | COMPLETED - All 7 tasks done, tsc builds |
| 2 | 2026-01-19 | Production Ready | COMPLETED - Migrated to pnpm, Zod 4 compat, 291 tests, docs |
