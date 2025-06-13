// ✅ Updated server.js: Improved error logging and 500 error traceability
const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const { spawn } = require("child_process");
const rateLimit = require("express-rate-limit"); // Add rate limiting

// Rate limiting middleware
const summarizePagesLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Increase to 20 requests per window
  message: JSON.stringify({
    error: "Too many requests to summarizePages, please try again later.",
  }),
});
const app = express();
app.use(cors());
app.use(express.json());

const port = 3000;
const OPENAI_API_KEY = YOUR_API_KEY;

app.get("/", (req, res) => {
  res.send("Welcome to the API!");
});

// 📌 NEW: Combined Classification and Processing Endpoint
app.post("/process", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  try {
    // Step 1: Classification
    const classificationResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `Classify the following text as Word, Sentence, Paragraph, Phrase, or Entity (Historical Figures, Places, and Events count as Entity). Respond with only the category. Note that if the text is composed of a word and '.', for example: "word." It should be classidied as a word. Text: \"${text}\".`,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
    );

    const classification =
      classificationResponse.data.choices[0].message.content.trim();
    console.log("✅ Classification:", classification);

    // Step 2: Processing based on classification
    let processingPrompt;
    if (classification === "Word") {
      processingPrompt = `Simply explain the word \"${text}\". Provide a context-specific definition, 2 example sentences( simple, short settences), and 3 synonyms.`;
    } else if (classification === "Sentence") {
      processingPrompt = `Simplify this sentence: \"${text}\". Explain its meaning in simpler terms.`;
    } else if (classification === "Paragraph") {
      processingPrompt = `Simply summarize the key points of this paragraph and make it as a list( put each point as short as possible). For example: 
      1.sth happened or someone did sth 
      2. what should the reader know
      3. and so on: \"${text}\".`;
    } else if (classification === "Entity") {
      processingPrompt = `Simply provide relevant and short information about \"${text}\". If it's a historical Figure, just what he/she has been known for. If it's a place, just tell where it is loacted at. If it's an event, concisely tell what happened during the event.`;
    } else if (classification === "Phrase") {
      // 👈 NEW CASE
      processingPrompt = `Concisely explain the phrase "${text}". Include the following:
  - Meaning of the phrase in context.`;
    } else {
      return res.status(400).json({ error: "Invalid classification type." });
    }

    const processingResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: processingPrompt }],
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
    );

    const explanation =
      processingResponse.data.choices[0].message.content.trim();
    res.json({ type: classification, explanation });
  } catch (error) {
    console.error("❌ Processing API Error:", error);
    res.status(500).json({
      error: "Failed to process text with OpenAI",
      details: error.response ? error.response.data : error.message,
    });
  }
});
// Add this endpoint in server.js, ideally below your existing /process route
app.post("/followup", async (req, res) => {
  const { question, context } = req.body;
  if (!question) {
    return res.status(400).json({ error: "Missing follow-up question." });
  }

  try {
    // Use the provided context (which now includes the word and its explanation) to form a clearer prompt.
    const prompt =
      context && context.trim() !== ""
        ? `Based on the following context:\n${context}\nPlease answer the follow-up question: "${question}"`
        : `Please answer the following follow-up question: "${question}"`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
    );

    const answer = response.data.choices[0].message.content.trim();
    res.json({ answer });
  } catch (error) {
    console.error("❌ Follow-up API Error:", error);
    res.status(500).json({
      error: "Failed to process follow-up question with OpenAI",
      details: error.response ? error.response.data : error.message,
    });
  }
});
app.post("/expand", async (req, res) => {
  const { type, context } = req.body;
  if (!type || !context) {
    return res
      .status(400)
      .json({ error: "Missing type or context for expansion." });
  }

  try {
    let prompt;
    // Create different prompts based on the type
    if (type === "Word") {
      prompt = `For the following word and explanation:\n${context}\nPlease provide additional details including usage frequency and pronunciation details (with IPA if available).`;
    } else if (type === "Sentence") {
      prompt = `For the following sentence and its explanation:\n${context}\nPlease provide alternative phrasing and a grammatical breakdown including parts of speech and structure.`;
    } else if (type === "Paragraph") {
      prompt = `For the following paragraph and its explanation:\n${context}\nPlease extract the key points and provide additional contextual commentary that highlights the underlying meaning and implications.`;
    } else if (type === "Entity") {
      prompt = `For the following entity (historical figure, place, or event) and its explanation:\n${context}\nPlease provide detailed background information, including key dates, events, and relevant context.`;
    } else if (type === "Phrase") {
      prompt = `For the following phrase and its explanation:\n${context}\n Please provide related idioms or phrases and its origin if available.`;
    } else {
      return res.status(400).json({ error: "Invalid type for expansion." });
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
    );

    const expanded = response.data.choices[0].message.content.trim();
    res.json({ expanded });
  } catch (error) {
    console.error("❌ Expand API Error:", error);
    res.status(500).json({
      error: "Failed to process expansion with OpenAI",
      details: error.response ? error.response.data : error.message,
    });
  }
});

// app.post("/review", async (req, res) => {
//   const { prompt } = req.body;
//   if (!prompt) {
//     return res.status(400).json({ error: "Missing review prompt." });
//   }

//   try {
//     const response = await axios.post(
//       "https://api.openai.com/v1/chat/completions",
//       {
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: prompt }],
//       },
//       { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
//     );

//     const article = response.data.choices[0].message.content.trim();
//     res.json({ article });
//   } catch (error) {
//     console.error("Review API Error:", error);
//     res.status(500).json({
//       error: "Failed to generate review article.",
//       details: error.response ? error.response.data : error.message,
//     });
//   }
// });

app.post("/logicMap", async (req, res) => {
  const { paragraph } = req.body;
  if (!paragraph) return res.status(400).json({ error: "Missing paragraph" });

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `Analyze the following paragraph and generate a logic map (arguments and reasoning flow) in Mermaid flowchart syntax (e.g., "graph TD; A-->B; B-->C;"). Paragraph: "${paragraph}" Format the response as JSON: { "logicMap": "your Mermaid syntax here" }`,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
    );

    const data = response.data.choices[0].message.content.trim();
    console.log("✅ OpenAI Response for Logic Map:", data);

    try {
      const parsedData = JSON.parse(data);
      res.json(parsedData); // Send structured JSON response
    } catch (jsonError) {
      console.error("❌ Error parsing OpenAI response:", jsonError);
      res.status(500).json({ error: "Failed to parse AI response" });
    }
  } catch (error) {
    console.error("❌ Logic Map API Error:", error);
    res.status(500).json({
      error: "Failed to generate logic map",
      details: error.response ? error.response.data : error.message,
    });
  }
});

function cleanPageText(text) {
  console.log(`🧾 Original text : ${text}`);

  // 找到 "Page — (" 開始的位置
  const pageMetaIndex = text.indexOf("Page — (");
  let mainText = pageMetaIndex !== -1 ? text.slice(0, pageMetaIndex) : text;

  // 移除開頭無意義的提示語
  mainText = mainText.replace(/^Skip to.*?Item Preview/i, "").trim();

  const cleaned = mainText.trim();
  const skip = cleaned.length < 100;

  console.log("🔍 Cleaned text:", cleaned);
  if (skip) console.warn("⚠️ Skipping due to short content");

  return { cleaned, skip };
}

app.post("/summarizePages", summarizePagesLimiter, async (req, res) => {
  const { pages } = req.body;
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    return res.status(400).json({ error: "Pages array is required" });
  }

  const summaries = [];
  let logicMapNodes = [];

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];

    if (!pageText || typeof pageText !== "string") {
      console.warn(`⚠️ Skipping invalid page ${i}:`, pageText);
      summaries.push("");
      continue;
    }

    console.log(`📄 Processing page ${i}: ${pageText.slice(0, 50)}...`);

    const { cleaned, skip } = cleanPageText(pageText);

    if (skip) {
      console.warn(`⚠️ Skipped page ${i} due to metadata or short length`);
      summaries.push("");
      continue;
    }

    // === 1. Generate Summary ===
    const summaryPrompt = `Summarize the following text into 2-3 sentences:\n\n${cleaned}`;
    try {
      const summaryResp = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4-turbo",
          messages: [
            {
              role: "system",
              content: "You are a concise summarization assistant.",
            },
            { role: "user", content: summaryPrompt },
          ],
          max_tokens: 150,
          temperature: 0.5,
        },
        { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
      );

      const summary = summaryResp.data.choices?.[0].message.content.trim();
      summaries.push(summary || "");
      console.log(
        `✅ Generated summary for page ${i}: ${summary?.slice(0, 60)}...`
      );
    } catch (error) {
      console.error(`❌ Failed to summarize page ${i}:`, error.message);
      summaries.push("");
      continue;
    }

    // === 2. Generate Logic Map ===

    const logicPrompt = `Return a JSON object with Mermaid syntax: { "logicMap": "graph LR; A-->B; ..." }. Use square brackets for labels and only valid syntax. Limit output to 15 nodes. Ensure the root node represents the main theme or strategy of the text, and structure the diagram hierarchically to reflect the flow of ideas.\n\nText:\n${cleaned}`;

    try {
      const logicResp = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4-turbo",
          messages: [{ role: "user", content: logicPrompt }],
          max_tokens: 2000,
          temperature: 0.3,
        },
        { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
      );

      let raw = logicResp.data.choices[0].message.content.trim();
      console.log(`📩 Raw logicMap response for page ${i}:\n`, raw);

      // Clean ```json and ``` wrappers
      if (raw.startsWith("```")) {
        raw = raw
          .replace(/```json\n?/i, "")
          .replace(/```$/, "")
          .trim();
      }

      try {
        const parsed = JSON.parse(raw);
        console.log(`📜 Parsed logicMap for page ${i}:\n`, parsed.logicMap);

        if (parsed?.logicMap?.startsWith("graph")) {
          const logicMapContent = parsed.logicMap
            .replace(/\\n/g, "\n")
            .replace(/;\s*/g, ";\n");

          const lines = logicMapContent
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("graph"));

          console.log(`📜 Extracted lines for page ${i}:\n`, lines);

          if (lines.length === 0) {
            console.warn(`⚠️ No valid lines found in logicMap for page ${i}`);
            continue;
          }

          // 不再添加前綴，直接使用原始節點名稱
          logicMapNodes.push(...lines);
        } else {
          console.warn(`⚠️ Invalid logicMap content on page ${i}`);
        }
      } catch (parseErr) {
        console.warn(
          `❌ Failed to parse logicMap JSON for page ${i}:`,
          parseErr.message
        );

        const match = raw.match(/"logicMap"\s*:\s*"([^]*?)"/);
        if (match && match[1]) {
          const fallback = match[1].replace(/\\"/g, '"');
          const logicMapContent = fallback
            .replace(/\\n/g, "\n")
            .replace(/;\s*/g, ";\n");

          const lines = logicMapContent
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("graph"));

          console.log(`📜 Fallback extracted lines for page ${i}:\n`, lines);

          if (lines.length === 0) {
            console.warn(`⚠️ No valid lines in fallback for page ${i}`);
            continue;
          }

          // 不再添加前綴，直接使用原始節點名稱
          logicMapNodes.push(...lines);
        } else {
          console.error("❌ Fallback logicMap extraction failed.");
        }
      }
    } catch (error) {
      console.error(`❌ OpenAI error for logicMap page ${i}:`, error.message);
    }
  }

  if (logicMapNodes.length === 0) {
    console.error("❌ No logic map nodes generated.");
    res.json({ summaries, logicMap: "graph LR;\n  %% No nodes generated" });
    return;
  }

  const logicMap =
    "graph LR;\n" + logicMapNodes.map((l) => "  " + l).join("\n");
  console.log(`✅ Final logicMap:\n`, logicMap);
  console.log(`✅ Finished summarizing ${pages.length} pages.`);
  res.json({ summaries, logicMap });
});

app.listen(port, () => {
  console.log(`🚀 API Server running on port ${port}`);
});
