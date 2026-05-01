# Questions Worth Asking Setup

This site stays on GitHub Pages and uses Supabase only for the dynamic question feature.
Questions publish immediately after submission.

## 1. Create the Supabase table

In your Supabase dashboard:

1. Open the SQL editor.
2. Paste in the contents of `supabase/questions_worth_asking.sql`.
3. Run the script.

This creates or updates:

- `public.questions_worth_asking`
- row level security policies
- a trigger that stamps `approved_at` when a question is published

## 2. Add your public project credentials

Open `questions-config.js` and fill in:

```js
window.QUESTIONS_CONFIG = {
    supabaseUrl: "https://YOUR_PROJECT.supabase.co",
    supabasePublishableKey: "YOUR_PUBLIC_KEY",
    questionsTable: "questions_worth_asking",
    submissionCooldownMs: 60000
};
```

Use the publishable key from Supabase. The older `anon` key also works with this code, but Supabase now recommends publishable keys for public clients. Do not use the secret or service role key here.

## 3. Optional cleanup for existing projects

If you already ran the older version of this feature with manual approval, rerun the SQL script.
It will:

- switch the default status to `approved`
- make new submissions public immediately
- convert existing `pending` questions to `approved`

You can still manually set a row to `rejected` later if needed.

Optional: add a `response_url` if you later answer a question in a blog post.

## 4. Publish on GitHub Pages

Commit and push these files. GitHub Pages will serve:

- `index.html`
- `questions.html`
- `js/questions.js`
- `questions-config.js`

If your Pages site is already connected to `www.adityabiyani.com`, the new page will be available at:

`https://www.adityabiyani.com/questions.html`

## 5. What this feature demonstrates for the assignment

- Dynamic content with Supabase
- Input handling and XSS-conscious rendering with DOMPurify and text-only output
- Public publishing workflow using RLS-protected browser access
