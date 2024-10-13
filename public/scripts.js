// Global state object to store assistant and thread information
let state = {
  assistant_id: null,
  assistant_name: null,
  threadId: null,
  messages: [],
};

async function getThread() {
  // Clear the message container for the new thread
  document.getElementById('message-container').innerHTML = '';

  try {
    const response = await fetch('/api/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`Thread created with ID: ${data.threadId}`);

      // Set the newly created thread as the current active thread
      state.threadId = data.threadId;

      // Show the "New thread created" message
      const newThreadMessage = document.getElementById('newThreadMessage');
      newThreadMessage.innerHTML = '<strong>A new thread has been created!</strong>';

      // Set a timeout to clear the message after 3 seconds
      setTimeout(() => {
        newThreadMessage.innerHTML = '';  // Clear the message after 3 seconds
      }, 3000); // 3000 ms = 3 seconds
    } else {
      console.error("Error creating thread:", await response.json());
    }

  } catch (error) {
    console.error("Error creating thread:", error);
  }
}



// Function to send a message and get a response from the assistant
async function getResponse() {
  console.log("getResponse() function called");
  let message = document.getElementById('messageInput').value;

  // Ensure there is a message and a valid threadId before proceeding
  if (!message || !state.threadId) {
    alert("Please enter a message and make sure a thread has been created.");
    return;
  }

  // Clear the input field after sending the message
  document.getElementById('messageInput').value = '';

  // Display the user's message immediately
  writeToMessages(`<span class="message user">${message}</span>`);

  try {
    // Send the message to the server
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          type: 'text',
          text: { value: message }
        }
      }),
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log('Response data:', responseData);

      const latestAssistantMessage = responseData.messages.find(msg => msg.role === 'assistant');

      // Display only the latest assistant's response
      if (latestAssistantMessage) {
        writeToMessages(`<span class="message assistant">${latestAssistantMessage.content}</span>`);
      }

    } else {
      console.error("Error in response:", await response.json());
    }

  } catch (error) {
    console.error("Error fetching assistant response:", error);
  }
}


// Function to append messages to the message container
function writeToMessages(message) {
  let messageDiv = document.createElement("div"); // Create a new div for each message
  messageDiv.innerHTML = message;
  document.getElementById('message-container').appendChild(messageDiv);
}

// Function to retrieve the assistant by name
async function getAssistant() {
  let name = document.getElementById('assistant_name').value;
  console.log(`assistant_name: ${name}`);
  
  try {
    const response = await fetch('/api/assistants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: name }),
    });
    
    state = await response.json(); // Update the state object with the assistant details
    console.log(`Assistant retrieved: ${JSON.stringify(state)}`);
    
    // Notify the user that the assistant is ready
    writeToMessages(`Assistant ${state.assistant_name} is ready to chat.`);
  } catch (error) {
    console.error("Error fetching assistant:", error);
  }
}
