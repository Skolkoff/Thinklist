# T9.5 Verification Log

Date: 2026-01-14T14:21:02.784792Z

## Setup
- user_id: 3
- email: t9_demo_1768400462@example.com
- tag X: cs.cl
- tag Y: cs.ai

## Baseline (no likes)
- top20 ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
- X count in top20: 10

## Likes on tag X
- liked ids: [1, 5, 7, 10, 14]

## After likes (ML rerank)
- top20 ids: [14, 5, 10, 7, 1, 96, 88, 94, 91, 79, 24, 35, 51, 17, 67, 32, 90, 22, 97, 87]
- X count in top20: 11

## Result
- increased: True
