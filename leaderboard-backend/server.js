const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
let scoreUpdateQueue = Promise.resolve();

app.use(cors());
app.use(express.json({ limit: "100kb" }));

function sanitizeUserId(userId) {
  return String(userId || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function formatPlaintext(entries) {
  if (!entries.length) {
    return "No leaderboard entries yet.";
  }

  return entries.map((entry) => `${entry.userId}: ${entry.score}`).join("\n");
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readUserScore(userId) {
  const filePath = path.join(dataDir, `${userId}.json`);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const storedValue = Number(parsed[userId] || 0);

    return {
      filePath,
      score: Number.isFinite(storedValue) ? storedValue : 0,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { filePath, score: 0 };
    }

    throw error;
  }
}

async function writeUserScore(userId, score) {
  const filePath = path.join(dataDir, `${userId}.json`);
  const payload = JSON.stringify({ [userId]: String(score) }, null, 2);
  await fs.writeFile(filePath, `${payload}\n`, "utf8");
  return filePath;
}

function queueScoreUpdate(work) {
  const queuedWork = scoreUpdateQueue.then(work);
  scoreUpdateQueue = queuedWork.catch(() => {});
  return queuedWork;
}

async function loadAllScores() {
  await ensureDataDir();
  const files = await fs.readdir(dataDir);
  const entries = [];

  for (const fileName of files) {
    if (!fileName.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(dataDir, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const [userId, value] = Object.entries(parsed)[0] || [];

    if (!userId) {
      continue;
    }

    const score = Number(value);

    if (!Number.isFinite(score)) {
      continue;
    }

    entries.push({ userId, score });
  }

  return entries.sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
}

function validateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object like { \"yeeps0299\": \"2\" }.";
  }

  const entries = Object.entries(body);

  if (!entries.length) {
    return "Request body must include at least one user and score.";
  }

  for (const [rawUserId, rawScore] of entries) {
    const userId = sanitizeUserId(rawUserId);
    const score = Number(rawScore);

    if (!userId) {
      return "Each user ID must contain at least one valid character.";
    }

    if (!Number.isInteger(score) || score < 0) {
      return `Score for ${rawUserId} must be a whole number greater than or equal to 0.`;
    }
  }

  return null;
}

app.get("/", async (_req, res, next) => {
  try {
    const scores = await loadAllScores();
    res.type("text/plain").send(formatPlaintext(scores.slice(0, 10)));
  } catch (error) {
    next(error);
  }
});

app.get("/leaderboard", async (_req, res, next) => {
  try {
    const scores = await loadAllScores();
    res.type("text/plain").send(formatPlaintext(scores.slice(0, 10)));
  } catch (error) {
    next(error);
  }
});

app.get("/leaderboard/:userId", async (req, res, next) => {
  try {
    const userId = sanitizeUserId(req.params.userId);

    if (!userId) {
      return res.status(400).type("text/plain").send("Invalid user ID.");
    }

    const { score } = await readUserScore(userId);
    return res.type("text/plain").send(`${userId}: ${score}`);
  } catch (error) {
    next(error);
  }
});

app.get("/api/leaderboard", async (_req, res, next) => {
  try {
    const scores = await loadAllScores();
    res.json(scores.slice(0, 10));
  } catch (error) {
    next(error);
  }
});

app.get("/api/leaderboard/:userId", async (req, res, next) => {
  try {
    const userId = sanitizeUserId(req.params.userId);

    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    const { score } = await readUserScore(userId);
    return res.json({ userId, score });
  } catch (error) {
    next(error);
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/scores", async (req, res, next) => {
  try {
    const validationError = validateBody(req.body);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await ensureDataDir();
    const updated = await queueScoreUpdate(async () => {
      const results = [];

      for (const [rawUserId, rawScore] of Object.entries(req.body)) {
        const userId = sanitizeUserId(rawUserId);
        const scoreToAdd = Number(rawScore);
        const existing = await readUserScore(userId);
        const totalScore = existing.score + scoreToAdd;
        await writeUserScore(userId, totalScore);

        results.push({
          userId,
          scoreAdded: scoreToAdd,
          totalScore,
        });
      }

      return results;
    });

    return res.status(200).json({ updated });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

ensureDataDir()
  .then(() => {
    app.listen(port, () => {
      console.log(`Leaderboard backend listening on port ${port}`);
      console.log(`Data directory: ${dataDir}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start leaderboard backend.", error);
    process.exit(1);
  });
