/**
 * Stub declaration for the standalone mini-app workspaces.
 *
 * The mini apps in `project404/miniapps/*` are sibling npm workspaces with no
 * `node_modules` of their own. Node resolution from `miniapps/<app>/index.tsx` walks up
 * to the repo root and finds nothing, because npm keeps `react` and `react-native`
 * nested in `aza/node_modules` — so pulling their sources into this app's TypeScript
 * program produces two dozen spurious "Cannot find module 'react'" errors that say
 * nothing about the code under test.
 *
 * This file is used only by `tsconfig.ci.json`, which repoints the `@miniapps/*` aliases
 * here. It keeps the CI typecheck focused on Aza's own source while still asserting the
 * one thing `registry.ts` actually depends on: that each mini app default-exports a React
 * component taking `MiniAppProps`.
 *
 * The mini apps are still typechecked by Metro at build time. The real fix is a shared
 * tsconfig and hoisted dependencies for the workspaces; until then this keeps the gate
 * meaningful instead of permanently red.
 */
import type { ComponentType } from 'react';
// Reuse the app's own contract rather than restating it. Two structurally identical
// declarations would still be nominally distinct to the registry's assignment check,
// and a copy here would silently drift from the real interface.
import type { MiniAppProps } from '../src/features/hub/miniapps/types';

declare const MiniApp: ComponentType<MiniAppProps>;
export default MiniApp;
