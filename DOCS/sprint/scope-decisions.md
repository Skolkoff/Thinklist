# Sprint Scope Decisions

Date: 2026-05-07

## Removed from MVP

The following social/chat features are out of the current Thinklist/SciVise MVP scope:

* Messenger and chat UI.
* Friends surface.
* User blocking.
* Chat deletion and chat clearing.
* Message reactions.

## Kept for later scope

Reactions are reserved for article comments only. The intended future surface is the Article card/modal discussion area, not messenger messages or chat entities.

## Implementation notes

* Frontend messenger components were removed from active code.
* Frontend API client no longer exposes chat, friends, block, chat deletion, chat clearing, or message reaction methods.
* Board visibility no longer exposes `Friends`; current active options are `Public`, `Followers`, and `Private`.
* Backend FastAPI routes for `/friends`, `/chats`, `/chats/{chat_id}/messages`, `/messages/{message_id}/reactions`, `/chats/{chat_id}`, `/chats/{chat_id}/clear`, and `/users/{user_id}/block` were removed from the active API surface.
* Legacy chat/block SQLAlchemy models and historical Alembic migration are intentionally left in place for now to avoid mixing API scope cleanup with a destructive database migration.

## Verification

* `npm run build` in `frontend`.
* `python3 -m py_compile backend-api/app/main.py`.
* Static search confirms removed frontend service methods and active backend route decorators are gone.
