const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the front directory
app.use(express.static(path.join(__dirname)));

// Initialize OpenAI API client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load credentials.json
const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const { client_id, client_secret, redirect_uris } = credentials.web;

const redirectUri = redirect_uris && redirect_uris.length > 0 ? redirect_uris[0] : 'http://localhost:3000';

// Initialize OAuth2 client
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

// Load tokens if they exist
if (fs.existsSync('token.json')) {
  const token = JSON.parse(fs.readFileSync('token.json'));
  oAuth2Client.setCredentials(token);
} else {
  console.log('Please visit the following URL to authorize the application:');
  console.log(
    oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar',
      ],
    })
  );
}

// Initialize Google Sheets and Calendar APIs
const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

// Define conversation context and system role
const SYSTEM_ROLE = `# Role
You are Adam, a practical, friendly, customer support agent at Divinity Inspection Service, a Home Inspection Service servicing the Tampa area. Customers will be able to chat with you through a pop up chat window on the company website.

# Task
Your mission is to qualify new leads and book appointments for qualified leads. Qualified leads will be new customers in a handful of counties in Florida seeking a home inspection for a residential property. leads with other inquiries, such as leads in other counties, existing customers, or leads seeking inspections for commercial properties will be informed that Divinity Inspection Service will call them back during regular business hours.
Use the following step-by-step instructions to help users. First Qualify, then Schedule if the user is qualified. Do not deviate from the order of these questions and ask one question at a time.

## Qualify
1) Ask the user if they are looking for an inspection or if they have a question on an existing completed report.
2) Ask the user for their name.
3) Ask the user for their phone number.
4) Ask the user for their email address.
5) Ask the user for the Floridian county of the property for which they need an inspection.
6) If the user is not from Hillsborough, Pinellas, Pasco, Hernando, or Citrus counties, inform them that Divinity Inspection Service will contact them during business hours, 9AM to 5PM EST and end the chat. Or, if the user is looking for a commercial home inspection or inquiring about an existing completed report, inform them that Divinity Inspection Service will contact them during business hours, 9AM to 5PM EST. Then say: “Have a great day!”
8) Otherwise, go to Scheduling.

## Scheduling
9) Ask the user for the address
10) Ask the user if the property is a new home construction or for an existing home that is already built.
11) Ask the user if they are purchasing this home or looking to do an inspection on a home they have already purchased.
12) Ask for the square footage of the home.
13) Calculate the number of hours it will take to inspect the home. Each 1000 square feet takes 1 hour to complete. For example, a 2300 square foot home will take 3 hours to complete, and a 5800 square foot home will take 6 hours to complete.
14) Inform the user on how many hours the inspection will take and ask them for the next available day the home inspection can take place.
15) Inform the user you will see them at 9AM on that day. Then say: “Have a great day!”

# Specifics
This is an extremely important time-saving job you are performing. We are a small home inspection services company where the burden is still on the owners to qualify leads and book inspections. You are a specialist at appointment booking, and this will help the owners of Divinity Inspection Service have the time to work on growing the business to offer Floridians a great home inspection service done right and provide for their families. With your great attitude, rockstar personality, and focus on patient outcomes, you do this job fantastically.
Ensure you check the real time booking tool for appointment availability before confirming the time. If there is a conflicting appointment then provide the user with pharmacy's availability after checking the real time booking tool and propose an available alternative time closest to the original time the user asked for. 

# Context
Divinity Inspection Service provides top quality property inspection services in West-Central Florida and is the top regional provider of property inspection services in the state. Our customers are mostly new home buyers and real estate professionals that need their property inspected. As our customer base grows younger, they are increasingly looking for digital ways to book inspection appointments. By accurately identifying opportunities that need attention, you directly contribute to the growth and success of our company, therefore we greatly value your careful consideration and attention.

# Examples
## Example 1: Existing Customer
Divinity Inspection Service: “Hi are you looking for an inspection or do you have a question on an existing completed report?”
Customer 1: “Existing Report”
Divinity Inspection Service: “What is your name, phone number, email, and address for the property?”
Customer: “Adam Rabb, 410-227-3983, adam@realinvestwithadam.com, 2504 Sunny Pebble
Lp, Zephyrhills, FL 33540”
Divinity Inspection Service: “Thank you for your information, we'll have someone contact you between business hours-9am-5pm EST. Have a great day!”

## Example 2: New Customer- Commercial Inspection
Divinity Inspection Service: “Hi are you looking for an inspection or do you have a question on an existing completed report?”
Customer 2: “New inspection”
Divinity Inspection Service: “Is this inspection for a Residential or Commercial Property?”
Customer 2: “Commercial Property”
Divinity Inspection Service: “What is your name, phone number, email, and address for the property?
Customer: Adam Rabb, 410-227-3983, adam@realinvestwithadam.com, 2504 Sunny Pebble
Lp, Zephyrhills, FL 33540”
Divinity Inspection Service: “Thank you for your information, we'll have someone contact you between business hours-9am-5pm EST. Have a great day!”

##Example 3: New Customer- Residential Inspection (Simple)
Divinity Inspection Service: “Hi are you looking for an inspection or do you have a question on an existing completed report?”
Customer 3: “New inspection”
Divinity Inspection Service: “Is this inspection for a Residential or Commercial Property?”
Customer 3: “Residential”
Divinity Inspection Service: “Is this for a home a new home construction or for an existing home (already built)”
Customer 3: “Already Built”
Divinity Inspection Service: “Thank you for that, are you purchasing this home or looking to do an inspection on a home you have already purchased?”
Customer 3: “Purchasing a home”
Divinity Inspection Service: “Congratulations in advance on your new home purchase! What is your name, number, email address, and the property address for the property you’re purchasing?”
Customer 3: “Adam Rabb, 410-227-3983, adam@realinvestwithadam.com, 2504 Sunny Pebble
Lp, Zephyrhills, FL 33540”
Divinity Inspection Service: “Thank you for this information, what is the square footage of your home? If you don’t know, type I don’t know”
Customer 3: “3,500 sq ft”
Divinity Inspection Service: “Thank you, when is the next available time to schedule (schedule link shows up) for this home it will require roughly 4 hours to complete.”
Customer 3: “January 1st, 2025”
Divinity Inspection Service: “We have just sent you an invoice, once paid, that time frame will be locked for you. Timeframe is protected for 10 minutes after this message (until paid)”
Customer 3: *pays*
Divinity Inspection Service: “Thank you for trusting Divinity Inspection Service, we look forward to seeing you on 01/01/2025 at 14:00 hours (2:00pm). Have a great day!”

# Notes
If the user is not in the specified counties, is looking for a commercial property inspection, or is looking for an existing report, end the chat and keep on directing the user to call Divinity Inspection Service during business hours, 9AM to 5PM EST at 410-227-3983.
Make sure to clarify the county the user is in if you are not sure.
If you reach step 15 or meet any of the conditions in step 6, or in other words, when you’ve either confirmed the user’s appointment or have told the user that Divinity will call them back during business hours, and the chat is functionally over, make sure to say, at the end of that phrase: “Have a great day!”
`;

const DEFAULT_CALENDAR_ID = 'aeb6qgcnttg1@gmail.com'; // Replace with your custom Calendar ID if needed

// Initialize conversation history object
const conversationHistory = {};

// Define headers for Google Sheets
const sheetHeaders = [
  'Name',
  'Email',
  'Phone Number',
  'County',
  'Residential?',
  'New Inspection?',
  'Qualified?',
  'Address',
  'Square Footage',
  'Hours',
  'Services Requested',
  'Appointment',
  'Invoice Price',
  'Payment Status',
  'Transcript',
];

// Append data to Google Sheets
async function appendToSheet(rowData) {
  const spreadsheetId = '1Yr-FWciQGll-EIbiIJbwv0CN-kh-vy9BeGlCrjcI0B8'; // Replace with your Spreadsheet ID
  const resource = { values: [rowData] };

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      resource,
    });
    console.log('Data appended to Google Sheet.');
  } catch (error) {
    console.error('Error appending to Google Sheets:', error);
  }
}

// Create a Google Calendar event
async function createCalendarEvent(dateTime, summary, description, attendees = [], calendarId = DEFAULT_CALENDAR_ID) {
  const event = {
    summary,
    description,
    start: {
      dateTime,
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: new Date(new Date(dateTime).getTime() + 3600000).toISOString(), // 1-hour event
      timeZone: 'America/New_York',
    },
    attendees: attendees.map((email) => ({ email })),
  };

  try {
    const response = await calendar.events.insert({
      calendarId,
      resource: event,
    });
    console.log('Event created:', response.data.htmlLink);
    return response.data.htmlLink; // Returns the event link
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

// Chat endpoint to handle user messages
app.post('/chat', async (req, res) => {
  const { userId, message } = req.body;

  if (!message || !userId) {
    return res.status(400).json({ response: 'Invalid message or user ID' });
  }

  try {
    // Initialize user session if it doesn't exist
    if (!conversationHistory[userId]) {
      conversationHistory[userId] = {
        transcript: [],
        userData: {
          Name: '',
          Email: '',
          'Phone Number': '',
          County: '',
          'Residential?': '',
          'New Inspection?': '',
          'Qualified?': '',
          Address: '',
          'Square Footage': '',
          Hours: '',
          'Services Requested': '',
          Appointment: '',
          'Invoice Price': '',
          'Payment Status': '',
        },
        hasScheduledAppointment: false,
        hasAskedConfirmation: false,
        isConversationComplete: false,
        conversationLocked: false, // Prevent further input
        chat_log_stored: '', // Variable to store the full chat log
      };
      conversationHistory[userId].transcript.push({ role: 'system', content: SYSTEM_ROLE });
    }

    const userSession = conversationHistory[userId];

    // Check if the conversation is locked
    if (userSession.conversationLocked) {
      console.log(`User ${userId} attempted input after conversation locked.`);
      return res.status(400).json({ response: 'Conversation has ended. No further input is allowed.' });
    }

    userSession.transcript.push({ role: 'user', content: message });

    // Debugging log for current state
    console.log(`Current State for User ${userId}:`, {
      hasAskedConfirmation: userSession.hasAskedConfirmation,
      hasScheduledAppointment: userSession.hasScheduledAppointment,
    });

    // If the user confirms the conversation is complete
    if (message.toLowerCase() === 'yes' && userSession.hasAskedConfirmation) {
      console.log('Condition met for completing conversation:');
      console.log('Message:', message);
      console.log('HasAskedConfirmation:', userSession.hasAskedConfirmation);

      // Store the final chat log
      userSession.chat_log_stored = userSession.transcript
        .map((entry) => `${entry.role}: ${entry.content}`)
        .join('\n');

      // Append data to Google Sheets
      const rowData = Object.values(userSession.userData);
      rowData.push(userSession.chat_log_stored);

      await appendToSheet(rowData);

      // Create a calendar event if an appointment is scheduled
      let eventResponse = '';
      if (userSession.userData.Appointment) {
        const eventLink = await createCalendarEvent(
          userSession.userData.Appointment,
          'Home Inspection Appointment',
          'Scheduled via AI Chatbot',
          [userSession.userData.Email]
        );
        eventResponse = ` Your appointment has been scheduled. Here is the event link: ${eventLink}`;
      }

      // Lock the conversation
      userSession.conversationLocked = true;

      // Log the entire transcript
      console.log(`Complete Transcript for User ${userId}:\n${userSession.chat_log_stored}`);

      return res.json({
        response: `Thank you! Your details have been recorded.${eventResponse} Goodbye!`,
      });
    }

    // Transition to the confirmation phase after scheduling
    if (userSession.hasScheduledAppointment && !userSession.hasAskedConfirmation) {
      console.log('Transitioning to confirmation phase...');
      const summaryMessage =
        'Here is a summary of your information:\n\n' +
        Object.entries(userSession.userData)
          .map(([key, value]) => `${key}: ${value || 'N/A'}`)
          .join('\n') +
        '\n\nIs this everything? Reply "yes" to confirm and complete the conversation.';
      userSession.hasAskedConfirmation = true; // Set flag to true
      userSession.transcript.push({ role: 'assistant', content: summaryMessage });

      console.log(`Summary sent to User ${userId}: ${summaryMessage}`);
      return res.json({ response: summaryMessage });
    }

    // Handle conversational AI interaction
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: userSession.transcript,
    });

    const response = aiResponse.choices[0].message.content;

    // Detect if the bot sends "Have a great day!"
    if (response.toLowerCase().includes('have a great day!')) {
      userSession.conversationLocked = true; // Lock the conversation
      console.log("HAHAHA", userSession.transcript);
      console.log(`Conversation locked for User ${userId} after "Have a great day!"`);
    }

    // Save the bot's response
    userSession.transcript.push({ role: 'assistant', content: response });

    // Respond to the frontend
    res.json({ response });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ response: 'Internal server error' });
  }
});

// Start the server
app.listen(3000, () => {
  console.log('Chatbot server running on port 3000');
});
