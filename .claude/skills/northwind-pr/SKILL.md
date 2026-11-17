---
name: northwind-pr
description: Write the pull request description for the current branch in the Northwind team format (title, What changed, How I verified it, Acceptance criteria, Deliberately not done), built only from the branch diff, the git log and the ticket. Use when the user asks to write or draft a PR description, when /submit needs a PR body, or when the user invokes /northwind-pr.
---

# /northwind-pr

Write the pull request description for this branch in the team's required format.

Every sentence in it must trace back to something you read or ran in this session: the branch diff, the git log, the ticket, or command output you saw. If you did not see it, it does not go in.

## Output

A title line, one blank line, then the body. Four sections, in this order, and no others:

````
<TICKET-ID>: <what it does>

## What changed

<one paragraph>

## How I verified it

<each command that was run, and what it printed>

## Acceptance criteria

<the ticket's checkboxes, ticked honestly>

## Deliberately not done

<bullets>
````

- The first line is the title and goes to `gh pr create --title`. Everything after the first blank line is the body and goes to `--body-file`. The title never appears inside the body.
- Use these sections even though `.github/pull_request_template.md` has different ones (Ticket, Bugs fixed along the way, Notes for the reviewer). Do not merge the two formats.
- The angle-bracket lines above describe what goes there. None of them survive into the output.

## What to do

### 1. Find the ticket. Stop if you cannot.

- Run `git branch --show-current`. The ticket ID is the leading `LETTERS-DIGITS` part of the branch name, uppercased: `NWP-201-issue-cards` → `NWP-201`.
- If the output is empty (detached HEAD), or the branch is `main`, or the name does not start with a ticket ID (`tooling/northwind-pr-skill`), stop. Tell the user which branch you are on and ask which ticket this PR is for. Do not pick one from the commit messages.
- Read `docs/tickets/<TICKET-ID>.md`. If it does not exist, stop and say so. Never write acceptance criteria from memory or from another ticket.

### 2. Read the work before you write a word

Run each of these and read what comes back:

- `git rev-parse --verify main`. If there is no local `main`, stop and tell the user. Do not swap in another base without asking.
- `git status --porcelain`. If anything is uncommitted, tell the user it will not be in the pull request and ask whether to commit it first. Describe committed work only.
- `git log main..HEAD` — the commits on this branch. Zero commits means there is nothing to describe: stop and say so.
- `git diff main...HEAD --stat`, then `git diff main...HEAD`. Three dots compare against the point where the branch left `main`, so commits that landed on `main` later do not show up as yours.
- The ticket, in full: the description, every checkbox, the rules, out of scope, and the definition of done.
- The spec for this ticket in `docs/specs/`, if one exists. It says what was planned, so you can name where the build departed from it.

### 3. Write the title

`<TICKET-ID>: <what it does>`, lowercase after the colon, the way commit subjects are written here. Start from the ticket's heading: `# NWP-201 · Issue virtual cards from the console` → `NWP-201: issue virtual cards from the console`. If the branch delivers less than the heading promises, describe what the branch does, not what the ticket hoped for.

### 4. What changed

One paragraph in plain language, three to five sentences. What can someone do now that they could not do before, and what does the code do to keep it correct (validation on the server, money in minor units, and so on)?

- Not a file list, and not a tour of function names; the diff already is one. Name a file or function only when a reviewer needs to know where something lives.
- If the change alters behavior someone already relies on (a default, an existing URL, a response shape), say so in one sentence.
- Every claim must point at code in the diff. If you cannot find the code, the claim comes out.
- If the branch also fixes something the ticket did not ask for, add a sentence that names the file and the root cause, not just the symptom.

### 5. How I verified it

List each verification step as the command, where it ran, and what it printed:

````
- `npm test` in `build-battle/merchant-console`, run while writing this description:
  ```
  <the Test Files and Tests summary lines, copied exactly>
  ```
- Browser check of the new dialog: not run
````

A step counts as run only if one of these is true:

- It was run in this session and you saw its output.
- You run it now to get the evidence. You may run the project's test command now (`npm test` in `build-battle/merchant-console`). Say it was run while writing the description, and paste its summary lines.
- The user ran it and pasted or described the result in this session. Say it was their run.

These do not count: a commit message that says tests pass, the test plan in the spec, a step someone meant to run, a run from an earlier session whose output you do not have, and CI you have not looked at.

Then cover the checks a reviewer would expect for this ticket — the test command, any checks in the ticket's definition of done, a browser check for any change to the UI. Each one that was not run gets its own line ending in `not run`. Never write "should pass" or a result you did not see.

Copy output exactly. Trim a long log down to the lines that carry the result, but never retype or round a number. If a run failed, paste the failure. A failing run reported is evidence; a failing run left out is a false claim.

### 6. Acceptance criteria

Copy every checkbox from the ticket, word for word and in order. If the ticket groups them under subheadings (NWP-201 has `Core` and `Stretch`), keep the subheadings.

Before you mark a criterion, read the code that would satisfy it. Some criteria are met by code the branch did not change but relies on (an existing formatter, an existing column), so read that code too, not only the diff. Then mark each one:

- **Met:** `[x]`, only when you read the code that does it. Say where it lives: ` — in the diff` or ` — existing code, unchanged by this branch`. If no step in "How I verified it" exercised it, add `; not exercised by any check above`.
- **Partial:** leave it `[ ]` and append ` — Partial:` followed by which part is done and which is not.
- **Not done:** leave it `[ ]` and append ` — Not done.` Then list it under "Deliberately not done".
- **Not confirmed:** you read the code and still cannot tell. Leave it `[ ]` and append ` — Not confirmed:` and what would settle it. Do not call this Partial; Partial means part of it is known to be done.

Never tick a criterion because the code should handle it, because a commit message says so, or because it was planned. If the ticket has no checkboxes, write one line saying so instead of inventing criteria.

### 7. Deliberately not done

Bullets, each one short:

- Every criterion left unticked (partial, not done, or not confirmed), and why, if the reason is known.
- Definition-of-done items this branch does not meet.
- Out-of-scope items a reviewer might expect to see, with the ticket that owns them where the ticket names one (NWP-201 sends persistence to NWP-203). Do not copy the whole out-of-scope list.
- Follow-ups and rough edges you saw in the diff: a missing test, a known limit, a TODO left in the code.

Leave out what belongs elsewhere: checks that were not run are already in "How I verified it", so do not list them again, and problems elsewhere in the codebase that this branch neither touches nor makes worse are not part of this pull request.

Reasons come from the ticket, the spec, the commits, or the user. If you do not know why something was not done, say what was not done and leave the reason out. If there is nothing to list, write `Nothing beyond the ticket's out-of-scope list.`

### 8. Hand it back

- **Invoked directly:** print the title and the body. Offer to open the pull request with `/submit`, and do not run it, or `gh pr create`, without a yes. Opening a pull request is the user's call.
- **Called from `/submit`:** write the body, and only the body, to a temp file outside the repository so it can never be committed. Hand the title and that file path back to `/submit` step 4.

## Rules

- **Never claim a verification that was not run.** No "tests pass", no "checked in the browser", no test count, unless the output is in this session. Anything you cannot verify is marked `not run`, never guessed and never softened into "should work".
- **Read before you write.** The ticket, `git log main..HEAD` and `git diff main...HEAD` are read in this session before the first line is drafted. Not from memory, and not from the commit subjects alone.
- **A tick needs code you read.** `[x]` means you can point at the lines that do it, in the diff or in existing code the change relies on.
- **Quote output. Do not paraphrase it.**
- **Plain language over ceremony.** "Ops can now issue a card and see it in the list" beats "implemented card issuance functionality".
- **No placeholders in the output.** No `<…>`, no `TBD`, no `NWP-____`. If a section cannot be filled, say why in one line.
- **No emoji, no filler, no summary of the summary.**
- **Never open, push, or edit a pull request unless the user says to.**
