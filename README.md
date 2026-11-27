# Byam

Home workout, rides and food tracker. Installable web app (PWA).

- Multi-page static site, no build step.
- Sign in with Google to save workouts, rides and weight to your own private cloud storage (Firebase Auth + Firestore, only your login can read your data).
- First sign-in asks for name, age, height, weight and goal weight.
- Guest mode: records are kept only for the current session and are not saved.
- Works offline once opened (service worker). Add to Home screen to install.
- Each exercise links an embedded YouTube form video for reference.
