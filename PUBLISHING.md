# Publishing Guide

## Prerequisites

1. **npm account**: Create one at https://www.npmjs.com/signup
2. **GitHub account**: For hosting the repository
3. **npm CLI**: Make sure you're logged in with `npm login`

## Step-by-Step Publishing Process

### 1. Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository named `n8n-nodes-ms-dataverse`
3. Don't initialize with README (we already have one)

### 2. Update package.json

Replace `YOUR_USERNAME` in `package.json` with your actual GitHub username:
- Line 6: `homepage` URL
- Line 21: `repository.url`

### 3. Connect to GitHub

```bash
# Add your GitHub repository as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/n8n-nodes-ms-dataverse.git

# Push to GitHub
git push -u origin main
```

### 4. Publish to npm

```bash
# Login to npm (if not already logged in)
npm login

# Build the package
npm run build

# Publish to npm
npm publish
```

### 5. Verify Publication

After publishing, your package will be available at:
- npm: https://www.npmjs.com/package/n8n-nodes-ms-dataverse
- GitHub: https://github.com/YOUR_USERNAME/n8n-nodes-ms-dataverse

## Future Updates

When you want to release a new version:

```bash
# Make your changes, then:

# Update version (choose one)
npm version patch  # 0.1.0 -> 0.1.1 (bug fixes)
npm version minor  # 0.1.0 -> 0.2.0 (new features)
npm version major  # 0.1.0 -> 1.0.0 (breaking changes)

# Build and publish
npm run build
npm publish

# Push version tag to GitHub
git push --follow-tags
```

## Troubleshooting

### Package name already taken
If the package name is taken, you can:
1. Choose a different name (e.g., `@your-username/n8n-nodes-ms-dataverse`)
2. Update the `name` field in `package.json`

### Authentication issues
```bash
npm logout
npm login
```

### Build errors
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

## Important Notes

- The `prepublishOnly` script automatically runs before publishing
- Only the `dist` folder is published (defined in `files` field)
- Make sure all tests pass before publishing
- Update CHANGELOG.md for each release
