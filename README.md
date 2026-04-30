# ACG-Ballroom
ACG Ballroom - The floor is yours.

## Run locally

This project is intended to run from a web server so the room JSON and iframe assets load correctly.

From the `konomi/github/ACG` folder:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/acg_ballroom.html?ballroom=br.konomi
```

## Konomi Room

The Konomi room is available in the ballroom as `br.konomi` and contains the `konomioke.com` wall screen.

If the live iframe content is blocked, use the open button in the screen UI to launch the current URL in a new tab.
