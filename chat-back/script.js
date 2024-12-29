// Select necessary DOM elements
const chatbotToggle = document.getElementById('chatbot-toggle');
const chatbot = document.getElementById('chatbot');
const messages = document.getElementById('chatbot-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

const userId = 'unique-user-id'; // Replace with a unique identifier for the user

// Toggle chatbot visibility
chatbotToggle.addEventListener('click', () => {
  chatbot.style.display = chatbot.style.display === 'none' ? 'flex' : 'none';
});

// Handle message sending
sendButton.addEventListener('click', async () => {
  const message = userInput.value.trim();

  if (!message) return;

  // Display user message
  addMessageToChat(`You: ${message}`, 'user');

  try {
    // Send user message to the backend
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message }),
    });

    const data = await response.json();

    // Display chatbot response
    addMessageToChat(`Bot: ${data.response}`, 'bot');
  } catch (error) {
    console.error('Error communicating with the backend:', error);
    addMessageToChat('Error: Unable to reach the chatbot server.', 'error');
  }

  userInput.value = '';
});

// Helper function to add a message to the chat
function addMessageToChat(content, sender) {
  const messageElement = document.createElement('div');
  messageElement.textContent = content;
  messageElement.className = sender; // Add a class for styling (e.g., 'user', 'bot', 'error')
  messages.appendChild(messageElement);
  messages.scrollTop = messages.scrollHeight; // Auto-scroll to the latest message
}
