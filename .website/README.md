---
# See github.com/js13kGames/hello-world for supported frontmatter
---

**Tactical flatulence action.** A unicorn take on the 1998 *VR Missions*: thirteen floating platforms, hunters on fixed rounds, a time limit, and no weapon but a rainbow fart.

**How it plays**

- The grey on the floor is what the hunters see. Get caught and a little colour leaves the world for good.
- **Space** farts: a rainbow cloud and a noise six tiles wide. Hunters come to look, which is how you move them. Three seconds to recharge.
- Flowers crunch underfoot, meadows keep your glitter trail, hedge tunnels hide you. Some hunters sleep; lookouts never walk, but they turn.
- When a mission holds a **key**, the goal only opens once you have it. Every mission has a TARGET and a LIMIT; best times are kept on this device.

**Controls**

- Keyboard: arrows / WASD to move, Space to fart, R to restart, M to mute, Escape for the mission list, Enter to skip after three failures.
- Touch: a stick to move, one big button that says what it does, and the boxes on screen are buttons. Always landscape.
- Headset (WebXR, no library): press ENTER VR. The platform becomes a diorama on a table in front of you; lean in to see behind a wall. The thumbstick walks, the trigger farts or confirms, A/X goes back to the list, B/Y restarts. You never move, so nothing can make you sick.

**Under the hood**: WebGL2 with one shader, meshes built in code, ZzFX, levels as strings, and an exact solver that proves every mission and sets its target time; the same renderer draws once per eye for WebXR. esbuild, terser, Roadroller, ECT: 13,113 bytes.
