const express = require('express');
const { interpretQuestion, summarizeResults } = require('../services/openai');
const mixpanel = require('../services/mixpanel');

const router = express.Router();

router.get('/query', async (req, res) => {
  const { q } = req.query;

  // Input validation
  if (!q) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: q',
      details: 'Provide a natural language question as the q parameter'
    });
  }

  if (q.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Question too long',
      details: 'Question must be 500 characters or less'
    });
  }

  try {
    // Step 1: Interpret the question using OpenAI
    const interpretation = await interpretQuestion(q);
    console.log('Interpretation:', JSON.stringify(interpretation, null, 2));

    // Step 2: Query Mixpanel based on interpretation
    let data;
    let queryType = interpretation.query_type;

    switch (queryType) {
      case 'segmentation':
        data = await mixpanel.querySegmentation(interpretation.params);
        break;
      case 'retention':
        data = await mixpanel.queryRetention(interpretation.params);
        break;
      case 'funnels':
        data = await mixpanel.queryFunnels(interpretation.params);
        break;
      case 'events':
        data = await mixpanel.listEvents();
        break;
      default:
        // Default to segmentation
        queryType = 'segmentation';
        data = await mixpanel.querySegmentation(interpretation.params);
    }

    // Step 3: Summarize results using OpenAI
    const summary = await summarizeResults(q, data);

    // Step 4: Build Mixpanel link
    const mixpanelLink = mixpanel.buildMixpanelLink(queryType, interpretation.params);

    // Return response
    res.json({
      success: true,
      question: q,
      summary,
      data,
      mixpanel_link: mixpanelLink
    });

  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      details: error.message
    });
  }
});

module.exports = router;
