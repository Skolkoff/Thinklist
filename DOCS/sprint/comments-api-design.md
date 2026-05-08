# Comments API Design

Date: 2026-05-08

## Scope

Article comments are a separate MVP social surface. They do not depend on chats, messages, friends, user blocks, or message reactions.

## Tables

### `article_comments`

- `id` integer primary key
- `paper_id` integer, required, FK `papers.id`, cascade delete
- `author_id` integer, required, FK `users.id`, cascade delete
- `content` text, required, 1..2000 chars at API level
- `created_at` timestamptz, required
- `updated_at` timestamptz, required
- indexes: `(paper_id, created_at)`, `author_id`

### `comment_reactions`

- `id` integer primary key
- `comment_id` integer, required, FK `article_comments.id`, cascade delete
- `user_id` integer, required, FK `users.id`, cascade delete
- `emoji` string(16), required
- `created_at` timestamptz, required
- unique: `(comment_id, user_id, emoji)`
- indexes: `comment_id`, `user_id`

## Permissions

- Guest can list comments.
- Auth user can create comments.
- Auth user can react/unreact to comments.
- Auth user can delete own comments.
- No edit endpoint in MVP.

## Endpoints

### List

`GET /papers/{paper_id}/comments?limit=50&offset=0`

Response:

```json
{
  "items": [
    {
      "id": "12",
      "paperId": "1",
      "content": "Useful paper.",
      "author": {
        "id": "4",
        "name": "Ada Lovelace",
        "nickname": "ada",
        "avatarUrl": "https://...",
        "interests": []
      },
      "reactionCounts": { "heart": 1 },
      "viewerReaction": "heart",
      "canDelete": true,
      "createdAt": "2026-05-08T10:00:00+00:00",
      "updatedAt": "2026-05-08T10:00:00+00:00"
    }
  ],
  "nextOffset": null
}
```

### Create

`POST /papers/{paper_id}/comments`

```json
{ "content": "Useful paper." }
```

Requires bearer token. Returns created comment.

### Delete

`DELETE /comments/{comment_id}`

Requires bearer token and comment ownership.

### React

`POST /comments/{comment_id}/reactions`

```json
{ "emoji": "heart" }
```

Requires bearer token. Unique per `(comment_id, user_id, emoji)`.

### Unreact

`DELETE /comments/{comment_id}/reactions/{emoji}`

Requires bearer token. Returns updated comment.

## Tests

- Static contract tests: `tests/test_comments_contract.py`.
- Smoke helper: `scripts/smoke_api.py --include-comments`.
- Migration: `backend-api/alembic/versions/0005_article_comments.py`.
