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
    console.log('\n========================================');
    console.log('📥 INCOMING REQUEST');
    console.log('========================================');
    console.log('Question:', q);
    console.log('Time:', new Date().toISOString());

    // Step 1: Interpret the question using OpenAI
    console.log('\n🤖 Step 1: Sending to OpenAI for interpretation...');
    const interpretationResponse = await interpretQuestion(q);
    const interpretation = interpretationResponse.result;
    console.log('✅ OpenAI Response:');
    console.log('   Query Type:', interpretation.query_type);
    console.log('   Params:', JSON.stringify(interpretation.params, null, 2));
    console.log('   Tokens:', interpretationResponse.debug.tokens);

    // Step 2: Query Mixpanel based on interpretation
    console.log('\n📊 Step 2: Querying Mixpanel...');
    let mixpanelResponse;
    let queryType = interpretation.query_type;

    switch (queryType) {
      case 'segmentation':
        console.log('   Calling: querySegmentation');
        mixpanelResponse = await mixpanel.querySegmentation(interpretation.params);
        break;
      case 'retention':
        console.log('   Calling: queryRetention');
        mixpanelResponse = await mixpanel.queryRetention(interpretation.params);
        break;
      case 'funnels':
        console.log('   Calling: queryFunnels');
        mixpanelResponse = await mixpanel.queryFunnels(interpretation.params);
        break;
      case 'events':
        console.log('   Calling: listEvents');
        mixpanelResponse = await mixpanel.listEvents();
        break;
      default:
        queryType = 'segmentation';
        console.log('   Calling: querySegmentation (default)');
        mixpanelResponse = await mixpanel.querySegmentation(interpretation.params);
    }
    const data = mixpanelResponse.result;
    console.log('✅ Mixpanel returned data');

    // Step 3: Summarize results using OpenAI
    console.log('\n🤖 Step 3: Sending to OpenAI for summarization...');
    const summaryResponse = await summarizeResults(q, data);
    const summary = summaryResponse.result;
    console.log('✅ Summary generated');
    console.log('   Tokens:', summaryResponse.debug.tokens);

    // Step 4: Build Mixpanel link
    const mixpanelLink = mixpanel.buildMixpanelLink(queryType, interpretation.params);

    // Calculate total tokens
    const totalTokens = interpretationResponse.debug.tokens.total + summaryResponse.debug.tokens.total;

    console.log('\n========================================');
    console.log('📤 RESPONSE');
    console.log('========================================');
    console.log('Summary:', summary);
    console.log('Link:', mixpanelLink);
    console.log('Total Tokens:', totalTokens);
    console.log('========================================\n');

    // Return response with debug data
    res.json({
      success: true,
      question: q,
      summary,
      data,
      mixpanel_link: mixpanelLink,
      debug: {
        openai_interpretation: interpretationResponse.debug,
        openai_summarization: summaryResponse.debug,
        mixpanel: {
          ...mixpanelResponse.debug,
          response: data
        },
        total_tokens: totalTokens
      }
    });

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      details: error.message
    });
  }
});

module.exports = router;
