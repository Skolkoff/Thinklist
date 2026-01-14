# T6.2 Verification Log

Date: 2026-01-14

## Environment
- Services: postgres, backend-api (docker compose)
- Endpoint: http://localhost:8000

## Steps
1) Ensure user exists:
   ```sql
   insert into users (email, password_hash)
   values ('t6_2@example.com','x')
   returning id;
   ```
   Result: user_id = 1

2) Get available tags:
   ```sql
   select normalized_name from tags order by id limit 2;
   ```
   Result: cs.cl, cs.ai

3) Update interests:
   ```bash
   curl -sS -X PUT "http://localhost:8000/me/interests" \
     -H "Content-Type: application/json" \
     -H "X-User-Id: 1" \
     -d '{"tags":["cs.cl","cs.ai"]}'
   ```
   Result:
   ```json
   {"user_id":1,"tags":["cs.ai","cs.cl"],"count":2}
   ```

4) Verify persistence:
   ```sql
   select count(*) from user_interests where user_id = 1;
   ```
   Result: 2
