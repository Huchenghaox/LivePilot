# GitHub First Push

Use these steps tomorrow from the formal project directory.

## Confirm Directory

```bash
cd /Users/huchenghao/Projects/LivePilot
pwd
git status
git remote -v
```

The remote should be:

```text
https://github.com/Huchenghaox/LivePilot.git
```

## Authenticate

Use either GitHub CLI or SSH/HTTPS credentials.

GitHub CLI:

```bash
gh auth login
gh auth status
```

## Push

```bash
git push origin main
```

## Verify

Open:

```text
https://github.com/Huchenghaox/LivePilot
```

Check that these are not present in the repository:

- `.env`
- `.env.local`
- database files;
- uploaded screenshots;
- API keys;
- platform tokens.

## Future Codex Work

Keep all future work in:

```text
/Users/huchenghao/Projects/LivePilot
```

Do not continue feature work in the old directory.
