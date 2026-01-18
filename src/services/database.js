const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'schema.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    description_source TEXT DEFAULT 'none',
    event_count INTEGER,
    discovered_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data_type TEXT,
    description TEXT,
    description_source TEXT DEFAULT 'none',
    sample_values TEXT,
    value_count INTEGER,
    discovered_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_properties_event ON properties(event_id);
`);

// Event operations
const getAllEvents = db.prepare(`
  SELECT e.*, COUNT(p.id) as property_count
  FROM events e
  LEFT JOIN properties p ON p.event_id = e.id
  GROUP BY e.id
  ORDER BY e.event_count DESC NULLS LAST, e.name
`);

const getEventById = db.prepare(`
  SELECT * FROM events WHERE id = ?
`);

const getEventByName = db.prepare(`
  SELECT * FROM events WHERE name = ?
`);

const insertEvent = db.prepare(`
  INSERT INTO events (name, event_count, discovered_at)
  VALUES (?, ?, datetime('now'))
  ON CONFLICT(name) DO UPDATE SET
    event_count = excluded.event_count,
    updated_at = datetime('now')
`);

const updateEventDescription = db.prepare(`
  UPDATE events
  SET description = ?, description_source = ?, updated_at = datetime('now')
  WHERE id = ?
`);

const deleteEvent = db.prepare(`
  DELETE FROM events WHERE id = ?
`);

// Property operations
const getPropertiesByEventId = db.prepare(`
  SELECT * FROM properties WHERE event_id = ? ORDER BY value_count DESC NULLS LAST, name
`);

const getPropertyById = db.prepare(`
  SELECT * FROM properties WHERE id = ?
`);

const insertProperty = db.prepare(`
  INSERT INTO properties (event_id, name, value_count, discovered_at)
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(event_id, name) DO UPDATE SET
    value_count = excluded.value_count,
    updated_at = datetime('now')
`);

const updatePropertyDescription = db.prepare(`
  UPDATE properties
  SET description = ?, description_source = ?, updated_at = datetime('now')
  WHERE id = ?
`);

const updatePropertySampleValues = db.prepare(`
  UPDATE properties
  SET sample_values = ?, data_type = ?, updated_at = datetime('now')
  WHERE id = ?
`);

const deleteProperty = db.prepare(`
  DELETE FROM properties WHERE id = ?
`);

// Export functions
function getSchemaForExport() {
  const events = getAllEvents.all();
  return events.map(event => {
    const properties = getPropertiesByEventId.all(event.id);
    return {
      name: event.name,
      description: event.description,
      properties: properties.map(p => ({
        name: p.name,
        type: p.data_type,
        description: p.description,
        sampleValues: p.sample_values ? JSON.parse(p.sample_values) : []
      }))
    };
  });
}

function getSchemaContextForPrompt() {
  const events = getAllEvents.all();
  return events.map(e => {
    const desc = e.description ? ` - ${e.description}` : '';
    const properties = getPropertiesByEventId.all(e.id);
    const propNames = properties.map(p => p.name).join(', ');
    const propsLine = propNames ? `\n    Properties: ${propNames}` : '';
    return `- ${e.name}${desc}${propsLine}`;
  }).join('\n');
}

module.exports = {
  db,
  // Events
  getAllEvents: () => getAllEvents.all(),
  getEventById: (id) => getEventById.get(id),
  getEventByName: (name) => getEventByName.get(name),
  insertEvent: (name, eventCount) => insertEvent.run(name, eventCount),
  updateEventDescription: (id, description, source) => updateEventDescription.run(description, source, id),
  deleteEvent: (id) => deleteEvent.run(id),
  // Properties
  getPropertiesByEventId: (eventId) => getPropertiesByEventId.all(eventId),
  getPropertyById: (id) => getPropertyById.get(id),
  insertProperty: (eventId, name, valueCount) => insertProperty.run(eventId, name, valueCount),
  updatePropertyDescription: (id, description, source) => updatePropertyDescription.run(description, source, id),
  updatePropertySampleValues: (id, sampleValues, dataType) => updatePropertySampleValues.run(JSON.stringify(sampleValues), dataType, id),
  deleteProperty: (id) => deleteProperty.run(id),
  // Export
  getSchemaForExport,
  getSchemaContextForPrompt
};
