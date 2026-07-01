# Prompted.Party

A multiplayer party game where friends create and vote on the funniest AI-generated images from creative prompts.

## Tech stack

- Vite + React + TypeScript
- shadcn-ui + Tailwind CSS
- Supabase (database + edge functions)
- Vercel (hosting)

## Getting started

```sh
npm install
npm run dev
```

## Environment variables

Add the following keys in the Supabase dashboard (`Project Settings → Configuration → Functions`):

- `LLM_API_KEY` – OpenAI key used by the `enhance-prompt` function.
- `REPLICATE_API_KEY` – Replicate key used by the `generate-image` function.

## Deploying edge functions

```sh
supabase functions deploy enhance-prompt
supabase functions deploy generate-image
```
