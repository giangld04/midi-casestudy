# Phase 02: API Validation + Service Passthrough

## Context Links
- Validator: `apps/api/src/validators/note-validator.ts`
- Service: `apps/api/src/services/note-service.ts`
- Socket handler: `apps/api/src/socket/note-event-handler.ts`
- REST routes: `apps/api/src/routes/note-routes.ts`
- DTO mapper: `apps/api/src/lib/to-note-dto.ts`

## Overview
- **Priority:** P1 (blocks frontend phases)
- **Status:** pending
- **Description:** Extend Zod validation schemas for pitch/duration/velocity. Confirm service layer auto-passes new fields. Update socket handler to extract and validate new fields from payloads.

## Key Insights
- `note-service.ts` uses `{ ...input, songId }` spread for create and `{ ...patch }` spread for update, so new validated fields flow into DB automatically. **No service code changes needed** beyond confirming the spread pattern.
- `note-event-handler.ts` explicitly picks fields from socket payload before calling `createNoteSchema.parse()` -- must add pitch/duration/velocity to those picks.
- REST routes use `validateBody(createNoteSchema)` middleware -- body already passes through to service. No route changes needed.

## Requirements
**Functional:**
- `createNoteSchema`: add optional `pitch` (int 0-127), optional `duration` (int >= 1), optional `velocity` (int 1-127). All optional because defaults exist at DB level.
- `updateNoteSchema`: add optional `pitch`, `duration`, `velocity` with same bounds.
- Socket handler: extract `pitch`, `duration`, `velocity` from create/update payloads.

**Non-functional:**
- Zod validation bounds must mirror DB CHECK constraints (defense-in-depth)

## Architecture
No architectural changes. Validation layer sits between transport (REST/Socket) and service. Service already spreads validated input into Drizzle insert/update.

## Related Code Files

**Modify:**
- `apps/api/src/validators/note-validator.ts` -- add 3 optional fields to both schemas
- `apps/api/src/socket/note-event-handler.ts` -- extract new fields in note:create and note:update handlers

**No changes needed:**
- `apps/api/src/services/note-service.ts` (spread pattern covers new fields)
- `apps/api/src/routes/note-routes.ts` (middleware passes req.body to service)

## Implementation Steps

1. **Update `note-validator.ts` createNoteSchema:**
   ```ts
   pitch: z.number().int().min(0).max(127).optional(),
   duration: z.number().int().min(1).optional(),
   velocity: z.number().int().min(1).max(127).optional(),
   ```

2. **Update `note-validator.ts` updateNoteSchema:**
   Same 3 fields, all optional.

3. **Update `note-event-handler.ts` note:create handler:**
   Add to the parse object:
   ```ts
   pitch: payload.pitch,
   duration: payload.duration,
   velocity: payload.velocity,
   ```

4. **Update `note-event-handler.ts` note:update handler:**
   Add to the parse object:
   ```ts
   pitch: payload.pitch,
   duration: payload.duration,
   velocity: payload.velocity,
   ```

5. **Verify service passthrough:**
   Read `note-service.ts` to confirm `{ ...input, songId }` (create) and `{ ...patch }` (update) cover new fields without changes. Already confirmed during research.

## Todo List
- [ ] Add pitch/duration/velocity to createNoteSchema
- [ ] Add pitch/duration/velocity to updateNoteSchema
- [ ] Extract new fields in socket note:create handler
- [ ] Extract new fields in socket note:update handler
- [ ] Verify `pnpm typecheck` passes
- [ ] Test REST POST with pitch/duration/velocity via curl

## Success Criteria
- `pnpm typecheck` passes
- REST POST /songs/:id/notes with `{ title, track, timeTick, pitch: 72, duration: 4, velocity: 80 }` returns the note with those values
- Socket note:create with pitch/duration/velocity broadcasts correctly
- Omitting pitch/duration/velocity still works (DB defaults apply)

## Risk Assessment
- **NONE:** All new fields are optional with DB-level defaults. Fully backward compatible.

## Security Considerations
- Zod validation bounds mirror CHECK constraints (defense-in-depth)
- Rate limiter on socket unchanged

## Next Steps
- Phase 03 depends on this: frontend needs to send/display new fields
