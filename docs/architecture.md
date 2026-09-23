# Code organization

OverTrack uses React, TypeScript, TanStack Start file-based routing, TanStack Query,
Supabase, and Tailwind CSS. Application code is organized by feature.

```text
src/
  routes/                  Route definitions, metadata, auth guards, and layouts
  features/
    auth/                  Sign-in screen and profile query
    calendar/              Calendar screen, grids, working-day data, and date helpers
    dashboard/             Dashboard screen and charts
    entries/               Entry dialogs, history, workflow, attachments, and calculations
    members/               Member screen, rates, access helpers, and server operations
    roles/                 Role screen, permissions, capabilities, and server guards
    settings/              Settings screen, fields, options, and working-calendar editor
    timesheet/             Timesheet screen
    workspaces/            Workspace context, selection, creation, and updates
  components/
    layout/                Application sidebar and top bar
    ui/                    Shared UI primitives
  hooks/                   Shared UI hooks
  integrations/            Supabase and Lovable adapters; generated database types
  lib/                     General utilities and error handling
supabase/migrations/       Database schema, policies, and functions
```

## Within a feature

Create directories only when the feature needs them:

- `components/`: screens and supporting React components.
- `hooks/`: queries and mutations, including optimistic updates and invalidation.
- `lib/`: calculations and other non-React helpers.
- `schemas/`: input validation shared with server functions.
- `api/`: TanStack server functions callable through their generated client stubs.
- `server/`: server-only implementation helpers and permission guards.
- `context/`: React providers and their context hooks.
- `types.ts` and `constants.ts`: feature-specific types and static configuration.

Import directly from the owning module using `@/features/...`. Avoid broad barrel
files that mix components, client queries, and server code. Cross-feature imports
are allowed when a feature consumes another feature's data or behavior. Shared
database adapters remain in `integrations/`; generated types stay there too.

## Routes and server boundaries

Keep route registration, page metadata, redirects, and route context access in
`src/routes`. Screen implementations live under their feature's `components/`.
The authenticated layout composes the workspace provider, sidebar, and top bar.
Do not edit `src/routeTree.gen.ts` manually; TanStack generates it.

TanStack `api/*.functions.ts` modules expose server functions. Do not place these
client-callable modules in `server/`, which TanStack excludes from client imports.
Keep `*.server.ts`
permission guards behind the existing dynamic imports inside server handlers.
Client-side capability checks control presentation; server checks and Supabase
policies enforce access.

## Behavior-preserving maintenance

Moving code should preserve query keys, invalidation, optimistic updates, auth
guards, validation, permission checks, calculations, and component state lifetimes.
Keep database migrations separate from organizational refactors.

Run `npx tsc --noEmit`, `npm run build`, and `npm run lint` when validating changes.
The repository currently has existing lint findings; compare them with the
baseline rather than changing application behavior to silence unrelated warnings.
