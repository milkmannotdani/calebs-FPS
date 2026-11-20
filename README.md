# FPS Game: Web Edition

A browser version of **FPS Game** (originally a Unity 6 Windows build). It uses the original map, weapons, attachments, loadouts, grenades, sounds and tuning values, which were pulled straight from the Unity build's data files. It runs on [three.js](https://threejs.org) with no build step, so GitHub Pages can host it as-is.

## Put it on GitHub Pages

1. Create a new repository on GitHub (for example `fps-game`).
2. Upload **everything in this folder**, including the hidden `.nojekyll` file, to the root of the repository. You can drag and drop the files on the repo page under **Add file → Upload files**, or push them with git:
   ```bash
   git init
   git add .
   git commit -m "FPS Game web edition"
   git branch -M main
   git remote add origin https://github.com/<you>/fps-game.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: `main`**, **folder: `/ (root)`**, then click **Save**.
4. After a minute or two the game is live at `https://<you>.github.io/fps-game/`.

## Run it locally

The game loads files with `fetch`, so opening `index.html` directly from disk won't work. Start any static web server in this folder instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## How to play

A free-for-all deathmatch against 1–11 bots (Easy / Normal / Hard), with a score limit and a time limit you pick on the main menu.

| Key | Action |
|---|---|
| WASD | Move |
| Mouse | Look |
| Left click | Shoot |
| Right click / Q / Middle click | Aim down sights |
| Shift | Sprint |
| Space | Jump |
| Ctrl / C | Crouch (toggle) |
| Z | Prone (toggle) |
| R | Reload |
| 1 / 2 / Mouse wheel | Switch weapon |
| G | Throw grenade |
| Tab | Leaderboard |
| Esc | Pause, settings, change loadout |

**Loadouts** (taken from the original):
- **Agile** (×1.2 speed, ×1.15 jump): FN P90 + Glock G17 + Flash Grenades
- **Assault**: KC AK12 + Glock G17 + Frag Grenades
- **Ranged**: BT .50 Cal + Glock G17 + Frag Grenades

Each gun can take an optic (Red Dot, Holosight, Scope), a laser (red or green) and a grip. Grips reduce recoil. You set attachments on the loadout screen.

The **elevator** in the lobby links the lower level to the top floor. Step onto the platform to ride it, or stand in the shaft to call it.

## What's carried over from the Unity version

- The map and props (break room, generators, coffee machine, elevator), exported from the original scene
- Gun, attachment and grenade models, exported from the original prefabs
- Every `GunData` value: damage, damage falloff, RPM, auto/semi fire, magazine and reserve ammo, reload time, spread, recoil, aim/sway/bob/recoil springs, and gunshot pitch (including the low-ammo pitch rise)
- `LoadoutData` (speed and jump multipliers, guns, grenade type and count) and `AttachmentData` (aim multipliers, scope, laser colour and range, grip recoil)
- Player tuning: 100 HP, walk/sprint/crouch/prone acceleration and drag, jump force, 3-second spawn protection, grenade throw force and angle, and grenade range, fuse and damage
- The original sound effects

## What's different

- **Bots instead of online multiplayer.** The original used Unity Relay, Lobby and Vivox chat, and none of those can run on a static GitHub Pages site. Matches are against AI bots that path-find around the map with a navigation graph precomputed from the level geometry.
- Text chat was removed, since there's no one to chat with.
- Bots use a simple blocky soldier model instead of the original player model.
- Health regeneration is optional (on by default, toggle in the menu). The original had none.

## Files

```
index.html          page + UI
css/style.css       UI styles
js/main.js          game (rendering, movement, weapons, grenades, bots, HUD)
js/data.js          weapon/loadout/attachment stats from the Unity build
js/audio.js         sound playback
assets/*.glb        map, guns, attachments, grenades
assets/nav.json     bot navigation graph
assets/audio/       sound effects
assets/ui/          weapon silhouettes
vendor/three/       three.js r170 (MIT licence)
```
