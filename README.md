# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/ec069c3a-222a-437f-935b-e56a3fae90cf

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/ec069c3a-222a-437f-935b-e56a3fae90cf) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## AI image generator

Players can now launch an AI image studio directly from the submission screen. They can iterate on prompts, remix outputs, and drop the selected image straight into the existing upload flow—no extra steps for the host or judges.

### Required environment variables

Add the following keys in the Supabase dashboard (`Project Settings → Configuration → Functions`):

- `LLM_API_KEY` – OpenAI key used by the `enhance-prompt` function.
- `REPLICATE_API_KEY` – Replicate key used by the `generate-image` function.

### Deploying the edge functions

After setting the keys, deploy the new Supabase edge functions from this repository root:

```sh
supabase functions deploy enhance-prompt
supabase functions deploy generate-image
```

Re-deploy whenever you update the code under `supabase/functions/`.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/ec069c3a-222a-437f-935b-e56a3fae90cf) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
