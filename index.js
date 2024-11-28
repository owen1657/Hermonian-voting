// Required Libraries
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Serve Static Files
app.use(express.static(__dirname));

// In-Memory Storage for Parties, Votes, and Admin States
let parties = [];
let votes = {};
let votingOpen = false;
let voters = {}; // Store IPs of users who have voted

// Admin Password
const adminPassword = "hermonianadmin";

// Helper Functions
const saveData = () => {
  fs.writeFileSync("data.json", JSON.stringify({ parties, votes, votingOpen, voters }));
};

const loadData = () => {
  if (fs.existsSync("data.json")) {
    const data = JSON.parse(fs.readFileSync("data.json"));
    parties = data.parties;
    votes = data.votes;
    votingOpen = data.votingOpen;
    voters = data.voters || {};
  }
};

loadData(); // Load data on server start

// Routes
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hermonian Voting</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(to right, #1e3c72, #2a5298);
      color: white;
      text-align: center;
    }
    header {
      padding: 20px;
      background-color: rgba(0, 0, 0, 0.8);
    }
    h1 {
      margin: 0;
      font-size: 2.5em;
    }
    button {
      padding: 10px 20px;
      font-size: 1em;
      margin: 10px;
      border: none;
      background-color: #007bff;
      color: white;
      border-radius: 5px;
      cursor: pointer;
    }
    button:hover {
      background-color: #0056b3;
    }
    main {
      padding: 20px;
    }
    #results-section {
      margin-top: 20px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 10px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Hermonian Voting</h1>
  </header>
  <main>
    ${
      votingOpen
        ? `<form method="POST" action="/vote">
            <label for="party">Choose a party to vote for:</label><br>
            <select name="party" id="party">
              ${parties.map((p) => `<option value="${p}">${p}</option>`).join("")}
            </select><br>
            <button type="submit">Submit Vote</button>
          </form>`
        : "<p>Voting is currently closed. Please come back later.</p>"
    }
    <button onclick="window.location.href='/admin-login'">Admin Features</button>
  </main>
</body>
</html>
  `);
});

app.post("/vote", (req, res) => {
  if (!votingOpen) {
    return res.send(`<p>Voting is closed. Please come back later.</p><a href="/">Back</a>`);
  }

  const party = req.body.party;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // Check if user has already voted
  if (voters[ip]) {
    return res.send(`<p>You have already voted. Each user can only vote once per session.</p><a href="/">Back</a>`);
  }

  if (party && parties.includes(party)) {
    // Register the vote
    votes[party] = (votes[party] || 0) + 1;
    voters[ip] = true; // Mark that this user has voted
    saveData(); // Save votes and voters to file
    res.send(`<p>Thank you for voting for ${party}!</p><a href="/">Back</a>`);
  } else {
    res.send(`<p>Invalid party selected.</p><a href="/">Back</a>`);
  }
});

// Admin Features
app.get("/admin-login", (req, res) => {
  res.send(`
    <form method="POST" action="/admin">
      <label for="password">Admin Password:</label>
      <input type="password" name="password" id="password">
      <button type="submit">Login</button>
    </form>
  `);
});

app.post("/admin", (req, res) => {
  if (req.body.password === adminPassword) {
    res.send(`
      <h1>Admin Panel</h1>
      <button onclick="window.location.href='/start-voting'">Start Voting</button>
      <button onclick="window.location.href='/end-voting'">End Voting</button>
      <form method="POST" action="/add-party">
        <label for="party">Add Party:</label>
        <input type="text" name="party" id="party">
        <button type="submit">Add</button>
      </form>
      <form method="POST" action="/remove-party">
        <label for="party">Remove Party:</label>
        <select name="party" id="party">
          ${parties.map((p) => `<option value="${p}">${p}</option>`).join("")}
        </select>
        <button type="submit">Remove</button>
      </form>
      <h2>Results</h2>
      <ul>
        ${Object.entries(votes)
          .map(([party, count]) => `<li>${party}: ${count} votes</li>`)
          .join("")}
      </ul>
      <a href="/">Back</a>
    `);
  } else {
    res.send(`<p>Invalid password.</p><a href="/admin-login">Try Again</a>`);
  }
});

app.get("/start-voting", (req, res) => {
  votingOpen = true;
  voters = {}; // Reset voters when voting starts
  saveData(); // Save the voting state
  res.redirect("/admin-login");
});

app.get("/end-voting", (req, res) => {
  votingOpen = false;
  saveData(); // Save the voting state
  res.redirect("/admin-login");
});

app.post("/add-party", (req, res) => {
  const party = req.body.party;
  if (party && !parties.includes(party)) {
    parties.push(party);
    votes[party] = 0; // Reset votes for the new party
    saveData();
  }
  res.redirect("/admin-login");
});

app.post("/remove-party", (req, res) => {
  const party = req.body.party;
  if (party && parties.includes(party)) {
    parties = parties.filter((p) => p !== party);
    delete votes[party]; // Remove votes for the party
    saveData();
  }
  res.redirect("/admin-login");
});

// Start the Server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
