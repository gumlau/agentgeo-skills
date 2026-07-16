# Releasing `chatsights-mcp`

The npm package lives in [`mcp/`](./mcp). Once published, users install it with:

```bash
claude mcp add chatsights -- npx -y chatsights-mcp --api-url https://api.trychatsights.com
```

The package name `chatsights-mcp` is available on npm, and `mcp/package.json` is
already publish-ready (public access, `bin`, `files`, provenance-friendly
`repository`). The tarball ships exactly three files: `index.mjs`, `README.md`,
`package.json` (~3 kB).

## One-time setup — NPM_TOKEN

The GitHub Actions workflow publishes with a token, so no local `npm login` is needed.

1. On [npmjs.com](https://www.npmjs.com/) → **Access Tokens** → **Generate New Token**
   → choose **Automation** (or a Granular token scoped to publish `chatsights-mcp`).
2. In this repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `NPM_TOKEN`
   - Value: the token from step 1

## Publish (recommended — automated)

1. Bump the version and update the changelog:
   - `mcp/package.json` → `"version"` (follow [SemVer](https://semver.org/))
   - `CHANGELOG.md` → move items under a new version heading
2. Commit and push to `main`.
3. Cut a GitHub Release:

   ```bash
   gh release create v0.1.0 --title "v0.1.0" --notes "First public release"
   ```

   Publishing the release triggers [`.github/workflows/publish.yml`](./.github/workflows/publish.yml),
   which runs `npm publish --provenance --access public` from `mcp/`.
4. Confirm it landed:

   ```bash
   npm view chatsights-mcp version
   npx -y chatsights-mcp --api-url http://localhost:8080   # smoke test
   ```

You can also run the workflow by hand from the **Actions** tab (**Run workflow**).

## Publish (manual fallback)

If you'd rather publish from your machine:

```bash
cd mcp
npm login                       # once
npm publish --access public     # runs prepublishOnly: node --check index.mjs
```

## Versioning

- **patch** (`0.1.x`) — bug fixes in the MCP client.
- **minor** (`0.x.0`) — new flags or backward-compatible behavior.
- **major** (`x.0.0`) — breaking changes to the tool contract.

The skills in `skills/` are not an npm package; they version with the repo and
are distributed via `git` / `enable-skills.sh`.
