# Flyer extraction fixtures

`extractFlyer.live.test.ts` runs only when both env vars are set:

```bash
ANTHROPIC_API_KEY=...
FLYER_FIXTURE_PATH=/abs/path/to/flyer.jpg \
FLYER_FIXTURE_EXPECTED='{"city":"Aguascalientes","country":"MX","timezone":"America/Mexico_City"}' \
npm run -w web test:flyer
```

Real flyers are kept out of the repo by policy. Use a personal flyer
locally for the live test, or render a synthetic flyer in any image
editor with the expected fields drawn as readable text.

`FLYER_FIXTURE_EXPECTED` is a JSON snippet — the test asserts each
key's value matches the model output. Omit it to run the test
without snapshot assertions (just the schema-level checks).
