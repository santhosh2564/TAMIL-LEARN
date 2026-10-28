   # Tamil Learn

A React and TypeScript learning platform for Tamil and English activities. The app uses Vite for local development and production builds.

## Requirements

- Node.js (use a current LTS release)
- npm (included with Node.js)

## Run locally

1. Open a terminal in the project folder.
2. Install the dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local URL printed in the terminal (usually <http://localhost:5173>). Keep the terminal running while using the app. Press `Ctrl+C` to stop the server.

## Other commands

```bash
npm run build       # Type-check and create a production build in dist/
npm run preview     # Serve the production build locally (run after npm run build)
npm run lint        # Check source files with ESLint
npm test            # Run the Vitest test suite
```

To preview the production build, run `npm run build` first, then `npm run preview` and open the URL it prints.

## Content tools

The repository includes scripts for importing and validating learning content:

```bash
npm run content:check            # Import and validate Tamil/source content
npm run content:runtime-check    # Check activity runtime compatibility
npm run content:assets-check     # Validate referenced media assets
npm run content:english-check    # Validate English content
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for an overview of the source layout and application design. Content source files and additional documentation are in the project folders.
