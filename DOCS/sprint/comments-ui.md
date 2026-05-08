# Comments UI Notes

Date: 2026-05-08

## Surface

Comments live inside `ArticleModal` below topics and above related articles.

## States

- Loading: compact skeleton rows.
- Empty: "No comments yet."
- Guest: can read comments and sees a disabled composer with a sign-in prompt.
- Auth: can post comments, react with heart, unreact, and delete own comments.
- Error: inline message under the composer.

## Reactions

Reactions are only rendered for article comments. Messenger/message reactions remain out of frontend scope.

## Mobile

The section uses the existing scrollable modal content and compact controls, so it remains usable in the mobile modal height introduced in Phase 3.

## Test Artifacts

Captured:

- Guest article modal with comments visible: Playwright snapshot showed disabled composer and empty state.
- Auth composer/comment/reaction: `output/playwright/comments-auth-reacted.png`.
- Mobile article modal comments section: `output/playwright/comments-mobile.png`.
