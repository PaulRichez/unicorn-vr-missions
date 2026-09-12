---
# See github.com/js13kGames/hello-world for supported frontmatter
---

**Tactical flatulence action.** A unicorn take on the 1998 *VR Missions*: thirteen floating
platforms, hunters on fixed rounds, a time limit, and no weapon but a rainbow fart.

**How it plays**

- The grey on the floor is what the hunters see. Stay out of it. If one catches you the
  mission fails, and a little colour leaves the world for good.
- **Space** farts: a rainbow cloud and a noise six tiles wide. Hunters come to look at
  where it came from, which is how you move them. Three seconds to recharge.
- Flower tiles crunch (a noise of four tiles). Meadow tiles leave a glitter trail the hunters
  follow. Hedge tunnels hide you. Some hunters sleep until something wakes them; lookouts
  never move, but they turn.
- When a mission holds a **key**, the goal only appears once you have taken it.
- Every mission has a **TARGET** time and a **LIMIT**. Best times are kept on this device.
  Clear all thirteen and the horn draws its rainbow through whatever grey you earned.

**Controls**

- Keyboard: arrows / WASD to move, Space to fart, R to restart, M to mute, Escape for the
  mission list, Enter to skip a mission after three failures. The mouse does nothing.
- Touch: a stick to move (flick up or down in the list), one big button that says what it
  does, and the boxes on screen are buttons (menu, mute, restart). Always landscape: a phone
  held upright gets the page turned, nothing to rotate.
- Headset (WebXR, no library): press ENTER VR. The platform becomes a diorama on a table in
  front of you; the head is the camera, lean in to see behind a wall. A thumbstick walks the
  unicorn, the trigger farts or confirms, A/X goes back to the list, B/Y restarts. You never
  move, so nothing can make you sick.

**Under the hood**

WebGL2 with a single shader, low-poly meshes built in code, ZzFX for sound, levels written
as strings; the same renderer draws once per eye for WebXR, with the page's text painted
into a texture. An exact solver (breadth-first search over tile × time × keys) proves every
mission and sets its target time. Built with esbuild, terser, Roadroller and ECT; the zip
weighs 13 113 bytes.
