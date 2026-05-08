# Backend Scope Cleanup

Date: 2026-05-07

## Removed active endpoints

These routes are no longer part of the active MVP API contract:

* `GET /friends`
* `GET /chats`
* `POST /chats`
* `POST /chats/{chat_id}/messages`
* `POST /messages/{message_id}/reactions`
* `DELETE /chats/{chat_id}`
* `POST /chats/{chat_id}/clear`
* `POST /users/{user_id}/block`

## Kept active endpoints

Core MVP endpoints remain active:

* Auth: register, login, current user, profile update, password change.
* Content: feed, search, papers, tags.
* Collections: list, create, update, delete, add/remove items.
* Events: like/save style product events.
* User interests and profiles.
* Ingestion and operational health routes.

## Database note

The legacy tables from `0004_profiles_collections_chats.py` are still present in migrations and models:

* `chats`
* `chat_participants`
* `messages`
* `message_reactions`
* `user_blocks`

They are deprecated storage for now, not an active API contract. A future migration can drop them after confirming no existing demo/local data must be preserved.

## Verification

* `python3 -m py_compile backend-api/app/main.py`
* Static search in `backend-api/app/main.py` for removed route decorators and chat/block schemas.
