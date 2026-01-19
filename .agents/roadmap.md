# Project Roadmap: next-pwa-turbo

Turbopack-native PWA library for Next.js 16. Uses Workbox as foundation with security-audited integration layer.

## Current Phase: Phase 1 - Foundation

## Features

### [IN_PROGRESS] feature-001: Foundation Setup
- **Priority**: P0
- **Layer**: Foundation
- **Dependencies**: None
- **Description**: Project setup, Zod config schema, security utilities, Build Adapter skeleton, esbuild SW compilation
- **Success Criteria**:
  - [ ] package.json with correct dependencies
  - [ ] TypeScript configured with strict mode
  - [ ] Zod schema validates 30+ config options
  - [ ] Security utils sanitize paths and validate scope
  - [ ] Build Adapter skeleton registers with Next.js
  - [ ] esbuild compiles SW template

### [PENDING] feature-002: Caching Strategies
- **Priority**: P0
- **Layer**: Foundation
- **Dependencies**: feature-001
- **Description**: Port 13 default strategies from next-pwa, Workbox integration
- **Success Criteria**:
  - [ ] All 13 default strategies implemented
  - [ ] Custom strategy support via config
  - [ ] precacheAndRoute working
  - [ ] registerRoute working

### [PENDING] feature-003: Offline Support
- **Priority**: P1
- **Layer**: Feature
- **Dependencies**: feature-002
- **Description**: Offline fallback pages, asset fallbacks, setCatchHandler
- **Success Criteria**:
  - [ ] /_offline page detection
  - [ ] Asset fallbacks (image, font, audio, video)
  - [ ] setCatchHandler implementation

### [PENDING] feature-004: React Integration
- **Priority**: P1
- **Layer**: Feature
- **Dependencies**: feature-001
- **Description**: usePWA, useServiceWorker, useInstallPrompt hooks, UpdatePrompt component
- **Success Criteria**:
  - [ ] usePWA hook works
  - [ ] useServiceWorker hook works
  - [ ] useInstallPrompt hook works
  - [ ] UpdatePrompt component works

### [PENDING] feature-005: Advanced Features
- **Priority**: P2
- **Layer**: Polish
- **Dependencies**: feature-003, feature-004
- **Description**: Push notifications, background sync, web manifest generation, dev mode
- **Success Criteria**:
  - [ ] usePushNotifications hook works
  - [ ] Background sync working
  - [ ] Web manifest generation from config
  - [ ] devOptions.enabled works

### [PENDING] feature-006: Testing & Documentation
- **Priority**: P1
- **Layer**: Polish
- **Dependencies**: feature-001, feature-002
- **Description**: Unit tests (vitest), integration test, security audit, migration guide
- **Success Criteria**:
  - [ ] >80% test coverage
  - [ ] Integration test with Next.js 16 app passes
  - [ ] Security audit checklist completed
  - [ ] Migration guide from next-pwa written

## Phase Overview

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Foundation (features 001, 002) | IN_PROGRESS |
| Phase 2 | Features (003, 004) | PENDING |
| Phase 3 | Polish (005, 006) | PENDING |
