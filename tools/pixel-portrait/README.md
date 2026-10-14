# Pixel portraits

Makes the 8-bit versions of the profile photos that the video game theme shows
(`resources/img/anne-8bit.png` and `curious-8bit.png`).

It uses macOS's built-in person and face detection (Vision) to cut the person out of the
photo and find their eyes, eyebrows and mouth. Then it shrinks the photo to 48×48 pixels,
snaps every pixel to a 32-color retro palette, draws crisp eyes, glasses and a smile on
top, and outlines the person in a dark line like a game sprite.

This folder isn't deployed (`.cpanel.yml` only copies the site's own files).

## Running it

Needs a Mac, Google Chrome and Node.

```bash
cd tools/pixel-portrait && npm install && node make.js
```

It writes the two PNGs into `resources/img/` and a scaled-up preview to `work/preview.png`.

## Changing the look

Everything is in `settings.json`, one entry per image:

- `crop`: which square of the photo to use, as `[x, y, size]` in photo pixels
- `size`: how many pixels across the result is (48 keeps the glasses readable)
- `personPalette` / `backgroundPalette`: which colors each part may use
- `features`: colors for the drawn eyebrows, glasses, pupils, mouth and nose shadow
  (only for photos with a `landmarks` file, so the face is big enough to draw on)

The comment at the top of `sprite.html` lists every option.
