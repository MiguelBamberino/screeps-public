**Screeps Simple-allies S1C**
This was created for the S1C alliance.
Contributors: MadDokMike, Harabi SneakyPolarBear & Kalgen 
This class is designed as an evolution of the original simple-allies code, found here:
https://github.com/screepers/simpleAllies/blob/main/src/js/simpleAllies.js

V0.2.0 Improvements/Changes:
- added the ability to reset and remove requests without completely resetting your requests

V0.1.0 Improvements/Changes:
- It now keets a local stash of ally data, so you can read their requests on any tick, even if you can't see their segment
- CPU improvements, by storing raw string data and parsing JSON on demand.
- added player synced nuke bombarding, design for exactly 1 nuker per X ticks, using requestBarrage() + getOpenBarrageJobs()
- Added read wrappers for making it easier for player bots to access/filter what they want to read
- added logger plugin support, for players to hook their logger in. Instead of console.log()
- Error handling method changed to screeps style ERR_* and log LEVEL=ERROR, so player bots are not broken from miss-use
- Using Jest Unit Tests to improve reliability
