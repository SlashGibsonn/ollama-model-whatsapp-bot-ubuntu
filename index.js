const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");

// Language model name to use
const languageModelName = "deepseek-llm:7b"; //repalce with your own LLM model, locally

// Object to store conversation history
const conversationHistory = {};

// Function to process messages using Ollama with history
async function processMessage(text, userId) {
  try {
    // Initialize the user's history if it doesn't exist
    if (!conversationHistory[userId]) {
      conversationHistory[userId] = [];
    }

    // Add the user's message to the history
    conversationHistory[userId].push({ role: "user", content: text });

    // Limit the history to the last 10 interactions
    if (conversationHistory[userId].length > 10) {
      conversationHistory[userId].shift();
    }

    const response = await axios.post(
      "http://127.0.0.1:11434/api/chat", // Replace with your IP address
      {
        model: languageModelName,
        messages: [
          {
            role: "system",
            content:
              "Respond it with concise and clear text, that provides helpful input to users.",
          },
          ...conversationHistory[userId], // Send the user's complete history
        ],
        stream: false, // Ensure the response is not streamed
      }
    );

    // Log the entire response for debugging
    console.log("API Response:", response.data);

    // Extract the assistant's reply from the response
    let reply = response.data.message.content;

    // Remove any unwanted characters or formatting
    reply = reply.replace(/[\s\S]*?<\/think>/g, "").trim();

    // Add the AI's response to the history
    conversationHistory[userId].push({ role: "assistant", content: reply });

    console.log(`Generated response for CLIENT: ${reply}`);
    console.log("***************************************");
    return reply;
  } catch (error) {
    console.error("Error processing message:", error);
    return "Sorry, I couldn't process your message.";
  }
}

// Initialize the WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(), // Save the session locally
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"], // Add this option to avoid root error
  },
});

// Generate the QR Code in the terminal
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

// When ready, display a message
client.on("ready", () => {
  console.log("Client is ready!");
  console.log("---------------------------------------------");
});

// Listen for received messages
client.on("message", async (message) => {
  // Ignore messages from "status" updates
  if (message.from.includes("status")) {
    return;
  }
  console.log(`Message received from CLIENT: ${message.body}`);
  console.log("---------------------------------------------");

  // Process the message with Ollama using the history
  const response = await processMessage(message.body, message.from);

  // Reply to the message on WhatsApp
  message.reply(response);
});

// Initialize the client
client.initialize();
