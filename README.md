# PSDK Lab

**Making testing easier to make contributing to Pokémon SDK easier.**

PSDK Lab is a community-driven project by **Pokémon Workshop**. Its goal is to allow community members to select a Merge Request, automatically set up a suitable testing environment, and launch the game to test it.

**A tester doesn't necessarily have to be a developer.** Technical setup shouldn't be a barrier to contributing.

## Project Status

The project is currently in the planning and scoping phase. This repository serves as a starting point for sharing the vision and bringing contributors together.

**The strategy, technology stack, and action plan will be discussed and agreed upon during an upcoming project kickoff meeting.** The directions outlined below are still subject to confirmation.

## Proposed Initial Scope

Provide a straightforward testing workflow on **Windows and Linux**, without requiring Pokémon Studio to be installed or Git to be used manually:

1. Select a Merge Request from a list, highlighting those ready for testing.
2. Automatically prepare a project using the technical demo, PSDK binaries, and changes from the selected MR.
3. Launch the game and access relevant information if something goes wrong.

A local cache will help reduce downloads and speed up subsequent environment setups.

## Building on Existing Tools

We aim to reuse the tools and expertise already available within the community:

- [PSDK CLI](https://github.com/PokemonWorkshop/psdk-cli) for preparing and managing testing environments.
- [GameLauncher](https://github.com/PokemonWorkshop/GameLauncher) as a potential foundation for the desktop application.
- [Pokémon SDK](https://gitlab.com/pokemonsdk/pokemonsdk) as the engine being tested.

The exact responsibilities of each component and what can be reused will be defined collaboratively.

## Contributing

We're looking for volunteers to help with:

- **Ruby / PSDK:** Extend the CLI and automate environment setup.
- **UI and desktop development:** Build an accessible and intuitive testing experience.
- **CI and Windows/Linux distribution:** Simplify installation, updates, and maintenance.
- **User testing, UX, and documentation:** Ensure the tool addresses the actual needs of testers.

The project must remain **free, accessible, and maintainable by a volunteer team**.

## Development

Requirements: Node.js 20+. Nothing else: Git, the psdk-cli gem and the PSDK binaries (with their Ruby) are fetched by the tooling.

    npm install
    npm run dev                # prepares runtimes/ (first time only), then starts the app
    npm test                   # unit tests, no network
    npm run test:integration   # prepares a real MR, see below
    npm run lint               # includes max-lines 200 per file

Layout: `app/desktop` (Electron + React), `modules/core` (all the logic, no Electron), `modules/eslint-config` (shared rules), `runtimes/` (bundled tools).

### Bundled tools

`npm run prepare:runtimes` builds `runtimes/dist/` for the current OS (Windows or Linux): portable Git (dugite-native), the published `psdk-cli` and `thor` gems unpacked unchanged from rubygems.org, and 7za. Every URL, version and SHA-256 is pinned in `runtimes/versions.json`. There is no Ruby here: psdk-cli runs with the Ruby shipped in the PSDK binaries.
