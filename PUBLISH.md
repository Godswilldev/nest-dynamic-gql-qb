# Publishing to npm

## 1. Move to a new repo (optional)

To publish as a standalone package, copy this folder to a new Git repo:

```bash
cp -r nest-dynamic-gql-qb ../nest-dynamic-gql-qb-repo
cd ../nest-dynamic-gql-qb-repo
git init
git add .
git commit -m "Initial package"
# Create repo on GitHub/GitLab, then:
git remote add origin https://github.com/your-org/nest-dynamic-gql-qb.git
git push -u origin main
```

## 2. Update package.json

- Set `repository.url` to your actual repo URL.
- Change `name` if needed (e.g. to a scoped name `@your-org/nest-dynamic-gql-qb` if the unscoped name is taken).

## 3. Publish

```bash
npm login
npm publish --access public
```

(Use `--access public` for scoped packages so they are public.)

## 4. Later releases

Bump version in `package.json` (or run `npm version patch`), then:

```bash
npm run build
npm publish
```
