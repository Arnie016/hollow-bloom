# Credits and asset provenance — After the Bloom

Original game code, level design, AI and procedural audio by Arnav Salkade, with AI-assisted development (Claude Code, OpenAI Codex).
Engine: three.js r160 (MIT), loaded from jsDelivr.

## Sound

| Files (assets/sfx) | Source | License / requirement |
|---|---|---|
| step_*, hit_*, smash_*, clang_*, thud_*, debris_*, plank_* | Kenney — *Impact Sounds* | CC0 1.0, no attribution required |
| slice_*, chop_0, draw_*, creak_*, cloth_*, door_*, gun_click, gun_latch, drop_0, belt_0 | Kenney — *RPG Audio* | CC0 1.0, no attribution required |
| amb_rain, thunder_0, amb_wind | Mixkit Free Sound Effects (via flight-sim library) | Mixkit Sound Effects License: free for use in games |
| heartbeat, gasp, grind | Synthesised in-house (astra-world `tools/make_audio.py`) | Original |
| sting_dark_*, breath_hiding, sting_detect, drone_deep_*, amb_storm, bed_dark, amb_room, thunder_1, engine_start, impact_0, braam, owl | **Sound effects generated with ElevenLabs** (Arnav's generations, ~/Downloads and ~/Desktop/FAB ASSETS/sounds) | Free-account generations require this attribution. Upgrade the plan before any paid or commercial release. |
| Everything else (gunshots, clicks, screams, music layers) | Procedural WebAudio in `audio.js` | Original |

Rebuild with `tools/build_sfx.sh`. The script is the source of truth for which file maps to which sound.

## Visuals

| Assets | Source |
|---|---|
| Surface textures (assets/tex), key art, title art | Generated with Higgsfield (gpt-image-2.5), normal maps derived locally |
| Trailer shots | Higgsfield — Kling 3.0 image-to-video, cut with FFmpeg; audio punctuation from the ElevenLabs set above |
| Wren, Frenzied, Knocker, Lurker meshes and animation clips | Higgsfield — Meshy image-to-3D and auto-rigging; animation library clips |
| Props (car, shelves, boiler, fungus, cocoons, generator, plank, crate, barrel…) | Higgsfield — Tripo text-to-3D |
| `survival-pistol-original.glb` | Modelled in Blender for this project |
| Melee weapons (nailboard, machete, saber) | Procedural meshes in `weapons.js` |
| `raven.glb` (on the wrecked car) | ~/Desktop/FAB ASSETS (originally a local download, "haunted-halloween-manor" kit). **Source/license unverified: confirm before the public release, or delete `assets/models/raven.glb`.** |

Check the commercial-use terms of your Higgsfield plan before selling the game. A free itch.io release is the intended first step.

## Not shipped
- `assets/raw`, `assets/ref`: source files kept for re-processing. They are excluded from builds.
- "An Unwritten Room" and other music in FAB ASSETS. The track is not horror in tone, and the Apple soundbank redistribution terms are unverified.

## Selected soundtrack
- **Waiting in the Dark — Take 2**, by DoodilyDo / Arnav, generated with Suno: https://suno.com/song/21244337-5081-4da5-8078-93e05dfb09ea
- Public listening link appears on the title screen. The audio file is not bundled yet: Suno download allowance was exhausted on 5 October 2026.
