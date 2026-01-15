const express = require('express');
const router = express.Router();
const db = require('../services/database');
const mixpanel = require('../services/mixpanel');
const openai = require('../services/openai');

// ============================================
// CRUD Operations
// ============================================

// List all events with property counts
router.get('/events', (req, res) => {
  try {
    const events = db.getAllEvents();
    res.json({ success: true, events });
  } catch (error) {
    console.error('Error listing events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single event with its properties
router.get('/events/:id', (req, res) => {
  try {
    const event = db.getEventById(parseInt(req.params.id));
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    const properties = db.getPropertiesByEventId(event.id);
    res.json({ success: true, event, properties });
  } catch (error) {
    console.error('Error getting event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update event description
router.put('/events/:id', (req, res) => {
  try {
    const { description } = req.body;
    const source = req.body.source || 'manual';
    db.updateEventDescription(parseInt(req.params.id), description, source);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete event
router.delete('/events/:id', (req, res) => {
  try {
    db.deleteEvent(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single property
router.get('/properties/:id', (req, res) => {
  try {
    const property = db.getPropertyById(parseInt(req.params.id));
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }
    res.json({ success: true, property });
  } catch (error) {
    console.error('Error getting property:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update property description
router.put('/properties/:id', (req, res) => {
  try {
    const { description } = req.body;
    const source = req.body.source || 'manual';
    db.updatePropertyDescription(parseInt(req.params.id), description, source);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Discovery Operations
// ============================================

// Discover events from Mixpanel
router.post('/discover/events', async (req, res) => {
  try {
    console.log('📡 Discovering events from Mixpanel...');
    const { result } = await mixpanel.listEvents();

    let count = 0;
    for (const eventData of result.events || []) {
      db.insertEvent(eventData.event, eventData.amount);
      count++;
    }

    console.log(`✅ Discovered ${count} events`);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error discovering events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Discover properties for a specific event
router.post('/discover/properties/:eventId', async (req, res) => {
  try {
    const event = db.getEventById(parseInt(req.params.eventId));
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    console.log(`📡 Discovering properties for event: ${event.name}...`);
    const { result } = await mixpanel.listEventProperties(event.name);

    let count = 0;
    for (const prop of result) {
      db.insertProperty(event.id, prop.name, prop.count);
      count++;
    }

    console.log(`✅ Discovered ${count} properties for ${event.name}`);
    res.json({ success: true, count, eventName: event.name });
  } catch (error) {
    console.error('Error discovering properties:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Discover sample values for a property
router.post('/discover/values/:propertyId', async (req, res) => {
  try {
    const property = db.getPropertyById(parseInt(req.params.propertyId));
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const event = db.getEventById(property.event_id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Parent event not found' });
    }

    console.log(`📡 Discovering values for property: ${property.name} on ${event.name}...`);
    const { result } = await mixpanel.listPropertyValues(event.name, property.name);

    // Infer data type from sample values
    let dataType = 'string';
    if (result.length > 0) {
      const sample = result[0];
      if (typeof sample === 'number') dataType = 'number';
      else if (typeof sample === 'boolean') dataType = 'boolean';
      else if (Array.isArray(sample)) dataType = 'list';
      else if (typeof sample === 'object') dataType = 'object';
    }

    db.updatePropertySampleValues(property.id, result, dataType);

    console.log(`✅ Discovered ${result.length} values for ${property.name}`);
    res.json({ success: true, count: result.length, values: result, dataType });
  } catch (error) {
    console.error('Error discovering values:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Full discovery: events + properties for all events
router.post('/discover/all', async (req, res) => {
  try {
    console.log('📡 Starting full schema discovery...');

    // Step 1: Discover events
    const { result: eventsResult } = await mixpanel.listEvents();
    let eventCount = 0;
    for (const eventData of eventsResult.events || []) {
      db.insertEvent(eventData.event, eventData.amount);
      eventCount++;
    }
    console.log(`✅ Discovered ${eventCount} events`);

    // Step 2: Discover properties for each event (with rate limiting awareness)
    const events = db.getAllEvents();
    let propertyCount = 0;
    const errors = [];

    for (const event of events) {
      try {
        const { result: propsResult } = await mixpanel.listEventProperties(event.name);
        for (const prop of propsResult) {
          db.insertProperty(event.id, prop.name, prop.count);
          propertyCount++;
        }
      } catch (err) {
        console.error(`Error discovering properties for ${event.name}:`, err.message);
        errors.push({ event: event.name, error: err.message });
      }
    }

    console.log(`✅ Full discovery complete: ${eventCount} events, ${propertyCount} properties`);
    res.json({
      success: true,
      eventCount,
      propertyCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in full discovery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// LLM Description Generation (Human-in-the-loop)
// ============================================

// Preview LLM-generated description (doesn't save)
router.post('/llm/preview', async (req, res) => {
  try {
    const { type, id } = req.body;

    if (!type || !id) {
      return res.status(400).json({ success: false, error: 'type and id are required' });
    }

    let context = {};

    if (type === 'event') {
      const event = db.getEventById(parseInt(id));
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      const properties = db.getPropertiesByEventId(event.id);
      context = {
        type: 'event',
        name: event.name,
        properties: properties.map(p => ({
          name: p.name,
          sampleValues: p.sample_values ? JSON.parse(p.sample_values) : []
        }))
      };
    } else if (type === 'property') {
      const property = db.getPropertyById(parseInt(id));
      if (!property) {
        return res.status(404).json({ success: false, error: 'Property not found' });
      }
      const event = db.getEventById(property.event_id);
      context = {
        type: 'property',
        name: property.name,
        eventName: event?.name,
        sampleValues: property.sample_values ? JSON.parse(property.sample_values) : [],
        dataType: property.data_type
      };
    } else {
      return res.status(400).json({ success: false, error: 'type must be "event" or "property"' });
    }

    console.log(`🤖 Generating description for ${type}: ${context.name}`);
    const { result: description } = await openai.generateDescription(context);

    res.json({
      success: true,
      description,
      context // Return context so UI can show what was sent
    });
  } catch (error) {
    console.error('Error generating description:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirm and save LLM-generated description
router.post('/llm/confirm', (req, res) => {
  try {
    const { type, id, description } = req.body;

    if (!type || !id || description === undefined) {
      return res.status(400).json({ success: false, error: 'type, id, and description are required' });
    }

    if (type === 'event') {
      db.updateEventDescription(parseInt(id), description, 'llm');
    } else if (type === 'property') {
      db.updatePropertyDescription(parseInt(id), description, 'llm');
    } else {
      return res.status(400).json({ success: false, error: 'type must be "event" or "property"' });
    }

    console.log(`✅ Saved LLM description for ${type} ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving description:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Export for Query Server
// ============================================

router.get('/export', (req, res) => {
  try {
    const format = req.query.format || 'full';

    if (format === 'compact') {
      // Minimal format for token efficiency
      const context = db.getSchemaContextForPrompt();
      res.json({ success: true, context });
    } else {
      // Full format with all details
      const schema = db.getSchemaForExport();
      res.json({ success: true, schema });
    }
  } catch (error) {
    console.error('Error exporting schema:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
