/**
 * Direct test for Chat History Storage
 * Tests the database layer without needing the full Next.js server
 */

const { ChatStorage } = require('./lib/db/chat-storage.ts');

async function runTests() {
  console.log('Starting Chat History Storage tests...\n');

  let storage;
  let sessionId;
  let messageId;

  try {
    // Initialize storage
    console.log('1. Initializing storage...');
    storage = new ChatStorage({ dbPath: './test-chat-history.db' });
    console.log('   ✓ Storage initialized\n');

    // Create a session
    console.log('2. Creating a session...');
    const session = storage.createSession('Test Session', {
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
    });
    sessionId = session.id;
    console.log(`   ✓ Session created with ID: ${session.id}\n`);

    // Get the session
    console.log('3. Retrieving the session...');
    const retrieved = storage.getSession(sessionId);
    console.log(`   ✓ Session retrieved: ${retrieved.title}\n`);

    // Add a user message
    console.log('4. Adding a user message...');
    const userMsg = storage.addMessage(
      sessionId,
      'user',
      [{ type: 'text', text: 'Hello, this is a test!' }],
      { timestamp: Date.now() }
    );
    messageId = userMsg.id;
    console.log(`   ✓ User message added: ${userMsg.id}\n`);

    // Add an assistant message
    console.log('5. Adding an assistant message...');
    const assistantMsg = storage.addMessage(
      sessionId,
      'assistant',
      [{ type: 'text', text: 'Hello! I received your message.' }],
      { timestamp: Date.now(), inputTokens: 10, outputTokens: 15 }
    );
    console.log(`   ✓ Assistant message added: ${assistantMsg.id}\n`);

    // Get session with messages
    console.log('6. Retrieving session with messages...');
    const fullSession = storage.getSessionWithMessages(sessionId);
    console.log(`   ✓ Session has ${fullSession.messages.length} messages\n`);

    // List sessions
    console.log('7. Listing all sessions...');
    const sessions = storage.listSessions({ limit: 10 });
    console.log(`   ✓ Found ${sessions.sessions.length} session(s)\n`);

    // Update session
    console.log('8. Updating session title...');
    storage.updateSession(sessionId, { title: 'Updated Test Session' });
    const updated = storage.getSession(sessionId);
    console.log(`   ✓ Session title updated to: ${updated.title}\n`);

    // Update message
    console.log('9. Updating message...');
    storage.updateMessage(messageId, {
      content: [{ type: 'text', text: 'Updated message content' }],
    });
    const updatedMsg = storage.getMessage(messageId);
    console.log(`   ✓ Message updated: "${updatedMsg.content[0].text}"\n`);

    // Search sessions
    console.log('10. Searching sessions...');
    const searchResults = storage.searchSessions('Updated', 10);
    console.log(`   ✓ Found ${searchResults.length} result(s)\n`);

    // Export
    console.log('11. Exporting all data...');
    const exported = storage.exportAll();
    console.log(`   ✓ Exported ${exported.sessions.length} session(s)\n`);

    // Delete message
    console.log('12. Deleting message...');
    storage.deleteMessage(messageId);
    console.log('   ✓ Message deleted\n');

    // Delete session
    console.log('13. Deleting session...');
    storage.deleteSession(sessionId);
    console.log('   ✓ Session deleted\n');

    // Verify deletion
    console.log('14. Verifying deletion...');
    const deletedSession = storage.getSession(sessionId);
    console.log(`   ✓ Session is null: ${deletedSession === null}\n`);

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (storage) {
      storage.close();
      console.log('\nStorage closed.');
    }
  }
}

runTests().catch(console.error);
