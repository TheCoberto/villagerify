# Villagerify

Turn a photo of your face into a Minecraft villager. **Live at https://thecoberto.github.io/villagerify/**

1. Choose, drop or paste a photo. Face detection (MediaPipe Face Landmarker) runs in your browser, and the photo never leaves your device.
2. It reads your skin, hair, eye, brow and facial-hair colours, plus glasses and your shirt colour, and paints them onto a villager.
3. Fine-tune with the colour pickers and styles, or edit pixels by hand.
4. Download:
   - **Villager texture**: a `.mcpack` that reskins every villager, or the raw 64×64 PNG.
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
