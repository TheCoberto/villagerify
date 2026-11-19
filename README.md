# Villagerify

Turn a photo of your face into a Minecraft villager. **Live at https://thecoberto.github.io/villagerify/**

1. Choose, drop or paste a photo. Face detection (MediaPipe Face Landmarker) runs in your browser, and the photo never leaves your device.
2. It reads your skin, hair, eye, brow and facial-hair colours, plus glasses and your shirt colour, and paints them onto a villager.
3. Fine-tune with the colour pickers and styles, or edit pixels by hand.
   Or switch the Look to **Photo face** to paste your actual face (and nose) onto the villager, with HD textures up to 512×512.
4. Download:
   - **Villager texture**: a `.mcpack` that reskins every villager, or the raw 64×64 PNG.
   - **Villager variant**: a `.mcpack` that makes 1 to 5 of the 6 vanilla villager skin slots use your face, so real villagers (trading, professions, breeding) sometimes look like you. Replaces the vanilla villager client entity file (kept in `vanilla/`), so it may need updating if Mojang changes villagers.
   - **Player skin**: a `.mcpack` skin pack, or the raw 64×64 PNG.
   - **Custom villager**: a `.mcaddon` with a new mob and spawn egg. Normal villagers are untouched.
   - **3D render**: a 1024×1024 transparent PNG of the preview.

Plain HTML/JS with no build step. Libraries load from CDNs: three.js, JSZip and MediaPipe Tasks Vision.

```
index.html
css/style.css
js/app.js      UI, editor and downloads
js/paint.js    paints the villager and skin textures from features
js/face.js     reads features from a photo
js/model.js    3D preview; the villager bones are reused for the add-on geometry
js/export.js   builds the .mcpack / .mcaddon files
```

To run locally, serve the folder with any static web server (ES modules don't load from `file://`).
