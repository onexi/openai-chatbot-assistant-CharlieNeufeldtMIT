// Load environment variables
import dotenv from 'dotenv';
dotenv.config();
import OpenAI from 'openai';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from the 'public' directory

// State dictionary
let state = {
  assistant_id: null,
  assistant_name: null,
  threadId: null,
  messages: [],
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Predefined assistant name-to-ID mapping (only for BankTest)
const assistantMapping = {
  'BankTest': 'asst_hBTqaeCRW8LwY5iG2r8GBEVu',
};

// Route to retrieve assistant by name
app.post('/api/assistants', async (req, res) => {
  const assistant_name = req.body.name; // Get the assistant name from the request body
  
  // Look up the assistant ID from the predefined mapping
  const assistant_id = assistantMapping[assistant_name];

  if (!assistant_id) {
    // If the assistant name is not found, return a 404 error
    return res.status(404).json({ error: `No assistant found with name '${assistant_name}'.` });
  }

  try {
    // Now that we have the assistant_id, we can use it with OpenAI API
    const myAssistant = await openai.beta.assistants.retrieve(assistant_id);

    state.assistant_id = myAssistant.id;
    state.assistant_name = myAssistant.name;

    // Send assistant_id and assistant_name back to the frontend
    res.status(200).json({
      assistant_id: myAssistant.id,
      assistant_name: myAssistant.name,
    });
  } catch (error) {
    console.error('Error fetching assistant:', error);

    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Failed to fetch assistant: ' + error.response.data,
      });
    } else {
      return res.status(500).json({ error: 'An unexpected error occurred while fetching the assistant.' });
    }
  }
});

app.post('/api/threads', async (req, res) => {
  try {
    // Make the request to OpenAI API to create a new thread without assistant_id
    const response = await openai.beta.threads.create();

    // Check if the response contains the thread ID
    if (!response.id) {
      console.error('No thread ID found in response:', response);
      return res.status(500).json({ error: 'No thread ID found' });
    }

    // Update the state with the new thread ID
    state.threadId = response.id;

    // Return the thread ID to the client
    res.json({ threadId: state.threadId });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

app.post('/api/run', async (req, res) => {
  console.log('Received request to /api/run');

  const messageObj = req.body.message;
  let messageContent = '';

  // Validate the message content
  if (messageObj.type === 'text' && messageObj.text && messageObj.text.value) {
    messageContent = messageObj.text.value;
  } else {
    console.error('Invalid message format:', messageObj);
    return res.status(400).json({ error: 'Invalid message format' });
  }

  // Ensure the thread ID and assistant ID are available
  if (!state.threadId) {
    console.error('No thread ID available.');
    return res.status(400).json({ error: 'No thread ID available.' });
  }

  if (!state.assistant_id) {
    console.error('No assistant ID available.');
    return res.status(400).json({ error: 'No assistant ID available.' });
  }

  console.log(`Assistant ID: ${state.assistant_id}`);  // Log assistant_id for debugging

  try {
    // Create the message in the OpenAI thread
    await openai.beta.threads.messages.create(state.threadId, {
      role: 'user',
      content: messageContent,
    });

    // Run the assistant and poll the results
    const run = await openai.beta.threads.runs.createAndPoll(state.threadId, {
      assistant_id: state.assistant_id,  // Ensure the correct assistant_id is passed
    });

    // Log the full run response
    console.log('Run response:', run);

    // Retrieve all messages in the thread
    const messagesResponse = await openai.beta.threads.messages.list(state.threadId);

    // Log the messages response
    console.log('Messages response:', messagesResponse);

    // Process and format the messages from the response
    const all_messages = messagesResponse.data.map(msg => {
      let messageContent = '';

      if (Array.isArray(msg.content)) {
        messageContent = msg.content
          .map(item => {
            if (item.type === 'text' && item.text && item.text.value) {
              return item.text.value;  // Extract the text value
            } else {
              // Handle other content types or skip
              return '';
            }
          })
          .join(' ');  // Join the content into a string
      } else if (typeof msg.content === 'string') {
        messageContent = msg.content;
      } else {
        // Handle unexpected content types
        messageContent = JSON.stringify(msg.content);
      }

      return { role: msg.role, content: messageContent };
    });

    // Send the messages back to the frontend
    res.json({ messages: all_messages });

  } catch (error) {
    console.error('Error running assistant:', error);
    res.status(500).json({ error: 'Failed to run assistant' });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
