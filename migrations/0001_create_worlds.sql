-- Shared worlds, packed as in a world link and named by a hash of the world.
CREATE TABLE worlds (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created INTEGER NOT NULL
);
