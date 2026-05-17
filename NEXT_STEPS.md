# Stampify Next Steps

This file is the current handoff checklist for the stamp workflow work. It is
meant to make the next tasks easy to resume if the session gets interrupted.

## Completed

- [x] Reviewed the app structure and confirmed the main purpose: upload PDFs,
  create/select stamps, apply stamps to pages, manually adjust placement and
  size, then download stamped files.
- [x] Added California stamp templates for the current California workflow.
- [x] Added automatic California expiration date calculation from approval date.
- [x] Added transparent California stamp rendering.
- [x] Fixed selected stamp move and resize interaction on the PDF canvas.
- [x] Updated resizing so the stamp scales as one whole object instead of
  reflowing individual text/content after placement.
- [x] Added California logo upload support in the stamp form.
- [x] Moved the logo/address block down so it does not crowd the red note.
- [x] Reduced the default placed California stamp size so it is no longer huge
  when first applied to a file.
- [x] Confirmed all-pages placement uses the same stamp content while each page
  has its own movable/resizable applied stamp record.
- [x] Started the reusable state stamp builder foundation:
  - Saved builder stamps under a state/collection and stamp purpose.
  - Added block types for logo, text, label/value, date, signature, and spacer.
  - Added starter presets for Florida/simple, Florida/detailed, plans examiner,
    and a blank Intertek stack.
  - Updated rendering/preview/export paths to draw builder stamps with
    transparent backgrounds.
  - Grouped the Stamp Library by state/collection.

## Current Focus

We are now working on the next three practical workflow improvements:

1. [x] Clean up old test/oversized stamps in the app.
   - Added a safe Clear action for selected files that removes applied stamp
     placements from the PDF pages without deleting saved stamp library items.
   - This gives us a cleaner way to remove old oversized/test placements while
     preserving reusable custom stamps.

2. [x] Add a default stamp size control or preset for California stamps.
   - Added compact/default/large starting-size presets in the California stamp
     form.
   - Full base stamp dimensions stay unchanged so resizing/export continue to
     scale the whole stamp cleanly.

3. [x] Improve the per-page adjustment workflow after applying to all pages.
   - Page navigation now keeps the matching applied stamp selected when moving
     between pages, making page-by-page adjustment faster.
   - The canvas toolbar now shows the selected stamp or stamp count for the
     current page.

4. [ ] Add other state stamp templates.
   - Goal: support additional US state stamp collections using the same general
     pattern as California.
   - Some future state stamps will share the same logo/content structure, while
     others may need slightly different titles, labels, date rules, notes, or
     layout spacing.
   - Proposed approach: create a reusable state-template model instead of
     copying one-off components for every state, while keeping room for
     per-state exceptions.
   - Current status: the reusable builder foundation is implemented. The next
     step is to turn each numbered stamp from `stamps.pdf` into a named preset
     and then refine any layouts that need side-by-side logo/text behavior.

## Resume Notes

- Development server target: http://localhost:9002/
- Important files:
  - `src/lib/stamps/california.ts`
  - `src/components/stamps/california-stamp-form.tsx`
  - `src/components/workspace/pdf-canvas.tsx`
  - `src/stores/applied-stamps.ts`
  - `src/lib/pdf/stamp-renderer.ts`
  - `src/lib/stamps/custom-template.ts`
  - `src/components/stamps/custom-stamp-builder-form.tsx`
  - `tests/unit/california-stamps.test.ts`
  - `tests/unit/custom-template-stamps.test.ts`
- Standard checks used so far:
  - `npm run typecheck`
  - targeted `eslint` on changed files
  - `npm run test:run`
  - `npm run build`
